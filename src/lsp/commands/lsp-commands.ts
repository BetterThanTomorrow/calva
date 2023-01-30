import * as vscode_lsp from 'vscode-languageclient/node';
import * as calva_utils from '../../utilities';
import * as defs from '../definitions';
import * as vscode from 'vscode';
import * as api from '../api';

const RESOLVE_MACRO_AS_COMMAND = 'resolve-macro-as';

type ClojureLspCommand = {
  command: string;
  extraParamFn?: () => Thenable<string>;
  category?: string;
};

type LSPCommandHandlerParams = {
  clients: defs.LSPClientMap;
  args: any[];
};
type LSPCommandHandler = (params: LSPCommandHandlerParams) => Promise<void> | void;

function makePromptForInput(placeHolder: string) {
  return async () => {
    return await vscode.window.showInputBox({
      value: '',
      placeHolder: placeHolder,
      validateInput: (input) => (input.trim() === '' ? 'Empty input' : null),
    });
  };
}

function sendCommandRequest(
  clients: defs.LSPClientMap,
  command: string,
  args: (number | string)[]
): void {
  const document = vscode.window.activeTextEditor?.document;
  if (!document) {
    return;
  }
  const client = api.getClientForDocumentUri(clients, document.uri);
  if (!client) {
    void vscode.window
      .showInformationMessage(
        `The clojure-lsp is currently stopped and not able to handle refactor operations. To continue using clojure-lsp refactorings you will need to start the server.`,
        { title: 'Start Server' }
      )
      .then((res) => {
        if (res?.title === 'Start Server') {
          void vscode.commands.executeCommand('calva.clojureLsp.start');
        }
      });

    return;
  }

  client
    .sendRequest(vscode_lsp.ExecuteCommandRequest.type, {
      command,
      arguments: args,
    })
    .catch((error) => {
      return client.handleFailedRequest(
        vscode_lsp.ExecuteCommandRequest.type,
        undefined,
        error,
        undefined
      );
    })
    .catch((e) => {
      console.error('Failed to execute lsp command', e);
    });
}

const getLSPCommandParams = () => {
  const editor = calva_utils.getActiveTextEditor();
  const document = calva_utils.tryToGetDocument(editor.document);
  if (!document || document.languageId !== 'clojure') {
    return;
  }

  const line = editor.selection.start.line;
  const column = editor.selection.start.character;
  const doc_uri = `${document.uri.scheme}://${document.uri.path}`;
  return [doc_uri, line, column];
};

function registerUserspaceLspCommand(
  clients: defs.LSPClientMap,
  command: ClojureLspCommand
): vscode.Disposable {
  const category = command.category ? command.category : 'clojureLsp.refactor';
  const vscodeCommand = `${category}.${command.command.replace(/-[a-z]/g, (m) =>
    m.substring(1).toUpperCase()
  )}`;
  return vscode.commands.registerCommand(vscodeCommand, async () => {
    const params = getLSPCommandParams();
    if (!params) {
      return;
    }

    const extraParam = command.extraParamFn ? await command.extraParamFn() : undefined;
    if (command.extraParamFn && !extraParam) {
      return;
    }

    sendCommandRequest(clients, command.command, extraParam ? [...params, extraParam] : params);
  });
}

function registerInternalLspCommand(
  clients: defs.LSPClientMap,
  command: ClojureLspCommand
): vscode.Disposable {
  return vscode.commands.registerCommand(command.command, (...args) => {
    sendCommandRequest(clients, command.command, args);
  });
}

const codeLensReferencesHandler: LSPCommandHandler = async (params) => {
  const [_, line, character] = params.args;
  calva_utils.getActiveTextEditor().selection = new vscode.Selection(
    line - 1,
    character - 1,
    line - 1,
    character - 1
  );
  await vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
};

const resolveMacroAsCommandHandler: LSPCommandHandler = (params) => {
  const activeTextEditor = calva_utils.tryToGetActiveTextEditor();
  if (activeTextEditor?.document?.languageId === 'clojure') {
    const documentUri = decodeURIComponent(activeTextEditor.document.uri.toString());
    const { line, character } = activeTextEditor.selection.active;
    sendCommandRequest(params.clients, RESOLVE_MACRO_AS_COMMAND, [
      documentUri,
      line + 1,
      character + 1,
    ]);
  }
};

export function registerLspCommands(clients: defs.LSPClientMap) {
  const generalCommands = [
    {
      // The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens for a symbol
      name: 'code-lens-references',
      handler: codeLensReferencesHandler,
    },
    {
      name: 'calva.linting.resolveMacroAs',
      handler: resolveMacroAsCommandHandler,
    },
  ];

  const clojureLspCommands: ClojureLspCommand[] = [
    { command: 'add-import-to-namespace' },
    { command: 'add-missing-import' },
    { command: 'add-missing-libspec' },
    { command: 'add-require-suggestion' },
    { command: 'change-coll' },
    { command: 'clean-ns' },
    { command: 'create-function' },
    { command: 'create-test' },
    { command: 'cycle-coll' },
    { command: 'cycle-keyword-auto-resolve' },
    { command: 'cycle-privacy' },
    { command: 'demote-fn' },
    { command: 'destructure-keys' },
    { command: 'drag-backward', category: 'clojureLsp' },
    { command: 'drag-forward', category: 'clojureLsp' },
    { command: 'drag-param-backward' },
    { command: 'drag-param-forward' },
    { command: 'expand-let' },
    { command: 'extract-to-def' },
    { command: 'get-in-all' },
    { command: 'get-in-less' },
    { command: 'get-in-more' },
    { command: 'get-in-none' },
    { command: 'inline-symbol' },
    { command: 'move-coll-entry-down' },
    { command: 'move-coll-entry-up' },
    { command: 'move-form' },
    { command: 'promote-fn' },
    { command: 'resolve-macro-as' },
    { command: 'restructure-keys' },
    { command: 'sort-clauses' },
    { command: 'sort-map' },
    { command: 'suppress-diagnostic' },
    { command: 'thread-first' },
    { command: 'thread-first-all' },
    { command: 'thread-last' },
    { command: 'thread-last-all' },
    { command: 'unwind-all' },
    { command: 'unwind-thread' },

    {
      command: 'introduce-let',
      extraParamFn: makePromptForInput('Bind to'),
    },
    {
      command: 'move-to-let',
      extraParamFn: makePromptForInput('Bind to'),
    },
    {
      command: 'extract-function',
      extraParamFn: makePromptForInput('Function name'),
    },
  ];

  return [
    ...generalCommands.map((command) => {
      return vscode.commands.registerCommand(command.name, (...args) => {
        return command.handler({
          clients,
          args,
        });
      });
    }),

    ...clojureLspCommands.map((command) => registerUserspaceLspCommand(clients, command)),

    /**
     * The clojure-lsp server previously used to dynamically register all of these top-level commands however that behaviour was
     * disabled to add support for provisioning multiple lsp clients in the same vscode window. The built-in behaviour resulted
     * in command registration conflicts.
     *
     * There are several vscode operations (such as organise-imports) which are bound to execute these internal lsp commands which
     * would no longer function if these commands are not correctly registered (as they used to be).
     *
     * We therefore manually register them here with added support for selecting the appropriate active lsp client on execution.
     */
    ...clojureLspCommands.map((command) => registerInternalLspCommand(clients, command)),
  ];
}

export function registerEventHandlers() {
  return [
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('calva.referencesCodeLens.enabled')) {
        const visibleFileEditors = vscode.window.visibleTextEditors.filter((editor) => {
          return editor.document.uri.scheme === 'file';
        });

        for (const editor of visibleFileEditors) {
          // Hacky solution for triggering codeLens refresh
          // Could not find a better way, aside from possibly changes to clojure-lsp
          // https://github.com/microsoft/vscode-languageserver-node/issues/705
          const edit1 = new vscode.WorkspaceEdit();
          edit1.insert(editor.document.uri, new vscode.Position(0, 0), '\n');
          await vscode.workspace.applyEdit(edit1);
          const edit2 = new vscode.WorkspaceEdit();
          edit2.delete(editor.document.uri, new vscode.Range(0, 0, 1, 0));
          await vscode.workspace.applyEdit(edit2);
        }
      }
    }),
  ];
}
