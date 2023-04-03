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
import * as docMirror from '../doc-mirror/index';
import { EditableDocument } from '../cursor-doc/model';
import { assertIsDefined } from '../utilities';
import * as config from '../formatter-config';

const onPareditKeyMapChangedEmitter = new EventEmitter<string>();

const languages = new Set(['clojure', 'lisp', 'scheme']);
const enabled = true;

/**
 * Copies the text represented by the range from doc to the clipboard.
 * @param doc
 * @param range
 */
async function copyRangeToClipboard(doc: EditableDocument, [start, end]) {
  const text = doc.model.getText(start, end);
  await vscode.env.clipboard.writeText(text);
}

/**
 * Answers true when `calva.paredit.killAlsoCutsToClipboard` is enabled.
 * @returns boolean
 */
function shouldKillAlsoCutToClipboard() {
  return workspace.getConfiguration().get('calva.paredit.killAlsoCutsToClipboard');
}

type PareditCommand = {
  command: string;
  handler: (doc: EditableDocument) => void | Promise<any>;
};
const pareditCommands: PareditCommand[] = [
  // NAVIGATING
  {
    command: 'paredit.forwardSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(doc, paredit.forwardSexpRange(doc));
    },
  },
  {
    command: 'paredit.backwardSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(doc, paredit.backwardSexpRange(doc));
    },
  },
  {
    command: 'paredit.forwardDownSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(doc, paredit.rangeToForwardDownList(doc));
    },
  },
  {
    command: 'paredit.backwardDownSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(doc, paredit.rangeToBackwardDownList(doc));
    },
  },
  {
    command: 'paredit.forwardUpSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(doc, paredit.rangeToForwardUpList(doc));
    },
  },
  {
    command: 'paredit.backwardUpSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(doc, paredit.rangeToBackwardUpList(doc));
    },
  },
  {
    command: 'paredit.forwardSexpOrUp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(doc, paredit.forwardSexpOrUpRange(doc));
    },
  },
  {
    command: 'paredit.backwardSexpOrUp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(doc, paredit.backwardSexpOrUpRange(doc));
    },
  },
  {
    command: 'paredit.closeList',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(doc, paredit.rangeToForwardList(doc));
    },
  },
  {
    command: 'paredit.openList',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(doc, paredit.rangeToBackwardList(doc));
    },
  },

  // SELECTING
  {
    command: 'paredit.rangeForDefun',
    handler: (doc: EditableDocument) => {
      paredit.selectRange(doc, paredit.rangeForDefun(doc));
    },
  },
  {
    command: 'paredit.sexpRangeExpansion',
    handler: paredit.growSelection,
  }, // TODO: Inside string should first select contents
  {
    command: 'paredit.sexpRangeContraction',
    handler: paredit.shrinkSelection,
  },

  {
    command: 'paredit.selectForwardSexp',
    handler: paredit.selectForwardSexp,
  },
  {
    command: 'paredit.selectRight',
    handler: paredit.selectRight,
  },
  {
    command: 'paredit.selectBackwardSexp',
    handler: paredit.selectBackwardSexp,
  },
  {
    command: 'paredit.selectForwardDownSexp',
    handler: paredit.selectForwardDownSexp,
  },
  {
    command: 'paredit.selectBackwardDownSexp',
    handler: paredit.selectBackwardDownSexp,
  },
  {
    command: 'paredit.selectForwardUpSexp',
    handler: paredit.selectForwardUpSexp,
  },
  {
    command: 'paredit.selectForwardSexpOrUp',
    handler: paredit.selectForwardSexpOrUp,
  },
  {
    command: 'paredit.selectBackwardSexpOrUp',
    handler: paredit.selectBackwardSexpOrUp,
  },
  {
    command: 'paredit.selectBackwardUpSexp',
    handler: paredit.selectBackwardUpSexp,
  },
  {
    command: 'paredit.selectCloseList',
    handler: paredit.selectCloseList,
  },
  {
    command: 'paredit.selectOpenList',
    handler: paredit.selectOpenList,
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
        return paredit.spliceSexp(doc, doc.selection.active, false);
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
        return paredit.spliceSexp(doc, doc.selection.active, false);
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
      return paredit.rewrapSexpr(doc, '(', ')');
    },
  },
  {
    command: 'paredit.rewrapSquare',
    handler: (doc: EditableDocument) => {
      return paredit.rewrapSexpr(doc, '[', ']');
    },
  },
  {
    command: 'paredit.rewrapCurly',
    handler: (doc: EditableDocument) => {
      return paredit.rewrapSexpr(doc, '{', '}');
    },
  },
  {
    command: 'paredit.rewrapSet',
    handler: (doc: EditableDocument) => {
      return paredit.rewrapSexpr(doc, '#{', '}');
    },
  },
  {
    command: 'paredit.rewrapQuote',
    handler: (doc: EditableDocument) => {
      return paredit.rewrapSexpr(doc, '"', '"');
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
];

function wrapPareditCommand(command: PareditCommand) {
  return async () => {
    try {
      const textEditor = window.activeTextEditor;

      assertIsDefined(textEditor, 'Expected window to have an activeTextEditor!');

      const mDoc: EditableDocument = docMirror.getDocument(textEditor.document);
      if (!enabled || !languages.has(textEditor.document.languageId)) {
        return;
      }
      return command.handler(mDoc);
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
    )
  );
}

export function deactivate() {
  // do nothing
}

export const onPareditKeyMapChanged: Event<string> = onPareditKeyMapChangedEmitter.event;
