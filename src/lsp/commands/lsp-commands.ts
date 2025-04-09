import * as vscode_lsp from 'vscode-languageclient/node';
import * as calva_utils from '../../utilities';
import * as defs from '../definitions';
import * as vscode from 'vscode';
import * as api from '../api';
import * as _ from 'lodash';

const RESOLVE_MACRO_AS_COMMAND = 'resolve-macro-as';

type BaseLspCommand = {
  command: string;
  category?: string;
};

// If afterCommandFn is defined, then defaultName must be too
type ClojureLspCommand = BaseLspCommand &
  (
    | {
        afterCommandFn: (
          commandArgs: Array<string | number>,
          commandResponse: Record<string, unknown>
        ) => Thenable<any>;
        defaultName: string;
      }
    | {
        defaultName?: string;
        afterCommandFn?: never;
      }
  );

type LSPCommandHandlerParams = {
  clients: defs.LspClientStore;
  args: any[];
};
type LSPCommandHandler = (params: LSPCommandHandlerParams) => Promise<void> | void;

async function renameAfterRefactor(
  commandArgs: Array<string | number>,
  commandResponse: vscode_lsp.WorkspaceEdit
) {
  if (commandArgs[3] !== this.defaultName) {
    return;
  }

  let uri, line, character;
  for (const change of commandResponse.documentChanges) {
    //This will never be hit, but it's necessary to convince typescript that we have a
    //TextDocumentEdit and not any of the other union members
    if (!('textDocument' in change)) {
      throw new Error(
        `renameAfterRefactor is not a valid afterCommandFn for event ${this.command}`
      );
    }

    uri = change.textDocument.uri;

    // If a previous change added new lines, then edit.range.start.line will be the *old* line
    // number. Keep track of the number of lines that have been inserted as we go through the edits
    // to keep the line numbers in sync.
    let lineOffset = 0;

    for (const edit of change.edits) {
      // Pad out the beginning of newText to align it with the original line so that the index of
      // the matched substring is the same as the index of the substring in the document
      const newText = ' '.repeat(edit.range.start.character) + edit.newText;

      const lines = newText.split('\n');

      for (const [lineNo, lineText] of lines.entries()) {
        const match = lineText.match(new RegExp(`\\b${this.defaultName}\\b`));

        if (match) {
          line = edit.range.start.line + lineOffset + lineNo;
          character = match.index;
        }
      }

      lineOffset += Math.max(0, lines.length - 1);
    }
  }

  await vscode.commands.executeCommand('editor.action.rename', [
    vscode.Uri.parse(uri),
    new vscode.Position(line, character),
  ]);

  return commandResponse;
}

const clojureLspCommands: ClojureLspCommand[] = [
  { command: 'add-import-to-namespace', category: 'clojureLsp.refactor' },
  { command: 'add-missing-import', category: 'clojureLsp.refactor' },
  { command: 'add-missing-libspec', category: 'clojureLsp.refactor' },
  { command: 'add-require-suggestion', category: 'clojureLsp.refactor' },
  { command: 'change-coll', category: 'clojureLsp.refactor' },
  { command: 'clean-ns', category: 'clojureLsp.refactor' },
  { command: 'create-function', category: 'clojureLsp.refactor' },
  { command: 'create-test', category: 'clojureLsp.refactor' },
  { command: 'cycle-coll', category: 'clojureLsp.refactor' },
  { command: 'cycle-keyword-auto-resolve', category: 'clojureLsp.refactor' },
  { command: 'cycle-privacy', category: 'clojureLsp.refactor' },
  { command: 'demote-fn', category: 'clojureLsp.refactor' },
  { command: 'destructure-keys', category: 'clojureLsp.refactor' },
  { command: 'drag-backward', category: 'clojureLsp.refactor' },
  { command: 'drag-forward', category: 'clojureLsp.refactor' },
  { command: 'drag-param-backward', category: 'clojureLsp' },
  { command: 'drag-param-forward', category: 'clojureLsp' },
  { command: 'expand-let', category: 'clojureLsp.refactor' },
  { command: 'get-in-all', category: 'clojureLsp.refactor' },
  { command: 'get-in-less', category: 'clojureLsp.refactor' },
  { command: 'get-in-more', category: 'clojureLsp.refactor' },
  { command: 'get-in-none', category: 'clojureLsp.refactor' },
  { command: 'inline-symbol', category: 'clojureLsp.refactor' },
  { command: 'move-coll-entry-down', category: 'clojureLsp.refactor' },
  { command: 'move-coll-entry-up', category: 'clojureLsp.refactor' },
  { command: 'move-form', category: 'clojureLsp.refactor' },
  { command: 'replace-refer-all-with-alias', category: 'clojureLsp.refactor' },
  { command: 'replace-refer-all-with-refer', category: 'clojureLsp.refactor' },
  { command: 'resolve-macro-as', category: 'clojureLsp.refactor' },
  { command: 'restructure-keys', category: 'clojureLsp.refactor' },
  { command: 'sort-clauses', category: 'clojureLsp.refactor' },
  { command: 'sort-map', category: 'clojureLsp.refactor' },
  { command: 'suppress-diagnostic', category: 'clojureLsp.refactor' },
  { command: 'thread-first', category: 'clojureLsp.refactor' },
  { command: 'thread-first-all', category: 'clojureLsp.refactor' },
  { command: 'thread-last', category: 'clojureLsp.refactor' },
  { command: 'thread-last-all', category: 'clojureLsp.refactor' },
  { command: 'unwind-all', category: 'clojureLsp.refactor' },
  { command: 'unwind-thread', category: 'clojureLsp.refactor' },

  {
    command: 'introduce-let',
    afterCommandFn: renameAfterRefactor,
    defaultName: 'new-binding',
    category: 'clojureLsp.refactor',
  },
  {
    command: 'move-to-let',
    afterCommandFn: renameAfterRefactor,
    defaultName: 'new-binding',
    category: 'clojureLsp.refactor',
  },
  {
    command: 'extract-function',
    afterCommandFn: renameAfterRefactor,
    defaultName: 'new-fn',
    category: 'clojureLsp.refactor',
  },
  {
    command: 'extract-to-def',
    afterCommandFn: renameAfterRefactor,
    defaultName: 'new-binding',
    category: 'clojureLsp.refactor',
  },

  // Though promote-fn can introduce new names, it only does so sometimes (i.e. on (fn) to (defn),
  // but not on #() to (fn)). The data necessary to determine which promotion is occurring is not in
  // the LSP's arguments or response. Additionally, promoting #() to (fn) can introduce names for
  // the *function arguments* as well, and there's no reasonable way to step through renaming them
  // all. For these reasons, performing auto-renaming with promote-fn will require more thought and
  // probably some changes in clojure-lsp, and it will remain disabled for now.
  {
    command: 'promote-fn',
    // afterCommandFn: renameAfterRefactor,
    // defaultName: 'new-fn',
    category: 'clojureLsp.refactor',
  },
];

function sendCommandRequest(
  clients: defs.LspClientStore,
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

  const cmdSpec = clojureLspCommands.filter((c) => c.command === command)[0];

  client
    .sendRequest(vscode_lsp.ExecuteCommandRequest.type, {
      command,
      arguments: args,
    })
    .then(cmdSpec?.afterCommandFn ? (response) => cmdSpec.afterCommandFn(args, response) : (x) => x)
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

  const line = editor.selections[0].start.line;
  const column = editor.selections[0].start.character;
  const doc_uri = `${document.uri.scheme}://${document.uri.path}`;
  return [doc_uri, line, column];
};

function registerUserspaceLspCommand(
  clients: defs.LspClientStore,
  command: ClojureLspCommand
): vscode.Disposable {
  const category = command.category ? command.category : 'clojureLsp.refactor';
  const vscodeCommand = `${category}.${command.command.replace(/-[a-z]/g, (m) =>
    m.substring(1).toUpperCase()
  )}`;
  return vscode.commands.registerCommand(vscodeCommand, () => {
    const params = getLSPCommandParams();
    if (!params) {
      return;
    }

    // For commands that introduce new names (e.g. move-to-let):
    // The LSP command takes an optional 4th arg for the value of the new name. Use the specified
    // default rather than letting clojure-lsp pick a name so that when we trigger a rename action
    // after the command completes, we know what to rename.
    if (command.defaultName) {
      params[3] = command.defaultName;
    }

    sendCommandRequest(clients, command.command, params);
  });
}

function registerInternalLspCommand(
  clients: defs.LspClientStore,
  command: ClojureLspCommand
): vscode.Disposable {
  return vscode.commands.registerCommand(command.command, (...args) => {
    // This handler is only called for quick-fix commands (when the user clicks the lightbulb icon).
    // For commands that introduce new names (e.g. move-to-let), clojure-lsp always sends back a
    // default name. Replace that name with our own default so we know what to look for when we
    // trigger a rename action on it afterwards.
    if (command.defaultName) {
      args[3] = command.defaultName;
    }

    sendCommandRequest(clients, command.command, args);
  });
}

function sendCommand(clients: defs.LspClientStore, command: string, args?: Array<string | number>) {
  const params = getLSPCommandParams();
  if (!params) {
    return;
  }
  sendCommandRequest(clients, command, [...params, ...(args ? args : [])]);
}

const codeLensReferencesHandler: LSPCommandHandler = async (params) => {
  const [_, line, character] = params.args;
  calva_utils.getActiveTextEditor().selections = [
    new vscode.Selection(line - 1, character - 1, line - 1, character - 1),
  ];
  await vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
};

const resolveMacroAsCommandHandler: LSPCommandHandler = (params) => {
  const activeTextEditor = calva_utils.tryToGetActiveTextEditor();
  if (activeTextEditor?.document?.languageId === 'clojure') {
    const documentUri = decodeURIComponent(activeTextEditor.document.uri.toString());
    const { line, character } = activeTextEditor.selections[0].active;
    sendCommandRequest(params.clients, RESOLVE_MACRO_AS_COMMAND, [
      documentUri,
      line + 1,
      character + 1,
    ]);
  }
};

export function registerLspCommands(clients: defs.LspClientStore) {
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
     * The clojure-lsp server previously used to dynamically register all of these top-level commands. However, that behaviour was
     * disabled to add support for provisioning multiple lsp clients in the same vscode window. The built-in behaviour resulted
     * in command registration conflicts.
     *
     * There are several vscode operations (such as organise-imports) which are bound to execute these internal lsp commands which
     * would no longer function if these commands are not correctly registered (as they used to be).
     *
     * We therefore manually register them here with added support for selecting the appropriate active lsp client on execution.
     */
    ...clojureLspCommands.map((command) => registerInternalLspCommand(clients, command)),
    ...[
      vscode.commands.registerCommand('clojure-lsp.command', ([command, args]) =>
        sendCommand(clients, command, args)
      ),
    ],
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
