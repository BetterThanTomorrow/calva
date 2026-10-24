import * as vscode from 'vscode';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as format from './calva-fmt/src/format';
import * as config from './config';
import type * as model from './cursor-doc/model';
import * as paredit from './cursor-doc/paredit';
import * as snippets from './custom-snippets';
import {
  replInputSnippetEvaluation,
  type ReplInputContext,
  type SnippetDefinition,
} from './custom-snippets-catalog';
import * as evaluate from './evaluate';
import * as formatterConfig from './formatter-config';
import * as namespace from './namespace';
import type * as nrepl from './nrepl';
import * as replSession from './nrepl/repl-session';
import * as sessionRegistry from './nrepl/session-registry';
import * as pareditExtension from './paredit/extension';
import * as replInputCompletion from './repl-input-completion';
import * as replInputDocument from './repl-input-document';
import * as replWindow from './repl-window/repl-window-doc';
import * as output from './results-output/output';
import * as cursorGetText from './util/cursor-get-text';
import * as nsForm from './util/ns-form';
import * as whenContexts from './when-contexts';

const editorFocusSelectionKinds = [
  vscode.TextEditorSelectionChangeKind.Keyboard,
  vscode.TextEditorSelectionChangeKind.Mouse,
];

export function hasFocus(): boolean {
  return cljsLib.replInputFocused();
}

export function editFocused(f: (doc: model.StringDocument) => unknown): Promise<void> {
  return cljsLib.replInputEditFocused(f);
}

const editorCommands = [
  'undo',
  'redo',
  'cursorUndo',
  'addSelectionToNextFindMatch',
  'selectHighlights',
  'insertCursorAbove',
  'insertCursorBelow',
  'insertCursorAtEndOfEachLineSelected',
  'commentLine',
  'moveLinesUp',
  'moveLinesDown',
  'copyLinesUp',
  'copyLinesDown',
  'deleteLines',
  'indentLines',
  'outdentLines',
  'joinLines',
];

function editWithOneCursor(f: (doc: model.StringDocument) => unknown) {
  return editFocused((doc) => (doc.selections.length === 1 ? f(doc) : undefined));
}

function formatAtCursors(doc: model.StringDocument) {
  const { text } = replInputDocument.documentState(doc);
  replInputDocument.applyChanges(doc, format.formatAtCursorsChanges(doc, text));
}

/** Reformats `ranges` of a REPL Input document one at a time, as `reformatRanges` in `edit.ts` does in an editor. */
export function reformatRanges(doc: model.StringDocument, ranges: [number, number][]) {
  for (const [start, end] of ranges) {
    const { text } = replInputDocument.documentState(doc);
    replInputDocument.applyChanges(
      doc,
      format.documentRangeReformatChanges(doc, vscode.EndOfLine.LF, {
        startIndex: start,
        startColumn: doc.model.getRowCol(start)[1],
        originalText: text.substring(start, end),
        fullDocument: start === 0 && end === text.length,
      })
    );
  }
}

type Evaluation = {
  code: string;
  ns: string;
  nsForm: string;
  sessionKey: string;
  filePath: string;
  evaluationId: number;
  line: number;
  column: number;
  sendCode: boolean;
  stdin: () => Promise<string>;
  onSent: (evaluation: nrepl.NReplEvaluation) => unknown;
};

/** Evaluates REPL Input code to the Output Destinations, echoing it to the result destinations when `sendCode` and `calva.evaluationSendCodeToOutputWindow` say so. */
async function evaluateCode({
  code,
  ns,
  nsForm,
  sessionKey,
  filePath,
  evaluationId,
  line,
  column,
  sendCode,
  stdin,
  onSent,
}: Evaluation) {
  const session = sessionRegistry.getSession(sessionKey);
  const { evaluationSendCodeToOutputWindow, prettyPrintingOptions } = config.getConfig();
  await namespace.createNamespaceIfNotExists(session, ns, nsForm);
  const evaluation = await evaluate.evaluateToOutputDestinations(
    {
      code,
      session,
      ns,
      filePath,
      evaluationId,
      line,
      column,
      pprintOptions: prettyPrintingOptions,
      echoDestinations:
        sendCode && evaluationSendCodeToOutputWindow
          ? [output.getDestinationConfiguration().evalResults]
          : [],
      stdin,
    },
    { onEvaluationSent: onSent }
  );
  return { succeeded: 'value' in evaluation };
}

type Pick = (doc: model.EditableDocument) => cursorGetText.RangeAndText;

/** Returns the code `pick` takes from a REPL Input document, as `evaluateSelection` takes it from an editor, with the line and column where it starts. */
function pickedCode(pick: Pick) {
  return (doc: model.StringDocument) => {
    const [range, picked] = pick(doc);
    const { start, end } = doc.selections[0];
    const code = start === end ? evaluate.withoutIgnoreMarker(picked) : picked;
    if (range && code.length > 0) {
      const [line, column] = doc.model.getRowCol(range[0]);
      return { code, line, column };
    }
  };
}

/** Returns `evaluateFromEditor`, which evaluates what `pick` takes from the REPL Input instead, while a REPL Input has focus. */
export function evaluatingWhenFocused<Args extends unknown[]>(
  pick: Pick,
  evaluateFromEditor: (...args: Args) => unknown
) {
  return (...args: Args) =>
    hasFocus()
      ? cljsLib.replInputEvaluateFromFocused(pickedCode(pick))
      : evaluateFromEditor(...args);
}

async function snippetEvaluation(
  codeOrKeyOrSnippet: string | SnippetDefinition | undefined,
  doc: model.StringDocument,
  context: ReplInputContext
) {
  const definition =
    typeof codeOrKeyOrSnippet === 'object'
      ? codeOrKeyOrSnippet
      : await snippets.getSnippetDefinition(codeOrKeyOrSnippet, context.ns, context.sessionKey);
  return (
    definition &&
    replInputSnippetEvaluation(definition, doc, context, pareditExtension.getPareditConfig())
  );
}

/** Returns `runSnippet`, which runs the custom REPL command in the REPL Input instead, while a REPL Input has focus. */
export function runningSnippetWhenFocused(
  runSnippet: (codeOrKeyOrSnippet?: string | SnippetDefinition) => unknown
) {
  return (codeOrKeyOrSnippet?: string | SnippetDefinition) =>
    hasFocus()
      ? cljsLib
          .replInputEvaluateFromFocused((doc: model.StringDocument, context: ReplInputContext) =>
            snippetEvaluation(codeOrKeyOrSnippet, doc, context)
          )
          .catch((err: Error) =>
            vscode.window.showErrorMessage('Failed to run snippet. ' + err.message)
          )
      : runSnippet(codeOrKeyOrSnippet);
}

const isClojureFile = (document: vscode.TextDocument | undefined) =>
  document?.languageId === 'clojure' && !replWindow.isReplWindowDoc(document);

function followEditor(editor: vscode.TextEditor | undefined) {
  if (editor === vscode.window.activeTextEditor && isClojureFile(editor?.document)) {
    cljsLib.replInputEditorMoved(editor.document, editor.selection.active);
  }
}

const contextAdapter = {
  editorNamespace: (doc: vscode.TextDocument, position: vscode.Position) =>
    namespace.getNamespace(doc, position),
  // A null document routes without one, where undefined falls back to the active editor
  routedSessionKey: (doc: vscode.TextDocument | null) =>
    replSession.getRoutingInfo(doc)?.sessionKey,
  sessionKeys: () => sessionRegistry.listSessions().map(({ key }) => key),
};

function registerEvaluationCommands() {
  return [
    vscode.commands.registerCommand('calva.replInput.evaluate', () =>
      cljsLib.replInputEvaluateFocused()
    ),
    vscode.commands.registerCommand('calva.replInput.sendLine', () => cljsLib.replInputSendLine()),
    vscode.commands.registerCommand('calva.replInput.interrupt', () =>
      cljsLib.replInputInterruptFocused()
    ),
    vscode.commands.registerCommand('calva.replInput.searchHistory', () =>
      cljsLib.replInputSearchHistoryFocused()
    ),
  ];
}

function initReplInput() {
  cljsLib.initReplInput({
    ...contextAdapter,
    nsFromText: (code: string) => nsForm.nsFromText(code),
    evaluate: evaluateCode,
    setContext: (key: string, value: boolean) =>
      void vscode.commands.executeCommand('setContext', key, value),
    document: replInputDocument.stringDocument,
    documentState: replInputDocument.documentState,
    cursorContexts: replInputDocument.cursorContexts,
    brackets: (
      doc: model.StringDocument,
      options: { colorCount: number; cycleBracketColors: boolean }
    ) => {
      const { customCommentForms, aliasMap } = config.getConfig();
      return replInputDocument.brackets(doc, {
        ...options,
        commentFormConfig: { customCommentForms, aliasMap },
      });
    },
    restoreEditorCursorContexts: () =>
      whenContexts.setCursorContextIfChanged(vscode.window.activeTextEditor),
    ...replInputCompletion.completionAdapter,
  });
}

export function activate(context: vscode.ExtensionContext) {
  initReplInput();
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.replInput.deleteBackward', () =>
      editWithOneCursor((doc) => paredit.backspace(doc, undefined, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.deleteForward', () =>
      editWithOneCursor((doc) => paredit.deleteForward(doc))
    ),
    vscode.commands.registerCommand('calva.replInput.newLine', () =>
      editFocused((doc) => replInputDocument.newLine(doc, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.formatCurrentForm', () =>
      editFocused(formatAtCursors)
    ),
    vscode.commands.registerCommand('calva.replInput.insertLineAfter', () =>
      editFocused((doc) => replInputDocument.insertLineAfter(doc, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.insertLineBefore', () =>
      editFocused((doc) => replInputDocument.insertLineBefore(doc, formatterConfig.getConfigNow()))
    ),
    vscode.commands.registerCommand('calva.replInput.expandSelection', () =>
      vscode.commands.executeCommand('paredit.sexpRangeExpansion')
    ),
    vscode.commands.registerCommand('calva.replInput.shrinkSelection', () =>
      vscode.commands.executeCommand('paredit.sexpRangeContraction')
    ),
    ...editorCommands.map((name) =>
      vscode.commands.registerCommand(`calva.replInput.${name}`, () =>
        cljsLib.replInputRunInFocused(name)
      )
    ),
    ...registerEvaluationCommands(),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        cljsLib.replInputTextEditorFocused();
      }
      followEditor(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection(({ kind, textEditor }) => {
      if (editorFocusSelectionKinds.includes(kind)) {
        cljsLib.replInputTextEditorFocused();
      }
      followEditor(textEditor);
    })
  );
  followEditor(vscode.window.activeTextEditor);
}
