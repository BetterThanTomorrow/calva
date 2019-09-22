import * as vscode from 'vscode';
import * as state from '../state';
import * as _ from 'lodash';

enum AnnotationStatus {
    PENDING = 0,
    SUCCESS,
    ERROR,
    REPL_WINDOW
}

const selectionBackgrounds = [
    'rgba(197, 197, 197, 0.07)',
    'rgba(63, 255, 63, 0.05)',
    'rgba(255, 63, 63, 0.06)',
    'rgba(63, 63, 255, 0.1)'
]

const selectionRulerColors = [
    "gray",
    "green",
    "red",
    "blue"
]

const evalResultsDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
        textDecoration: 'none',
        fontWeight: 'normal',
        fontStyle: 'normal',
        width: "250px",
},
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});


//<a href="#" data-href="command:gitlens.showQuickCommitDetails?%7B%22sha%22%3A%22ec09a1477b748da5d0d59b6e9f1eaff031aca4e2%22%7D" title="Show Commit Details"><code>ec09a14</code></a>

function evaluated(contentText, hoverText, hasError) {
    const commandUri = vscode.Uri.parse("command:calva.copyLastResults"),
    commandMd = `[Copy](${commandUri} "Copy results to the clipboard")`;
    let hoverMessage = new vscode.MarkdownString(commandMd + '\n```clojure\n' + hoverText + '\n```');
    hoverMessage.isTrusted = true;
    return {
        hoverMessage: hasError ? hoverText : hoverMessage,
        renderOptions: {
            before: {
                contentText: contentText,
                overflow: "hidden"
            },
            light: {
                before: {
                    color: hasError ? 'rgb(255, 127, 127)' : 'black',
                },
            },
            dark: {
                before: {
                    color: hasError ? 'rgb(255, 175, 175)' : 'white',
                }
            },
        },
    }
}


function createEvalSelectionDecorationType(status: AnnotationStatus) {
    return vscode.window.createTextEditorDecorationType({
        backgroundColor: selectionBackgrounds[status],
        overviewRulerColor: selectionRulerColors[status],
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    })
}

const evalSelectionDecorationTypes = [
    createEvalSelectionDecorationType(AnnotationStatus.PENDING),
    createEvalSelectionDecorationType(AnnotationStatus.SUCCESS),
    createEvalSelectionDecorationType(AnnotationStatus.ERROR),
    createEvalSelectionDecorationType(AnnotationStatus.REPL_WINDOW)
]

function setResultDecorations(editor: vscode.TextEditor, ranges) {
    let key = editor.document.uri + ':resultDecorationRanges';
    state.cursor.set(key, ranges);
    editor.setDecorations(evalResultsDecorationType, ranges);
}

function setSelectionDecorations(editor, ranges, status) {
    let key = editor.document.uri + ':selectionDecorationRanges:' + status;
    state.cursor.set(key, ranges);
    editor.setDecorations(evalSelectionDecorationTypes[status], ranges);
}

function clearEvaluationDecorations(editor?: vscode.TextEditor) {
    if (editor === undefined) {
        editor = vscode.window.activeTextEditor;
    }

    setResultDecorations(editor, []);
    setSelectionDecorations(editor, [], AnnotationStatus.PENDING);
    setSelectionDecorations(editor, [], AnnotationStatus.SUCCESS);
    setSelectionDecorations(editor, [], AnnotationStatus.ERROR);
    setSelectionDecorations(editor, [], AnnotationStatus.REPL_WINDOW);
}

function decorateResults(resultString, hasError, codeSelection: vscode.Range, editor) {
    let uri = editor.document.uri,
        key = uri + ':resultDecorationRanges',
        decorationRanges = state.deref().get(key) || [],
        decoration = evaluated(` => ${resultString} `, resultString, hasError);
    decorationRanges = _.filter(decorationRanges, (o) => { return !o.codeRange.intersection(codeSelection) });
    decoration["codeRange"] = codeSelection;
    decoration["range"] = new vscode.Selection(codeSelection.end, codeSelection.end);
    decorationRanges.push(decoration);
    setResultDecorations(editor, decorationRanges);
}

function decorateSelection(codeSelection, editor: vscode.TextEditor, status: AnnotationStatus) {
    let uri = editor.document.uri,
        key = uri + ':selectionDecorationRanges:' + status,
        decoration = {},
        decorationRanges = state.deref().get(key) || [];
    decorationRanges = _.filter(decorationRanges, (o) => { return !o.range.intersection(codeSelection) });
    decoration["range"] = codeSelection;
    decorationRanges.push(decoration);
    setSelectionDecorations(editor, decorationRanges, status);
}

function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    const activeTextEditor: vscode.TextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor) {
        const activeDocument = activeTextEditor.document,
            changeDocument = event.document;
        if (activeDocument.uri == changeDocument.uri) {
            clearEvaluationDecorations(activeTextEditor);
        }
    }
}

export default {
    AnnotationStatus,
    clearEvaluationDecorations,
    decorateResults,
    decorateSelection,
    onDidChangeTextDocument
};