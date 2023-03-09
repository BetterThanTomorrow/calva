import * as project_utils from '../../project-root';
import * as downloader from '../client/downloader';
import * as defs from '../definitions';
import * as state from '../../state';
import * as utils from '../utils';
import * as vscode from 'vscode';
import * as api from '../api';

export const filterOutRootsWithClients = (
  uris: project_utils.ProjectRoot[],
  clients: defs.LspClientStore
) => {
  return uris.filter((root) => {
    const client = clients.get(root.uri.fsPath);
    return !client || !api.clientIsAlive(client);
  });
};

type StartHandler = (uri: vscode.Uri) => Promise<void>;

/**
 * Handle the start lsp command.
 *
 * This will search for and list all Clojure project roots in the active workspace, allowing the user to pick the
 * root they would like to start an LSP server under. All clojure files at and below this root will be served by
 * this LSP client.
 */
const startHandler = async (clients: defs.LspClientStore, handler: StartHandler, uri?: string) => {
  if (uri) {
    await handler(vscode.Uri.file(uri));
    return;
  }

  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.languageId !== 'clojure') {
    return;
  }

  const roots = await project_utils
    .findProjectRootsWithReasons({ include_lsp_directories: true })
    .then((roots) => {
      return filterOutRootsWithClients(roots, clients);
    });
  const pre_selected = project_utils.findFurthestParent(
    document.uri,
    roots.filter((root) => root.valid_project).map((root) => root.uri)
  );

  const selected_root = await project_utils.pickProjectRoot(
    roots.map((root) => root.uri),
    pre_selected
  );
  if (!selected_root) {
    return;
  }

  await handler(selected_root);
};

const pickClient = async (clients: defs.LspClientStore) => {
  if (clients.size === 0) {
    return;
  }
  if (clients.size === 1) {
    return Array.from(clients.keys())[0];
  }
  const choices = Array.from(clients.keys()).map((id) => {
    return {
      label: id,
    };
  });
  const selected_client = await vscode.window.showQuickPick(choices, { title: 'clojure-lsp' });
  return selected_client?.label;
};

const stopClient = (clients: defs.LspClientStore, id: string) => {
  const client = clients.get(id);
  clients.delete(id);
  return client?.client.stop().catch((err) => {
    console.error(`Failed to stop client ${id}`, err);
  });
};

const stopHandler = async (clients: defs.LspClientStore, uri?: string) => {
  if (uri) {
    void stopClient(clients, uri);
    return;
  }
  const id = await pickClient(clients);
  if (!id) {
    return;
  }
  void stopClient(clients, id);
};

const restartHandler = async (
  clients: defs.LspClientStore,
  startHandler: (uri: vscode.Uri) => Promise<void>,
  uri?: string
) => {
  const id = uri ? uri : await pickClient(clients);
  if (!id) {
    return;
  }

  const client = clients.get(id);
  await stopClient(clients, id);
  clients.delete(id);

  await startHandler(client.uri);
};

async function showServerInfo(clients: defs.LspClientStore, id: string) {
  const client = clients.get(id);

  const serverInfo = await api.getServerInfo(client.client);
  const calvaSaysChannel = state.outputChannel();
  calvaSaysChannel.appendLine(`Clojure-lsp server info:`);
  const serverInfoPretty = JSON.stringify(serverInfo, null, 2);
  calvaSaysChannel.appendLine(serverInfoPretty);
  calvaSaysChannel.show(true);
}

async function openLogFile(clients: defs.LspClientStore, id: string) {
  const client = clients.get(id);

  const serverInfo = await api.getServerInfo(client.client);
  const logPath = serverInfo['log-path'];
  void vscode.window.showTextDocument(vscode.Uri.file(logPath));
}

const downloadServerHandler = async (context: vscode.ExtensionContext) => {
  void vscode.window.showInformationMessage(`Downloading clojure-lsp server binary...`);
  try {
    const path = await downloader.ensureLSPServer(context, true);
    void vscode.window.showInformationMessage(`Downloaded clojure-lsp to: ${path}`);
  } catch (e) {
    void vscode.window.showErrorMessage(`Failed to download clojure-lsp server. ${e}`);
  }
};

function configureTraceLogLevelHandler() {
  void vscode.commands.executeCommand('workbench.action.openSettings', 'clojure.trace.server');
}

const manageHandler = async (
  clients: defs.LspClientStore,
  start: StartHandler,
  context: vscode.ExtensionContext
) => {
  const document = vscode.window.activeTextEditor?.document;
  const roots = await project_utils.findProjectRootsWithReasons({ include_lsp_directories: true });
  let pre_selected: vscode.Uri | undefined;
  if (document) {
    pre_selected = project_utils.findClosestParent(
      document.uri,
      roots.filter((root) => root.valid_project).map((root) => root.uri)
    );
  }

  const inactive_roots = filterOutRootsWithClients(roots, clients)
    .sort((a, b) => {
      if (a.uri.path < b.uri.path) {
        return -1;
      }
      if (a.uri.path > b.uri.path) {
        return 1;
      }
      return 0;
    })
    .map((root) => {
      return {
        label: `$(circle-outline) ${root.label}`,
        value: root.uri.path,
        active: false,
      };
    });

  const active_roots = Array.from(clients.values())
    .filter((client) => api.clientIsAlive(client))
    .map((client) => {
      let icon = '$(circle-filled)';
      if (client.status === defs.LspStatus.Starting) {
        icon = '$(sync~spin)';
      }

      return {
        label: `${icon} ${project_utils.getPathRelativeToWorkspace(client.uri)}`,
        detail: api.isFallbackClient(client)
          ? 'Fallback client for serving workspaces or files that do not belong to a project'
          : undefined,
        value: client.id,
        active: true,
      };
    });

  type Choice = vscode.QuickPickItem & { value?: string; active?: boolean };
  const choices: Choice[] = [];

  if (active_roots.length > 0) {
    choices.push(
      {
        label: 'Active',
        kind: vscode.QuickPickItemKind.Separator,
      },
      ...active_roots
    );
  }

  if (inactive_roots.length > 0) {
    choices.push(
      {
        label: 'Inactive',
        kind: vscode.QuickPickItemKind.Separator,
      },
      ...inactive_roots
    );
  }

  choices.push(
    {
      label: 'General',
      kind: vscode.QuickPickItemKind.Separator,
    },
    {
      label: 'Open trace level settings',
      value: '::trace-settings',
    }
  );
  if (active_roots.length === 0) {
    choices.push({
      label: 'Download latest clojure-lsp version',
      value: '::download',
    });
  }

  const picker = vscode.window.createQuickPick();
  picker.items = choices;
  picker.title = 'clojure-lsp';
  picker.placeholder = 'Pick a Clojure project';

  if (pre_selected) {
    picker.activeItems = choices.filter((choice) => {
      return choice.value === pre_selected?.path;
    });
  }

  picker.show();

  const choice = await new Promise<Choice | undefined>((resolve) => {
    picker.onDidAccept(() => resolve(picker.selectedItems[0]));
    picker.onDidHide(() => resolve(undefined));
  });

  picker.dispose();

  if (!choice) {
    return;
  }

  switch (choice.value) {
    case '::download': {
      void downloadServerHandler(context).catch((err) => console.error(err));
      return;
    }
    case '::trace-settings': {
      configureTraceLogLevelHandler();
      return;
    }
  }

  const action_choices: Array<vscode.QuickPickItem & { value: string }> = [];
  if (choice.active) {
    action_choices.push(
      {
        label: 'Stop',
        value: '::stop',
      },
      {
        label: 'Restart',
        value: '::restart',
      },
      {
        label: 'Show server info',
        value: '::info',
      },
      {
        label: 'Show server logs',
        value: '::logs',
      }
    );
  } else {
    action_choices.push({
      label: 'Start',
      value: '::start',
    });
  }

  const action = await vscode.window.showQuickPick(action_choices, {
    title: `clojure-lsp: ${choice.value}`,
  });
  if (!action) {
    return;
  }

  switch (action.value) {
    case '::start': {
      void start(vscode.Uri.file(choice.value));
      return;
    }
    case '::stop': {
      void stopClient(clients, choice.value);
      return;
    }
    case '::restart': {
      void restartHandler(clients, start, choice.value);
      return;
    }
    case '::info': {
      showServerInfo(clients, choice.value).catch((err) => console.error(err));
      return;
    }
    case '::logs': {
      openLogFile(clients, choice.value).catch((err) => console.error(err));
      return;
    }
  }
};

async function showServerInfoHandler(clients: defs.LspClientStore) {
  const id = await pickClient(clients);
  if (!id) {
    return;
  }
  return showServerInfo(clients, id);
}

async function openLogFileHandler(clients: defs.LspClientStore) {
  const id = await pickClient(clients);
  if (!id) {
    return;
  }
  return openLogFile(clients, id);
}

type RegisterCommandsParams = {
  clients: defs.LspClientStore;
  context: vscode.ExtensionContext;
  handleStartRequest: StartHandler;
};
export const registerVSCodeCommands = (params: RegisterCommandsParams) => {
  return [
    vscode.commands.registerCommand('calva.clojureLsp.start', (uri) => {
      startHandler(params.clients, params.handleStartRequest, uri).catch((err) =>
        console.error('Failed to run start command', err)
      );
    }),
    vscode.commands.registerCommand('calva.clojureLsp.stop', (uri) => {
      stopHandler(params.clients, uri).catch((err) =>
        console.error('Failed to run stop command', err)
      );
    }),
    vscode.commands.registerCommand('calva.clojureLsp.restart', (uri) => {
      restartHandler(params.clients, params.handleStartRequest, uri).catch((err) =>
        console.error('Failed to run restart command', err)
      );
    }),

    vscode.commands.registerCommand('calva.clojureLsp.manage', () => {
      manageHandler(params.clients, params.handleStartRequest, params.context).catch((err) =>
        console.error('Failed to run manage command', err)
      );
    }),

    vscode.commands.registerCommand('calva.clojureLsp.download', () => {
      void downloadServerHandler(params.context);
    }),

    vscode.commands.registerCommand('calva.diagnostics.clojureLspServerInfo', () => {
      showServerInfoHandler(params.clients).catch((err) =>
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
  ];
};
