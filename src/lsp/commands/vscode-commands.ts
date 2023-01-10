import * as vscode_lsp from 'vscode-languageclient/node';
import * as project_utils from '../../project-root';
import * as downloader from '../client/downloader';
import * as defs from '../definitions';
import * as state from '../../state';
import * as vscode from 'vscode';
import * as api from '../api';

export const filterOutRootsWithClients = (
  uris: project_utils.ProjectRoot[],
  clients: defs.LSPClientMap
) => {
  return uris.filter((root) => {
    return !clients.has(root.uri.path);
  });
};

/**
 * Handle the start lsp command.
 *
 * This will search for and list all Clojure project roots in the active workspace, allowing the user to pick the
 * root they would like to start an LSP server under. All clojure files at and below this root will be served by
 * this LSP client.
 */
const startHandler = async (
  clients: defs.LSPClientMap,
  handler: (uri: vscode.Uri) => Promise<void>
) => {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.languageId !== 'clojure') {
    return;
  }

  // Find the furthest valid root, excluding workspace folders (unless they are also valid roots).
  const valid_project_roots = await project_utils
    .findProjectRootsWithReasons({
      include_workspace_folders: false,
    })
    .then((roots) => {
      return filterOutRootsWithClients(roots, clients).map((root) => root.uri);
    });
  const selected = project_utils.findFurthestParent(document.uri, valid_project_roots);

  const roots = await project_utils.findProjectRootsWithReasons().then((roots) => {
    return filterOutRootsWithClients(roots, clients);
  });

  const selected_root = await project_utils.pickProjectRoot(roots, selected);
  if (!selected_root) {
    return;
  }

  await handler(selected_root);
};

const pickClient = async (
  clients: defs.LSPClientMap
): Promise<undefined | [string, vscode_lsp.LanguageClient]> => {
  if (clients.size === 0) {
    return;
  }
  if (clients.size === 1) {
    return Array.from(clients.entries())[0];
  }
  const choices = Array.from(clients.keys()).map((uri) => {
    return {
      label: uri,
    };
  });
  const selected_client = await vscode.window.showQuickPick(choices, { title: 'clojure-lsp' });
  if (!selected_client) {
    return;
  }
  return [selected_client.label, clients.get(selected_client.label)];
};

const stopHandler = async (clients: defs.LSPClientMap) => {
  const res = await pickClient(clients);
  if (!res) {
    return;
  }
  const [id, client] = res;
  client?.stop().catch((err) => {
    console.error(`Failed to stop client ${id}`, err);
  });
};

const restartHandler = async (
  clients: defs.LSPClientMap,
  startHandler: (uri: vscode.Uri) => Promise<void>
) => {
  const res = await pickClient(clients);
  if (!res) {
    return;
  }
  const [id, client] = res;

  await client?.stop().catch((err) => {
    console.error(`Failed to stop client ${id}`, err);
  });

  clients.delete(id);

  await startHandler(vscode.Uri.parse(id));
};

async function serverInfoHandler(clients: defs.LSPClientMap) {
  const res = await pickClient(clients);
  if (!res) {
    return;
  }
  const [, client] = res;

  const serverInfo = await api.getServerInfo(client);
  const calvaSaysChannel = state.outputChannel();
  calvaSaysChannel.appendLine(`Clojure-lsp server info:`);
  const serverInfoPretty = JSON.stringify(serverInfo, null, 2);
  calvaSaysChannel.appendLine(serverInfoPretty);
  calvaSaysChannel.show(true);
}

async function openLogFileHandler(clients: defs.LSPClientMap) {
  const res = await pickClient(clients);
  if (!res) {
    return;
  }
  const [, client] = res;

  const serverInfo = await api.getServerInfo(client);
  const logPath = serverInfo['log-path'];
  void vscode.window.showTextDocument(vscode.Uri.file(logPath));
}

function configureTraceLogLevelHandler() {
  void vscode.commands.executeCommand('workbench.action.openSettings', 'clojure.trace.server');
}

const showMenuHandler = async () => {
  const items = [
    {
      label: 'Start',
      description: 'Start a clojure-lsp server at a directory',
      value: 'calva.clojureLsp.start',
    },
    {
      label: 'Stop',
      description: 'Stop a running clojure-lsp server',
      value: 'calva.clojureLsp.stop',
    },
    {
      label: 'Restart',
      description: 'Restart a running clojure-lsp server',
      value: 'calva.clojureLsp.restart',
    },
    {
      label: 'Show server info',
      description: 'Print clojure-lsp server info to `Calva says`',
      value: 'calva.diagnostics.clojureLspServerInfo',
    },
    {
      label: 'Open log',
      description: 'Open the clojure-lsp log file',
      value: 'calva.diagnostics.openClojureLspLogFile',
    },
    {
      label: 'Open Trace Level Settings',
      description: 'Opens the client/server trace level in VS Code Settings',
      value: 'calva.diagnostics.showLspTraceLevelSettings',
    },
  ];

  const choice = await vscode.window.showQuickPick(items, { title: 'clojure-lsp' });
  if (!choice) {
    return;
  }

  await vscode.commands.executeCommand(choice.value);
};

type RegisterCommandsParams = {
  clients: defs.LSPClientMap;
  context: vscode.ExtensionContext;
  handleStartRequest: (uri: vscode.Uri) => Promise<void>;
};
export const registerVSCodeCommands = (params: RegisterCommandsParams) => {
  return [
    vscode.commands.registerCommand('calva.clojureLsp.start', () => {
      startHandler(params.clients, params.handleStartRequest).catch((err) =>
        console.error('Failed to run start command', err)
      );
    }),
    vscode.commands.registerCommand('calva.clojureLsp.stop', () => {
      stopHandler(params.clients).catch((err) => console.error('Failed to run stop command', err));
    }),
    vscode.commands.registerCommand('calva.clojureLsp.restart', () => {
      restartHandler(params.clients, params.handleStartRequest).catch((err) =>
        console.error('Failed to run restart command', err)
      );
    }),

    vscode.commands.registerCommand('calva.clojureLsp.download', async () => {
      void vscode.window.showInformationMessage(`Downloading clojure-lsp server binary...`);
      const version = await downloader.ensureLSPServer(params.context, true);
      void vscode.window.showInformationMessage(`Downloaded clojure-lsp version: ${version}`);
    }),

    vscode.commands.registerCommand('calva.diagnostics.clojureLspServerInfo', () => {
      serverInfoHandler(params.clients).catch((err) =>
        console.error('Failed to run server info command', err)
      );
    }),

    vscode.commands.registerCommand('calva.diagnostics.openClojureLspLogFile', () => {
      openLogFileHandler(params.clients).catch((err) =>
        console.error('Failed to run open log file', err)
      );
    }),

    vscode.commands.registerCommand(
      'calva.diagnostics.showLspTraceLevelSettings',
      configureTraceLogLevelHandler
    ),

    vscode.commands.registerCommand('calva.clojureLsp.showClojureLspMenu', () => {
      showMenuHandler().catch((err) => console.error('Failed to run lsp menu', err));
    }),
  ];
};
