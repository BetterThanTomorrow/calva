'use strict';
import { StatusBar } from './statusbar';
import * as vscode from 'vscode';
import {
  commands,
  window,
  Event,
  EventEmitter,
  ExtensionContext,
  env,
  workspace,
  ConfigurationChangeEvent,
} from 'vscode';
import * as paredit from '../cursor-doc/paredit';
import * as docMirror from '../doc-mirror/index';
import { EditableDocument, ModelEditResult } from '../cursor-doc/model';
import { assertIsDefined } from '../utilities';
import { textNotationFromDoc } from '../extension-test/unit/common/text-notation';
import * as calvaState from '../state';
const onPareditKeyMapChangedEmitter = new EventEmitter<string>();

const languages = new Set(['clojure', 'lisp', 'scheme']);
const enabled = true;

/**
 * Copies the text represented by the range from doc to the clipboard.
 * @param doc
 * @param range
 */
export function copyRangeToClipboard(doc: EditableDocument, ranges: Array<[number, number]>) {
  // FIXME: This is tricky. Somehow, vsc natively support cut/copy & pasting for multiple selections.
  //        But, how it does so is not known to me at this time.
  //        So, I am using the native copy command for now with only the first range (presumably the primary selection).
  const range = ranges[0];
  const [start, end] = range;
  const text = doc.model.getText(start, end);
  void env.clipboard.writeText(text);
}

/**
 * Answers true when `calva.paredit.killAlsoCutsToClipboard` is enabled.
 * @returns boolean
 */
export function shouldKillAlsoCutToClipboard(): boolean {
  return workspace.getConfiguration().get('calva.paredit.killAlsoCutsToClipboard');
}

type PareditCommand = {
  command: string;
  handler: (doc: EditableDocument) => void | Thenable<void> | Thenable<ModelEditResult>;
};
const pareditCommands: PareditCommand[] = [
  // NAVIGATING
  {
    command: 'paredit.forwardSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(
        doc,
        paredit.forwardSexpRange(
          doc,
          doc.selections.map((s) => s.active)
        )
      );
    },
  },
  {
    command: 'paredit.backwardSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(
        doc,
        paredit.backwardSexpRange(
          doc,
          doc.selections.map((s) => s.active)
        )
      );
    },
  },
  {
    command: 'paredit.forwardDownSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(
        doc,
        doc.selections.map((s) => paredit.rangeToForwardDownList(doc, s.active))
      );
    },
  },
  {
    command: 'paredit.backwardDownSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(
        doc,
        doc.selections.map((s) => paredit.rangeToBackwardDownList(doc, s.active))
      );
    },
  },
  {
    command: 'paredit.forwardUpSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeRight(
        doc,
        doc.selections.map((s) => paredit.rangeToForwardUpList(doc, s.active))
      );
    },
  },
  {
    command: 'paredit.backwardUpSexp',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(
        doc,
        doc.selections.map((s) => paredit.rangeToBackwardUpList(doc, s.active))
      );
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
      paredit.moveToRangeRight(
        doc,
        doc.selections.map((s) => paredit.rangeToForwardList(doc, s.active))
      );
    },
  },
  {
    command: 'paredit.openList',
    handler: (doc: EditableDocument) => {
      paredit.moveToRangeLeft(
        doc,
        doc.selections.map((s) => paredit.rangeToBackwardList(doc, s.active))
      );
    },
  },

  // SELECTING
  {
    command: 'paredit.rangeForDefun',
    handler: (doc: EditableDocument) => {
      paredit.selectRange(
        doc,
        doc.selections.map((selection) => paredit.rangeForDefun(doc, selection.active))
      );
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
    handler: (doc: EditableDocument) => {
      const ranges = paredit.forwardHybridSexpRange(doc);
      if (shouldKillAlsoCutToClipboard()) {
        copyRangeToClipboard(doc, ranges);
      }
      return paredit.killRange(doc, ranges);
    },
  },
  {
    command: 'paredit.killSexpForward',
    handler: (doc: EditableDocument) =>
      paredit.killSexpForward(doc, shouldKillAlsoCutToClipboard, copyRangeToClipboard),
  },
  {
    command: 'paredit.killSexpBackward',
    handler: (doc: EditableDocument) =>
      paredit.killSexpBackward(doc, shouldKillAlsoCutToClipboard, copyRangeToClipboard),
  },
  {
    command: 'paredit.killListForward',
    handler: (doc: EditableDocument) => {
      const ranges = doc.selections.map((s) => paredit.forwardListRange(doc, s.active));

      if (shouldKillAlsoCutToClipboard()) {
        copyRangeToClipboard(doc, ranges);
      }
      void paredit.killForwardList(doc, ranges);
    },
  }, // TODO: Implement with killRange
  {
    command: 'paredit.killListBackward',
    handler: (doc: EditableDocument) => {
      const ranges = doc.selections.map((s) => paredit.backwardListRange(doc, s.active));
      if (shouldKillAlsoCutToClipboard()) {
        copyRangeToClipboard(doc, ranges);
      }
      return ranges;
      void paredit.killBackwardList(doc, ranges);
    },
  }, // TODO: Implement with killRange
  {
    command: 'paredit.spliceSexpKillForward',
    handler: (doc: EditableDocument) => {
      const ranges = doc.selections.map((s) => paredit.forwardListRange(doc, s.active));

      if (shouldKillAlsoCutToClipboard()) {
        copyRangeToClipboard(doc, ranges);
      }
      return ranges;
      void paredit.killForwardList(doc, ranges).then(() => {
        return paredit.spliceSexp(doc, /* s.active, */ false);
      });
    },
  },
  {
    command: 'paredit.spliceSexpKillBackward',
    handler: (doc: EditableDocument) => {
      const ranges = doc.selections.map((s) => paredit.backwardListRange(doc, s.active));

      if (shouldKillAlsoCutToClipboard()) {
        copyRangeToClipboard(doc, ranges);
      }
      void paredit.killBackwardList(doc, ranges).then(() => {
        return paredit.spliceSexp(doc, /* s.active, */ false);
      });
    },
  },
  {
    command: 'paredit.wrapAroundParens',
    handler: (doc: EditableDocument) => {
      void paredit.wrapSexpr(doc, '(', ')');
    },
  },
  {
    command: 'paredit.wrapAroundSquare',
    handler: (doc: EditableDocument) => {
      void paredit.wrapSexpr(doc, '[', ']');
    },
  },
  {
    command: 'paredit.wrapAroundCurly',
    handler: (doc: EditableDocument) => {
      void paredit.wrapSexpr(doc, '{', '}');
    },
  },
  {
    command: 'paredit.wrapAroundQuote',
    handler: (doc: EditableDocument) => {
      void paredit.wrapSexpr(doc, '"', '"');
    },
  },
  {
    command: 'paredit.rewrapParens',
    handler: (doc: EditableDocument) => {
      void paredit.rewrapSexpr(doc, '(', ')');
    },
  },
  {
    command: 'paredit.rewrapSquare',
    handler: (doc: EditableDocument) => {
      void paredit.rewrapSexpr(doc, '[', ']');
    },
  },
  {
    command: 'paredit.rewrapCurly',
    handler: (doc: EditableDocument) => {
      void paredit.rewrapSexpr(doc, '{', '}');
    },
  },
  {
    command: 'paredit.rewrapQuote',
    handler: (doc: EditableDocument) => {
      void paredit.rewrapSexpr(doc, '"', '"');
    },
  },
  {
    command: 'paredit.deleteForward',
    handler: paredit.deleteForward,
  },
  {
    command: 'paredit.deleteBackward',
    handler: paredit.backspace,
  },
  {
    command: 'paredit.forceDeleteForward',
    handler: () => {
      void vscode.commands.executeCommand('deleteRight');
    },
  },
  {
    command: 'paredit.forceDeleteBackward',
    handler: () => {
      void vscode.commands.executeCommand('deleteLeft');
    },
  },
  {
    command: 'paredit.addRichComment',
    handler: paredit.addRichComment,
  },
];

function wrapPareditCommand(command: PareditCommand) {
  return () => {
    try {
      const textEditor = window.activeTextEditor;

      assertIsDefined(textEditor, 'Expected window to have an activeTextEditor!');

      const mDoc: EditableDocument = docMirror.getDocument(textEditor.document);
      if (!enabled || !languages.has(textEditor.document.languageId)) {
        return;
      }
      void command.handler(mDoc);
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
    commands.registerCommand('calva.diagnostics.printTextNotationFromDocument', () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc && doc.languageId === 'clojure') {
        const mirrorDoc = docMirror.getDocument(vscode.window.activeTextEditor?.document);
        const notation = textNotationFromDoc(mirrorDoc);
        const chan = calvaState.outputChannel();
        const relPath = vscode.workspace.asRelativePath(doc.uri);
        chan.appendLine(`Text notation for: ${relPath}:\n${notation}`);
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
