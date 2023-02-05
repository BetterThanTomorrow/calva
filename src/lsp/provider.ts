import vscode_lsp from 'vscode-languageclient/node';
import project_utils from '../project-root';
import vscode from 'vscode';
import path from 'node:path';

import status_bar from './status-bar';
import commands from './commands';
import lsp_client from './client';
import defs from './definitions';
import config from './config';
import state from '../state';
import queue from './queue';
import utils from './utils';
import api from './api';

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
 * current active editor.
 */
export const createClientProvider = (params: CreateClientProviderParams) => {
  const clients = new Map<string, vscode_lsp.LanguageClient>();

  const status_bar_item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  status_bar_item.command = 'calva.clojureLsp.manage';

  const updateStatusBar = () => {
    const active_editor = vscode.window.activeTextEditor?.document;

    if (!active_editor || active_editor.languageId !== 'clojure') {
      // If there are multiple clients then we don't know which client to show the status for and we set it to unknown
      if (clients.size !== 1) {
        status_bar.updateStatusBar(status_bar_item, status_bar.LspStatus.Unknown);
        return;
      }

      const client = Array.from(clients.values())[0];
      status_bar.updateStatusBar(status_bar_item, status_bar.lspClientStateToStatus(client.state));
      return;
    }

    const client = api.getClientForDocumentUri(clients, active_editor.uri);
    if (!client) {
      status_bar.updateStatusBar(status_bar_item, status_bar.LspStatus.Stopped);
      return;
    }

    status_bar.updateStatusBar(status_bar_item, status_bar.lspClientStateToStatus(client.state));
  };

  /**
   * Newly opened documents are added to a queue and processed synchronously. This is to prevent multiple LSP clients being
   * created for the same shared root and also allows preparation operations (like downloading the LSP server binary) to
   * not conflict with each other.
   *
   * A raw document URI can also be sent instead of a full document. This is to support a user supplied path.
   */
  const provision_queue = queue.createQueue<vscode.TextDocument | vscode.Uri>(
    async (document_or_uri) => {
      let uri: vscode.Uri;

      if (document_or_uri instanceof vscode.Uri) {
        uri = document_or_uri;
      } else {
        if (document_or_uri.languageId !== 'clojure') {
          return;
        }

        // Don't provision a client if the document is already governed
        if (api.getClientForDocumentUri(clients, document_or_uri.uri)) {
          return;
        }

        uri = await utils.findClojureProjectRootForUri(document_or_uri.uri);
      }

      if (!uri || clients.has(uri.path)) {
        return;
      }

      console.log(`Creating new LSP client using ${uri.toString()} as the project root`);

      try {
        status_bar.updateStatusBar(status_bar_item, status_bar.LspStatus.Starting);

        const { client, start } = await lsp_client.createClient({
          context: params.context,
          uri: vscode.Uri.parse(uri.path),
        });

        clients.set(uri.path, client);

        await start();

        // The `client.start()` seems to resolve even when the client fails to start and so we do an explicit check
        // after `start()` resolves to make sure the client did in fact start correctly.
        if (client.state === vscode_lsp.State.Stopped) {
          throw new Error('Clojure-lsp did not transition into a started state');
        }

        updateStatusBar();

        client.onDidChangeState((state) => {
          if (state.newState === vscode_lsp.State.Stopped && clients.get(uri.path) === client) {
            clients.delete(uri.path);
          }
          updateStatusBar();
        });
        client.onNotification('clojure/textDocument/testTree', (tree: defs.TestTreeParams) => {
          params.testTreeHandler(tree);
        });

        const serverInfo = await api.getServerInfo(client);
        if (serverInfo) {
          const calvaSaysChannel = state.outputChannel();
          calvaSaysChannel.appendLine(`clojure-lsp version used: ${serverInfo['server-version']}`);
          calvaSaysChannel.appendLine(`clj-kondo version used: ${serverInfo['clj-kondo-version']}`);
        }
      } catch (err) {
        clients.delete(uri.path);
        updateStatusBar();

        console.error(`Failed to provision client for root ${uri.path}`, err);
        void vscode.window.showErrorMessage('Failed to start clojure-lsp client');
      }
    }
  );

  return {
    getClientForDocumentUri: (uri: vscode.Uri) => api.getClientForDocumentUri(clients, uri),

    init: async () => {
      status_bar_item.show();

      if (vscode.window.activeTextEditor?.document.languageId === 'clojure') {
        status_bar.updateStatusBar(status_bar_item, status_bar.LspStatus.Stopped);
      } else {
        status_bar.updateStatusBar(status_bar_item, status_bar.LspStatus.Unknown);
      }

      // Provision new LSP clients when clojure files are opened and for all already opened clojure files.
      params.context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
          if (config.getAutoStartBehaviour() === config.AutoStartBehaviour.FileOpened) {
            void provision_queue.push(document).catch((err) => console.error(err));
          }
        })
      );

      switch (config.getAutoStartBehaviour()) {
        case config.AutoStartBehaviour.WorkspaceOpened: {
          const roots = await project_utils.findProjectRootsWithReasons();
          const workspace_folders = roots
            .filter((root) => {
              return root.valid_project && root.workspace_root;
            })
            .map((root) => root.uri);

          workspace_folders.forEach((root) => {
            void provision_queue.push(root).catch((err) => console.error(err));
          });
          break;
        }
        case config.AutoStartBehaviour.FileOpened: {
          vscode.workspace.textDocuments.forEach((document) => {
            void provision_queue.push(document).catch((err) => console.error(err));
          });
          break;
        }
      }

      params.context.subscriptions.push(
        /**
         * We setup a listener for the active editor changing and use that to update the status bar with the
         * status of the LSP server related to the currently active document.
         */
        vscode.window.onDidChangeActiveTextEditor((event) => {
          updateStatusBar();
        }),

        vscode.workspace.onDidChangeWorkspaceFolders((event) => {
          event.removed.forEach((folder) => {
            clients.forEach((client, dir) => {
              const relative = path.relative(folder.uri.path, dir);
              if ((relative && !relative.includes('../')) || dir === folder.uri.path) {
                console.log(
                  `Shutting down the LSP client at ${dir} as it belongs to a removed workspace`
                );
                void client.stop().catch((err) => console.error(err));
              }
            });
          });

          if (config.getAutoStartBehaviour() === config.AutoStartBehaviour.WorkspaceOpened) {
            void Promise.allSettled(
              event.added.map(async (folder) => {
                if (await project_utils.isValidClojureProject(folder.uri)) {
                  void provision_queue.push(folder.uri).catch((err) => console.error(err));
                }
              })
            );
          }
        })
      );

      params.context.subscriptions.push(
        ...commands.registerLspCommands(clients),
        ...commands.registerEventHandlers(),

        ...commands.registerVSCodeCommands({
          clients,
          context: params.context,
          handleStartRequest: (uri) => {
            return provision_queue.push(uri);
          },
        })
      );
    },

    /**
     * Remove the status bar item and shutdown all LSP clients
     */
    shutdown: async () => {
      status_bar_item.dispose();
      await Promise.allSettled(Array.from(clients.values()).map((client) => client.stop()));
    },
  };
};

export type ClientProvider = ReturnType<typeof createClientProvider>;
