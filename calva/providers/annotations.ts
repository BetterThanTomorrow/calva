import * as vscode from 'vscode';
import * as state from '../state';

const evalResultsDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
        textDecoration: 'none',
        fontWeight: 'normal',
        fontStyle: 'normal',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});

function evaluated(contentText, hasError) {
    return {
        renderOptions: {
            before: {
                contentText: contentText,
            },
            light: {
                before: {
                    color: hasError ? 'rgb(255, 127, 127)' : 'black',
                    backgroundColor: 'white',
                },
            },
            dark: {
                before: {
                    color: hasError ? 'rgb(255, 175, 175)' : 'white',
                    backgroundColor: 'black',
                }
            },
        },
    }
}

const evalSelectionDecorationType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: 'blue',
    backgroundColor: 'rgba(255, 255, 20, 0.1)',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
});

function setResultDecorations(editor, ranges) {
    let key = editor.document.uri + ':resultDecorationRanges';
    state.cursor.set(key, ranges);
    editor.setDecorations(evalResultsDecorationType, ranges);
}

function setSelectionDecorations(editor, ranges) {
    let key = editor.document.uri + ':selectionDecorationRanges';
    state.cursor.set(key, ranges);
    editor.setDecorations(evalSelectionDecorationType, ranges);
}

function clearEvaluationDecorations(editor) {
    if (editor === undefined) {
        editor = vscode.window.activeTextEditor;
    }

    setResultDecorations(editor, []);
    setSelectionDecorations(editor, []);
}

function decorateResults(resultString, hasError, codeSelection, editor) {
    let uri = editor.document.uri,
        key = uri + ':resultDecorationRanges',
        decorationRanges = state.deref().get(key),
        decoration = evaluated(resultString, hasError);
    if (!decorationRanges) decorationRanges = [];
    decoration["range"] = new vscode.Selection(codeSelection.end, codeSelection.end);
    decorationRanges.push(decoration);
    state.cursor.set(key, decorationRanges);
    editor.setDecorations(evalResultsDecorationType, decorationRanges);

    //setResultDecorations(editor, decorationRanges);
}

function decorateSelection(codeSelection, editor: vscode.TextEditor) {
    let uri = editor.document.uri,
        key = uri + ':selectionDecorationRanges',
        decorationRanges = state.deref().get(key);
    if (!decorationRanges) decorationRanges = [];
    decorationRanges.push({ range: codeSelection });
    state.cursor.set(key, decorationRanges);
    editor.setDecorations(evalSelectionDecorationType, decorationRanges);

    //setSelectionDecorations(editor, decorationRanges);
}

export default {
    evalResultsDecorationType,
    evaluated,
    evalSelectionDecorationType,
    clearEvaluationDecorations,
    decorateResults,
    decorateSelection
};