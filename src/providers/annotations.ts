import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as util from '../utilities';

enum AnnotationStatus {
  PENDING = 0,
  SUCCESS,
  ERROR,
  REPL_WINDOW,
}

const selectionBackgrounds = [
  'rgba(197, 197, 197, 0.07)',
  'rgba(63, 255, 63, 0.05)',
  'rgba(255, 63, 63, 0.06)',
  'rgba(63, 63, 255, 0.1)',
];

const selectionRulerColors = ['gray', 'green', 'red', 'blue'];

const evalResultsDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    textDecoration: 'none',
    fontWeight: 'normal',
    fontStyle: 'normal',
  },
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
});

function evaluated(contentText, hoverText, hasError) {
  return {
    renderOptions: {
      after: {
        contentText: contentText.replace(/ /g, '\u00a0'),
        overflow: 'hidden',
        color: hasError
          ? new vscode.ThemeColor('calva.inlineErrorForegroundColor')
          : new vscode.ThemeColor('calva.inlineForegroundColor'),
      },
    },
  };
}

function createEvalSelectionDecorationType(status: AnnotationStatus) {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: selectionBackgrounds[status],
    overviewRulerColor: selectionRulerColors[status],
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
  });
}

const evalSelectionDecorationTypes = [
  createEvalSelectionDecorationType(AnnotationStatus.PENDING),
  createEvalSelectionDecorationType(AnnotationStatus.SUCCESS),
  createEvalSelectionDecorationType(AnnotationStatus.ERROR),
  createEvalSelectionDecorationType(AnnotationStatus.REPL_WINDOW),
];

function setResultDecorations(editor: vscode.TextEditor, ranges) {
  const key = editor.document.uri + ':resultDecorationRanges';
  util.cljsLib.setStateValue(key, ranges);
  editor.setDecorations(evalResultsDecorationType, ranges);
}

function setSelectionDecorations(editor: vscode.TextEditor, ranges, status) {
  const key = editor.document.uri + ':selectionDecorationRanges:' + status;
  util.cljsLib.setStateValue(key, ranges);
  editor.setDecorations(evalSelectionDecorationTypes[status], ranges);
}

function clearEvaluationDecorations(editor?: vscode.TextEditor) {
  editor = editor || util.tryToGetActiveTextEditor();
  if (editor) {
    util.cljsLib.removeStateValue(editor.document.uri + ':resultDecorationRanges');
    setResultDecorations(editor, []);
    for (const status of [
      AnnotationStatus.PENDING,
      AnnotationStatus.SUCCESS,
      AnnotationStatus.ERROR,
      AnnotationStatus.REPL_WINDOW,
    ]) {
      util.cljsLib.removeStateValue(editor.document.uri + ':selectionDecorationRanges:' + status);
      setSelectionDecorations(editor, [], status);
    }
  }
}

function clearAllEvaluationDecorations() {
  vscode.window.visibleTextEditors.forEach((editor) => {
    clearEvaluationDecorations(editor);
  });
  void vscode.commands.executeCommand('setContext', 'calva:hasInlineResults', false);
}

// Amongst other things, this function removes any leading whitespace
// from the RESULTSTRING displayed in the decoration.
function decorateResults(
  resultString,
  hasError,
  codeSelection: vscode.Range,
  editor: vscode.TextEditor
) {
  const uri = editor.document.uri;
  const key = uri + ':resultDecorationRanges';
  let decorationRanges = util.cljsLib.getStateValue(key) || [];
  const resultTrimmed = resultString.trimStart();
  const decoration = evaluated(` => ${resultTrimmed} `, resultTrimmed, hasError);
  decorationRanges = _.filter(decorationRanges, (o) => {
    return !o.codeRange.intersection(codeSelection);
  });
  decoration['codeRange'] = codeSelection;
  decoration['range'] = new vscode.Selection(codeSelection.end, codeSelection.end);
  decorationRanges.push(decoration);
  setResultDecorations(editor, decorationRanges);
  void vscode.commands.executeCommand('setContext', 'calva:hasInlineResults', true);
}

// Returns a string of commands seperated by `|` to display in the
// results tooltip for the given RESULTSTRING.
//
// The commands are
//
// 1. Copy results to the clipboard.
// 2. Reveal the output destination.
function getDecorateSelectionCmdsString(resultString: string) {
  const copyCommandUri = `command:calva.copyAnnotationHoverText?${encodeURIComponent(
      JSON.stringify([{ text: resultString }])
    )}`,
    copyCommandMd = `[Copy](${copyCommandUri} "Copy results to the clipboard")`;
  const openWindowCommandUri = `command:calva.showResultOutputDestination`,
    openWindowCommandMd = `[Show Output](${openWindowCommandUri} "Reveal the output destination")`;

  return `${copyCommandMd} | ${openWindowCommandMd}`;
}

// Amongst other things, this function generates the hover content for
// RESULTSTRING based on the STATUS value:
//
// - `ERROR`: Includes the commands header from `getDecorateSelectionCmdsString`, followed by RESULTSTRING
//   wrapped in a Markdown plain code block preserving whitespaces.
//
// - `SUCCESS`: Includes the commands header from `getDecorateSelectionCmdsString`, followed by RESULTSTRING
//   wrapped in a Markdown Clojure code block.
function decorateSelection(
  resultString: string,
  codeSelection: vscode.Selection,
  editor: vscode.TextEditor,
  evaluatePosition: vscode.Position,
  status: AnnotationStatus
) {
  const uri = editor.document.uri;
  const key = uri + ':selectionDecorationRanges:' + status;
  const decoration = {};
  let decorationRanges = util.cljsLib.getStateValue(key) || [];
  decorationRanges = _.filter(decorationRanges, (o) => {
    return !o.range.intersection(codeSelection);
  });
  decoration['range'] = codeSelection;
  if (status != AnnotationStatus.PENDING && status != AnnotationStatus.REPL_WINDOW) {
    const codeBlockLang = status == AnnotationStatus.ERROR ? '' : 'clojure';
    const hoverMessage = new vscode.MarkdownString(
      getDecorateSelectionCmdsString(resultString) +
        `\n\`\`\`${codeBlockLang}\n` +
        resultString +
        '\n```'
    );
    hoverMessage.isTrusted = true;
    decoration['hoverMessage'] = hoverMessage;
  }
  // for (let s = 0; s < evalSelectionDecorationTypes.length; s++) {
  //     setSelectionDecorations(editor, [], s);.
  // }
  setSelectionDecorations(editor, [], status);
  decorationRanges.push(decoration);
  setSelectionDecorations(editor, decorationRanges, status);
}

function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
  if (event.contentChanges.length) {
    const activeTextEditor: vscode.TextEditor | undefined = util.tryToGetActiveTextEditor();
    if (activeTextEditor) {
      const activeDocument = activeTextEditor.document,
        changeDocument = event.document;
      if (activeDocument.uri == changeDocument.uri) {
        clearEvaluationDecorations(activeTextEditor);
      }
    }
  }
}

function copyHoverTextCommand(args: { [x: string]: string }) {
  void vscode.env.clipboard.writeText(args['text']);
}

// ------------- EXPORT FOR UNIT TEST USE ONLY ----------------------------------

const _getDecorateSelectionHeader = getDecorateSelectionCmdsString;

/// retuns the selection decoration type of the given annotation STATUS.
function _getEvalSelectionDecorationTypes(status: AnnotationStatus) {
  return evalSelectionDecorationTypes[status];
}

// ------------------------------------------------------------------------------

export default {
  _getDecorateSelectionHeader,
  _getEvalSelectionDecorationTypes,
  AnnotationStatus,
  clearEvaluationDecorations,
  clearAllEvaluationDecorations,
  copyHoverTextCommand,
  decorateResults,
  decorateSelection,
  onDidChangeTextDocument,
};
