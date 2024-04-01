'use strict';
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
function shouldKillAlsoCutToClipboard() {
  return workspace.getConfiguration().get<boolean>('calva.paredit.killAlsoCutsToClipboard');
}

function multiCursorEnabled() {
  return workspace.getConfiguration().get<boolean>('calva.paredit.multicursor');
}

type PareditCommand = {
  command: string;
  // do we still need to return Thenable from paredit fns?
  handler: (doc: EditableDocument, arg: any) => void | Promise<any> | Thenable<any>;
};

const pareditCommands: PareditCommand[] = [
  // NAVIGATING
  {
    command: 'paredit.forwardSexp',
    handler: (doc: EditableDocument) => {
      handlers.forwardSexp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.backwardSexp',
    handler: (doc: EditableDocument) => {
      handlers.backwardSexp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.forwardDownSexp',
    handler: (doc: EditableDocument) => {
      handlers.forwardDownSexp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.backwardDownSexp',
    handler: (doc: EditableDocument) => {
      handlers.backwardDownSexp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.forwardUpSexp',
    handler: (doc: EditableDocument) => {
      handlers.forwardUpSexp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.backwardUpSexp',
    handler: (doc: EditableDocument) => {
      handlers.backwardUpSexp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.forwardSexpOrUp',
    handler: (doc: EditableDocument) => {
      handlers.forwardSexpOrUp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.backwardSexpOrUp',
    handler: (doc: EditableDocument) => {
      handlers.backwardSexpOrUp(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.closeList',
    handler: (doc: EditableDocument) => {
      handlers.closeList(doc, multiCursorEnabled());
    },
  },
  {
    command: 'paredit.openList',
    handler: (doc: EditableDocument) => {
      handlers.openList(doc, multiCursorEnabled());
    },
  },

  // SELECTING
  {
    command: 'calva.selectCurrentForm', // legacy command id for backward compat
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectCurrentForm(doc, isMulti);
    },
  },
  {
    command: 'paredit.rangeForDefun',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.rangeForDefun(doc, isMulti);
    },
  },
  {
    command: 'paredit.sexpRangeExpansion',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.sexpRangeExpansion(doc, isMulti);
    },
  },
  {
    command: 'paredit.sexpRangeContraction',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.sexpRangeContraction(doc, isMulti);
    },
  },

  {
    command: 'paredit.selectForwardSexp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectForwardSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectRight',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectRight(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardSexp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectBackwardSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectForwardDownSexp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectForwardDownSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardDownSexp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectBackwardDownSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectForwardUpSexp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectForwardUpSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectForwardSexpOrUp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectForwardSexpOrUp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardSexpOrUp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectBackwardSexpOrUp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectBackwardUpSexp',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectBackwardUpSexp(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectCloseList',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      handlers.selectCloseList(doc, isMulti);
    },
  },
  {
    command: 'paredit.selectOpenList',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
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
    handler: async (doc: EditableDocument) => {
      const range = paredit.forwardHybridSexpRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
        await copyRangeToClipboard(doc, range);
      }
      return paredit.killRange(doc, range);
    },
  },
  {
    command: 'paredit.killLeft',
    handler: async (doc: EditableDocument) => {
      // TODO: support multicursor
      return handlers.killLeft(
        doc,
        // TODO: actually implement multicursor
        multiCursorEnabled(),
        shouldKillAlsoCutToClipboard() ? copyRangeToClipboard : null
      );
    },
  },
  {
    command: 'paredit.killSexpForward',
    handler: async (doc: EditableDocument) => {
      const range = paredit.forwardSexpRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
        await copyRangeToClipboard(doc, range);
      }
      return paredit.killRange(doc, range);
    },
  },
  {
    command: 'paredit.killSexpBackward',
    handler: async (doc: EditableDocument) => {
      const range = paredit.backwardSexpRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
        await copyRangeToClipboard(doc, range);
      }
      return paredit.killRange(doc, range);
    },
  },
  {
    command: 'paredit.killListForward',
    handler: async (doc: EditableDocument) => {
      const range = paredit.forwardListRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
        await copyRangeToClipboard(doc, range);
      }
      return await paredit.killForwardList(doc, range);
    },
  }, // TODO: Implement with killRange
  {
    command: 'paredit.killListBackward',
    handler: async (doc: EditableDocument) => {
      const range = paredit.backwardListRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
        await copyRangeToClipboard(doc, range);
      }
      return await paredit.killBackwardList(doc, range);
    },
  }, // TODO: Implement with killRange
  {
    command: 'paredit.spliceSexpKillForward',
    handler: async (doc: EditableDocument) => {
      const range = paredit.forwardListRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
        await copyRangeToClipboard(doc, range);
      }
      await paredit.killForwardList(doc, range).then((isFulfilled) => {
        return paredit.spliceSexp(doc, doc.selections[0].active, false);
      });
    },
  },
  {
    command: 'paredit.spliceSexpKillBackward',
    handler: async (doc: EditableDocument) => {
      const range = paredit.backwardListRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
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
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      return handlers.rewrapParens(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapSquare',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      return handlers.rewrapSquare(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapCurly',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      return handlers.rewrapCurly(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapSet',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      return handlers.rewrapSet(doc, isMulti);
    },
  },
  {
    command: 'paredit.rewrapQuote',
    handler: (doc: EditableDocument) => {
      const isMulti = multiCursorEnabled();
      return handlers.rewrapQuote(doc, isMulti);
    },
  },
  {
    command: 'paredit.deleteForward',
    handler: async (doc: EditableDocument) => {
      await paredit.deleteForward(doc);
    },
  },
  {
    command: 'paredit.deleteBackward',
    handler: async (doc: EditableDocument) => {
      await paredit.backspace(doc, await config.getConfig());
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
];

function wrapPareditCommand(command: PareditCommand) {
  return async (arg) => {
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
    ...pareditCommands.map((command) =>
      commands.registerCommand(command.command, wrapPareditCommand(command))
    ),
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
