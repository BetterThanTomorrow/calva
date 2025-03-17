import { StatusBar } from './statusbar';
import * as vscode from 'vscode';
import {
  commands,
  window,
  Event,
  EventEmitter,
  ExtensionContext,
  workspace,
  ConfigurationChangeEvent,
} from 'vscode';
import * as paredit from '../cursor-doc/paredit';
import * as handlers from './commands';
import * as docMirror from '../doc-mirror/index';
import { EditableDocument } from '../cursor-doc/model';
import { assertIsDefined } from '../utilities';
import * as config from '../formatter-config';
import * as textNotation from '../extension-test/unit/common/text-notation';
import * as calvaState from '../state';

const onPareditKeyMapChangedEmitter = new EventEmitter<string>();

const languages = new Set(['clojure', 'lisp', 'scheme']);
const enabled = true;

/**
 * Copies the text represented by the range from doc to the clipboard.
 * @param doc
 * @param range
 */
export async function copyRangeToClipboard(doc: EditableDocument, [start, end]) {
  const text = doc.model.getText(start, end);
  await vscode.env.clipboard.writeText(text);
}

/**
 * Answers true when `calva.paredit.killAlsoCutsToClipboard` is enabled.
 * @returns boolean
 */
function shouldKillAlsoCutToClipboard(override?: boolean): boolean {
  return override ?? workspace.getConfiguration().get('calva.paredit.killAlsoCutsToClipboard');
}

function multiCursorEnabled(override?: boolean): boolean {
  return override ?? workspace.getConfiguration().get('calva.paredit.multicursor');
}

type PareditCommand = {
  command: string;
  handler: (doc: EditableDocument, arg?: any) => void | Promise<any> | Thenable<any>;
};

type PareditCommandNow = {
  command: string;
  handlerNow: (doc: EditableDocument, builder?: vscode.TextEditorEdit) => void;
};

// only grab the custom, additional args after the first doc arg from the given command's handler
type CommandArgOf<C extends PareditCommand> = Parameters<C['handler']>[1];

const pareditCommands = [
  // NAVIGATING
  {
    command: 'paredit.forwardSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.forwardSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.backwardSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.backwardSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.forwardDownSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.forwardDownSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.backwardDownSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.backwardDownSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.forwardUpSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.forwardUpSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.backwardUpSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.backwardUpSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.forwardSexpOrUp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.forwardSexpOrUp(doc, isMulti);
    },
  },
  {
    command: 'paredit.backwardSexpOrUp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.backwardSexpOrUp(doc, isMulti);
    },
  },
  {
    command: 'paredit.closeList',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.closeList(doc, isMulti);
    },
  },
  {
    command: 'paredit.openList',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.openList(doc, isMulti);
    },
  },

  // SELECTING
  {
    command: 'calva.selectCurrentForm', // legacy command id for backward compat
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectCurrentForm(doc, isMulti);
    },
  },
  {
    command: 'paredit.rangeForDefun',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.rangeForDefun(doc, isMulti);
    },
  },
  {
    command: 'paredit.sexpRangeExpansion',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.sexpRangeExpansion(doc, isMulti);
    },
  },
  {
    command: 'paredit.sexpRangeContraction',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.sexpRangeContraction(doc, isMulti);
    },
  },

  {
    command: 'paredit.selectForwardSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectForwardSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectRight',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectRight(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectBackwardSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectForwardDownSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectForwardDownSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardDownSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectBackwardDownSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectForwardUpSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectForwardUpSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectForwardSexpOrUp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectForwardSexpOrUp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardSexpOrUp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectBackwardSexpOrUp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardUpSexp',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectBackwardUpSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectCloseList',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectCloseList(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectOpenList',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      handlers.selectOpenList(doc, isMulti);
    },
  },

  // EDITING
  {
    command: 'paredit.slurpSexpForward',
    handler: paredit.forwardSlurpSexp,
  },
  {
    command: 'paredit.barfSexpForward',
    handler: paredit.forwardBarfSexp,
  },
  {
    command: 'paredit.slurpSexpBackward',
    handler: paredit.backwardSlurpSexp,
  },
  {
    command: 'paredit.barfSexpBackward',
    handler: paredit.backwardBarfSexp,
  },
  {
    command: 'paredit.splitSexp',
    handler: paredit.splitSexp,
  },
  {
    command: 'paredit.joinSexp',
    handler: paredit.joinSexp,
  },
  {
    command: 'paredit.spliceSexp',
    handler: paredit.spliceSexp,
  },
  // ['paredit.transpose', ], // TODO: Not yet implemented
  {
    command: 'paredit.raiseSexp',
    handler: paredit.raiseSexp,
  },
  {
    command: 'paredit.transpose',
    handler: paredit.transpose,
  },
  {
    command: 'paredit.dragSexprBackward',
    handler: paredit.dragSexprBackward,
  },
  {
    command: 'paredit.dragSexprForward',
    handler: paredit.dragSexprForward,
  },
  {
    command: 'paredit.dragSexprBackwardUp',
    handler: paredit.dragSexprBackwardUp,
  },
  {
    command: 'paredit.dragSexprForwardDown',
    handler: paredit.dragSexprForwardDown,
  },
  {
    command: 'paredit.dragSexprForwardUp',
    handler: paredit.dragSexprForwardUp,
  },
  {
    command: 'paredit.dragSexprBackwardDown',
    handler: paredit.dragSexprBackwardDown,
  },
  {
    command: 'paredit.convolute',
    handler: paredit.convolute,
  },
  {
    command: 'paredit.killRight',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      const range = paredit.forwardHybridSexpRange(doc);
      if (shouldKillAlsoCutToClipboard(opts?.copy)) {
        await copyRangeToClipboard(doc, range);
      }
      return paredit.killRange(doc, range);
    },
  },
  {
    command: 'paredit.killLeft',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      return handlers.killLeft(
        doc,
        // TODO: actually implement multicursor
        multiCursorEnabled(),
        shouldKillAlsoCutToClipboard(opts?.copy) ? copyRangeToClipboard : null
      );
    },
  },
  {
    command: 'paredit.killSexpForward',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      const range = paredit.forwardSexpRange(doc);
      if (shouldKillAlsoCutToClipboard(opts?.copy)) {
        await copyRangeToClipboard(doc, range);
      }
      return paredit.killRange(doc, range);
    },
  },
  {
    command: 'paredit.killSexpBackward',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      const range = paredit.backwardSexpRange(doc);
      if (shouldKillAlsoCutToClipboard(opts?.copy)) {
        await copyRangeToClipboard(doc, range);
      }
      return paredit.killRange(doc, range);
    },
  },
  {
    command: 'paredit.killListForward',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      const range = paredit.forwardListRange(doc);
      if (shouldKillAlsoCutToClipboard(opts?.copy)) {
        await copyRangeToClipboard(doc, range);
      }
      return await paredit.killForwardList(doc, range);
    },
  }, // TODO: Implement with killRange
  {
    command: 'paredit.killListBackward',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      const range = paredit.backwardListRange(doc);
      if (shouldKillAlsoCutToClipboard(opts?.copy)) {
        await copyRangeToClipboard(doc, range);
      }
      return await paredit.killBackwardList(doc, range);
    },
  }, // TODO: Implement with killRange
  {
    command: 'paredit.spliceSexpKillForward',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      const range = paredit.forwardListRange(doc);
      if (shouldKillAlsoCutToClipboard(opts?.copy)) {
        await copyRangeToClipboard(doc, range);
      }
      await paredit.killForwardList(doc, range).then((isFulfilled) => {
        return paredit.spliceSexp(doc, doc.selections[0].active, false);
      });
    },
  },
  {
    command: 'paredit.spliceSexpKillBackward',
    handler: async (doc: EditableDocument, opts?: { copy: boolean }) => {
      const range = paredit.backwardListRange(doc);
      if (shouldKillAlsoCutToClipboard(opts?.copy)) {
        await copyRangeToClipboard(doc, range);
      }
      await paredit.killBackwardList(doc, range).then((isFulfilled) => {
        return paredit.spliceSexp(doc, doc.selections[0].active, false);
      });
    },
  },
  {
    command: 'paredit.wrapAroundParens',
    handler: (doc: EditableDocument) => {
      return paredit.wrapSexpr(doc, '(', ')');
    },
  },
  {
    command: 'paredit.wrapAroundSquare',
    handler: (doc: EditableDocument) => {
      return paredit.wrapSexpr(doc, '[', ']');
    },
  },
  {
    command: 'paredit.wrapAroundCurly',
    handler: (doc: EditableDocument) => {
      return paredit.wrapSexpr(doc, '{', '}');
    },
  },
  {
    command: 'paredit.wrapAroundQuote',
    handler: (doc: EditableDocument) => {
      return paredit.wrapSexpr(doc, '"', '"');
    },
  },
  {
    command: 'paredit.rewrapParens',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      return handlers.rewrapParens(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapSquare',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      return handlers.rewrapSquare(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapCurly',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      return handlers.rewrapCurly(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapSet',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      return handlers.rewrapSet(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapQuote',
    handler: (doc: EditableDocument, opts?: { multicursor: boolean }) => {
      const isMulti = multiCursorEnabled(opts?.multicursor);
      return handlers.rewrapQuote(doc, isMulti);
    },
  },
  {
    command: 'paredit.deleteForward',
    handlerNow: (doc: EditableDocument, builder: vscode.TextEditorEdit) => {
      paredit.deleteForward(doc, builder);
    },
  },
  {
    command: 'paredit.deleteBackward',
    handlerNow: (doc: EditableDocument, builder: vscode.TextEditorEdit) => {
      paredit.backspace(doc, builder, config.getConfigNow());
    },
  },
  {
    command: 'paredit.forceDeleteForward',
    handler: () => {
      return vscode.commands.executeCommand('deleteRight');
    },
  },
  {
    command: 'paredit.forceDeleteBackward',
    handler: () => {
      return vscode.commands.executeCommand('deleteLeft');
    },
  },
  {
    command: 'paredit.addRichComment',
    handler: async (doc: EditableDocument) => {
      await paredit.addRichComment(doc);
    },
  },
  {
    command: 'paredit.insertSemiColon',
    handler: async (doc: EditableDocument) => {
      await paredit.insertSemiColon(doc);
    },
  },
] as const;
// prefer next line if we upgrade to TS v4.9+
//  ] as const satisfies readonly PareditCommand[];

function wrapPareditCommand<C extends PareditCommand>(command: C) {
  return async (arg: CommandArgOf<C>) => {
    try {
      const textEditor = window.activeTextEditor;

      assertIsDefined(textEditor, 'Expected window to have an activeTextEditor!');

      const mDoc: EditableDocument = docMirror.getDocument(textEditor.document);
      if (!enabled || !languages.has(textEditor.document.languageId)) {
        return;
      }
      return command.handler(mDoc, arg);
    } catch (e) {
      console.error(e.message);
    }
  };
}

function wrapPareditCommandNow<C extends PareditCommandNow>(command: C) {
  return (textEditor: vscode.TextEditor, builder: vscode.TextEditorEdit) => {
    try {
      const mDoc: EditableDocument = docMirror.getDocument(textEditor.document);
      if (!enabled || !languages.has(textEditor.document.languageId)) {
        return;
      }
      const model = mDoc.model as docMirror.DocumentModel;
      const staleMessage = model.stale(textEditor.document.version);
      if (!staleMessage) {
        command.handlerNow(mDoc, builder);
      } else {
        console.warn(
          'paredit is skipping ' + command.command + ' because TextDocumentChangeEvent is overdue'
        );
      }
    } catch (e) {
      console.error(e.message);
    }
  };
}

export function getKeyMapConf(): string {
  const keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
  return String(keyMap);
}

function setKeyMapConf() {
  const keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
  void commands.executeCommand('setContext', 'paredit:keyMap', keyMap);
  onPareditKeyMapChangedEmitter.fire(String(keyMap));
}
setKeyMapConf();

export function activate(context: ExtensionContext) {
  const statusBar = new StatusBar(getKeyMapConf());

  context.subscriptions.push(
    statusBar,
    commands.registerCommand('paredit.togglemode', () => {
      let keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
      keyMap = String(keyMap).trim().toLowerCase();
      if (keyMap == 'original') {
        void workspace
          .getConfiguration()
          .update('calva.paredit.defaultKeyMap', 'strict', vscode.ConfigurationTarget.Global);
      } else if (keyMap == 'strict') {
        void workspace
          .getConfiguration()
          .update('calva.paredit.defaultKeyMap', 'original', vscode.ConfigurationTarget.Global);
      }
    }),
    window.onDidChangeActiveTextEditor(
      (e) => e && e.document && languages.has(e.document.languageId)
    ),
    workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
      if (e.affectsConfiguration('calva.paredit.defaultKeyMap')) {
        setKeyMapConf();
      }
    }),
    ...pareditCommands.map((command) => {
      if (command['handler']) {
        return commands.registerCommand(
          command.command,
          wrapPareditCommand(command as PareditCommand)
        );
      } else if (command['handlerNow']) {
        return commands.registerTextEditorCommand(
          command.command,
          wrapPareditCommandNow(command as PareditCommandNow)
        );
      } else {
        return undefined;
      }
    }),
    commands.registerCommand('calva.diagnostics.printTextNotationFromDocument', () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc && doc.languageId === 'clojure') {
        const mirrorDoc = docMirror.getDocument(vscode.window.activeTextEditor?.document);
        const notation = textNotation.textNotationFromDoc(mirrorDoc);
        const chan = calvaState.outputChannel();
        const relPath = vscode.workspace.asRelativePath(doc.uri);
        chan.appendLine(`Text notation for: ${relPath}:\n${notation}`);
      }
    }),
    commands.registerCommand('calva.diagnostics.createDocumentFromTextNotation', async () => {
      const tn = await vscode.window.showInputBox({
        placeHolder: 'Text-notation',
        prompt: 'Type the text-notation for the document you want to create',
      });
      const cursorDoc = textNotation.docFromTextNotation(tn);
      await vscode.workspace
        .openTextDocument({ language: 'clojure', content: textNotation.getText(cursorDoc) })
        .then(async (doc) => {
          const editor = await vscode.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: false,
          });
          editor.selections = cursorDoc.selections.map((selection) => {
            const anchor = doc.positionAt(selection.anchor),
              active = doc.positionAt(selection.active);
            return new vscode.Selection(anchor, active);
          });
        });
    })
  );
}

export function deactivate() {
  // do nothing
}

export const onPareditKeyMapChanged: Event<string> = onPareditKeyMapChangedEmitter.event;
