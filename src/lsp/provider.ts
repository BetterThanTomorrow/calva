import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as vscode_lsp from 'vscode-languageclient/node';
import * as currentFile from '../current-file';
import * as project_utils from '../project-root';
import * as state from '../state';
import * as api from './api';
import * as auto_start from './auto-start';
import * as lsp_client from './client';
import * as commands from './commands';
import * as config from './config';
import * as defs from './definitions';
import * as projectTree from './project-tree';
import * as status_bar from './status-bar';
import * as utils from './utils';

/**
 * Can be called to shutdown the fallback lsp server if there are no longer any relevant workspaces or files
 * open
 */
const shutdownFallbackClientIfNeeded = async (clients: defs.LspClientStore) => {
  const roots = await project_utils.findProjectRootsWithReasons({
    include_lsp_directories: true,
  });

  const non_project_folders = roots
    .filter((root) => {
      return !root.valid_project && root.workspace_root;
    })
    .map((root) => root.uri);

  const contains_external_files = !!vscode.workspace.textDocuments.find((doc) => {
    const external = vscode.workspace.getWorkspaceFolder(doc.uri);
    return auto_start.isClojureDocument(doc) && external;
  });

  if (non_project_folders.length === 0 && !contains_external_files) {
    console.log('Shutting down fallback lsp client');
    void clients
      .get(api.FALLBACK_CLIENT_ID)
      ?.client.stop()
      .catch((err) => console.error('Failed to stop fallback client', err));
  }
};

type CreateClientProviderParams = {
  context: vscode.ExtensionContext;
  testTreeHandler: defs.TestTreeHandler;
};

/**
 * Creates an LSP client provider which is responsible for dynamically provisioning LSP clients for Clojure projects
 * opened in the VSCode workspace(s).
 *
 * Whenever a Clojure document is opened this provider will search backwards (starting from the directory the
 * document resides in) for the root most Clojure project in the workspace. If a valid Clojure project is found
 * and no LSP client exists yet then one is provisioned. If no valid project is found then it falls back to using
 * the workspace root.
 *
 * Any other systems that need to perform LSP operations can then request the LSP client governing a given
 * document URI which will be returned if it exists.
 *
 * This module is also responsible for updating the VSCode status bar item with the state of the LSP client for the
 * current file.
 */
export const createClientProvider = (params: CreateClientProviderParams) => {
  const clients: defs.LspClientStore = new Map();

  const status_bar_item = vscode.window.createStatusBarItem(
    'clojureLSP.manage',
    vscode.StatusBarAlignment.Left,
    0
  );
  status_bar_item.command = 'calva.clojureLsp.manage';
  status_bar_item.name = 'Calva: clojure-lsp Menu';

  const updateStatusBar = () => {
    const current_file = currentFile.currentFileDocument();
    const current_file_is_clojure = current_file?.languageId === 'clojure';
    status_bar.updateStatusBar(
      status_bar_item,
      status_bar.statusFor({
        statuses: Array.from(clients.values()).map((client) => client.status),
        downloadFailed,
        currentFileIsClojure: current_file_is_clojure,
        currentFileClientStatus: current_file_is_clojure
          ? api.getActiveClientForUri(clients, current_file.uri)?.status
          : undefined,
      })
    );
  };

  let lsp_server_path: string | undefined;
  let downloadFailed = false;
  const provisionClient = async (uri: vscode.Uri, id = uri.fsPath) => {
    if (lsp_server_path === undefined) {
      lsp_server_path = await lsp_client.ensureLSPServer(params.context);
      if (!lsp_server_path) {
        downloadFailed = true;
        status_bar.updateStatusBar(status_bar_item, defs.LspStatus.DownloadFailed);
        return;
      }
      // Binary found or downloaded — check for upgrades in background
      void lsp_client.checkForUpgrade(params.context);
    }

    const existing = clients.get(id);
    if (existing && [defs.LspStatus.Starting, defs.LspStatus.Running].includes(existing.status)) {
      return;
    }

    console.log(`Creating new LSP client using ${uri.path} as the project root`);
    const client = lsp_client.createClient({
      lsp_server_path,
      id,
      uri,
    });

    clients.set(id, client);
    updateStatusBar();

    client.client.onDidChangeState(async ({ newState }) => {
      updateStatusBar();

      if (newState === vscode_lsp.State.Running) {
        const serverInfo = await api
          .getServerInfo(client.client)
          .catch((err) => console.error(err));
        if (serverInfo) {
          const calvaSaysChannel = state.outputChannel();
          calvaSaysChannel.appendLine(`clojure-lsp version used: ${serverInfo['server-version']}`);
          calvaSaysChannel.appendLine(`clj-kondo version used: ${serverInfo['clj-kondo-version']}`);
        }

        new projectTree.ProjectTreeExplorer(client.client);
      }
    });

    client.client.onNotification('clojure/textDocument/testTree', (tree: defs.TestTreeParams) => {
      params.testTreeHandler(tree);
    });
  };

  /**
   * Provision a fallback lsp client in an OS temp directory to service any clojure files not part of any opened
   * valid clojure projects.
   *
   * This logic has been disabled for now as it does not function correctly on Windows. This can be re-enabled
   * once support for windows has been added.
   */
  const provisionFallbackClient = async () => {
    return;
    const dir = path.join(os.tmpdir(), 'calva-clojure-lsp');
    await fs.mkdir(dir, {
      recursive: true,
    });
    return provisionClient(vscode.Uri.file(dir), api.FALLBACK_CLIENT_ID);
  };

  const provisionClientForOpenedDocument = async (document: vscode.TextDocument) => {
    // We exclude untitled files because clojure-lsp does not support them (yet?)
    if (document.languageId !== 'clojure' || document.uri.scheme === 'untitled') {
      return;
    }

    // Don't provision a client if the document is already governed (ignoring the fallback client)
    const existing = api.getActiveClientForUri(clients, document.uri);
    if (existing && existing.id !== api.FALLBACK_CLIENT_ID) {
      return;
    }

    // If there is no appropriate project root in any of the workspaces then we provision the fallback client
    const uri = await utils.findClojureProjectRootForUri(document.uri);
    if (!uri) {
      return provisionFallbackClient();
    }

    return provisionClient(uri);
  };

  const provisionClientInFirstWorkspaceRoot = async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return;
    }

    const roots = await project_utils.findProjectRootsWithReasons({
      include_lsp_directories: true,
      include_workspace_folders: false,
    });
    const holds_clojure = auto_start.isClojureWorkspaceFolder({
      folder_path: folder.uri.fsPath,
      project_root_paths: roots.map((root) => root.uri.fsPath),
      open_clojure_document_paths: vscode.workspace.textDocuments
        .filter(auto_start.isClojureDocument)
        .map((doc) => doc.uri.fsPath),
    });
    if (!holds_clojure) {
      console.log(
        `Skipping clojure-lsp auto-start in ${folder.uri.path}: no Clojure project or open Clojure files`
      );
      return;
    }

    return provisionClient(folder.uri);
  };

  return {
    getClientForDocumentUri: (uri: vscode.Uri) => api.getClientForDocumentUri(clients, uri),

    /**
     * Shows the status of the current file's client, for when the current file changes without the
     * active editor changing
     */
    updateStatusBar,

    init: async () => {
      status_bar_item.show();
      updateStatusBar();

      switch (config.getAutoStartBehaviour()) {
        case config.AutoStartBehaviour.WorkspaceOpened: {
          const roots = await project_utils.findProjectRootsWithReasons({
            include_lsp_directories: true,
          });
          const valid_workspace_folders = roots
            .filter((root) => {
              return root.valid_project && root.workspace_root;
            })
            .map((root) => root.uri);
          const invalid_workspace_folders = roots
            .filter((root) => {
              return !root.valid_project && root.workspace_root;
            })
            .map((root) => root.uri);

          const distinct = project_utils.filterShortestDistinctPaths(valid_workspace_folders);
          distinct.forEach((root) => {
            void provisionClient(root).catch((err) => console.error(err));
          });

          // If the workspace contains any 'invalid' clojure projects (projects with no project files) then we
          // provision the fallback lsp client
          if (invalid_workspace_folders.length > 0) {
            void provisionFallbackClient().catch((err) => console.error(err));
          }
          break;
        }
        case config.AutoStartBehaviour.FileOpened: {
          vscode.workspace.textDocuments.forEach((document) => {
            void provisionClientForOpenedDocument(document).catch((err) => console.error(err));
          });
          break;
        }
        case config.AutoStartBehaviour.FirstWorkspace: {
          void provisionClientInFirstWorkspaceRoot().catch((err) => console.error(err));
          break;
        }
      }

      params.context.subscriptions.push(
        /**
         * We setup a listener for the active editor changing and use that to update the status bar with the
         * status of the LSP server related to the current file.
         */
        vscode.window.onDidChangeActiveTextEditor((event) => {
          updateStatusBar();
        }),

        // Provision new LSP clients when clojure files are opened and for all already opened clojure files.
        vscode.workspace.onDidOpenTextDocument((document) => {
          switch (config.getAutoStartBehaviour()) {
            case config.AutoStartBehaviour.FileOpened: {
              return void provisionClientForOpenedDocument(document).catch((err) =>
                console.error(err)
              );
            }
            case config.AutoStartBehaviour.FirstWorkspace: {
              const folder = vscode.workspace.workspaceFolders?.[0];
              if (folder && auto_start.isClojureDocument(document)) {
                void provisionClient(folder.uri).catch((err) => console.error(err));
              }
              return;
            }
          }
        }),

        vscode.workspace.onDidCloseTextDocument((doc) => {
          if (doc.languageId === 'clojure') {
            void shutdownFallbackClientIfNeeded(clients);
          }
        }),

        // Provision new LSP clients when workspaces folders are added, and shutdown clients when folders are removed
        vscode.workspace.onDidChangeWorkspaceFolders((event) => {
          event.removed.forEach((folder) => {
            clients.forEach((client, dir) => {
              const relative = path.relative(folder.uri.path, dir);
              if ((relative && !relative.includes('../')) || dir === folder.uri.path) {
                console.log(
                  `Shutting down the LSP client at ${dir} as it belongs to a removed workspace`
                );
                void client.client.stop().catch((err) => console.error(err));
              }
            });
          });

          switch (config.getAutoStartBehaviour()) {
            case config.AutoStartBehaviour.WorkspaceOpened: {
              return void Promise.allSettled(
                event.added.map(async (folder) => {
                  // Don't provision an lsp client if this workspace folder is already governed by an existing folder
                  const existing = api.getActiveClientForUri(clients, folder.uri);
                  if (existing && existing.id !== api.FALLBACK_CLIENT_ID) {
                    return;
                  }
                  if (await project_utils.isValidClojureProject(folder.uri)) {
                    void provisionClient(folder.uri).catch((err) => console.error(err));
                  } else {
                    void provisionFallbackClient().catch((err) => console.error(err));
                  }
                })
              );
            }
            case config.AutoStartBehaviour.FirstWorkspace: {
              return void provisionClientInFirstWorkspaceRoot().catch((err) => console.error(err));
            }
          }

          void shutdownFallbackClientIfNeeded(clients);
        })
      );

      params.context.subscriptions.push(
        ...commands.registerLspCommands(clients),
        ...commands.registerEventHandlers(),

        ...commands.registerVSCodeCommands({
          clients,
          context: params.context,
          handleStartRequest: (uri) => {
            return provisionClient(uri);
          },
        })
      );
    },

    /**
     * Remove the status bar item and shutdown all LSP clients
     */
    shutdown: async () => {
      status_bar_item.dispose();
      await Promise.allSettled(Array.from(clients.values()).map((client) => client.client.stop()));
    },
  };
};

export type ClientProvider = ReturnType<typeof createClientProvider>;
