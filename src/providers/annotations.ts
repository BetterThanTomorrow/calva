import * as vscode from 'vscode';
import * as state from '../state';
import * as _ from 'lodash';
import { setStateValue, removeStateValue } from '../../out/cljs-lib/cljs-lib';

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
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});

let resultsLocations: [vscode.Range, vscode.Position, vscode.Location][] = [];

function getResultsLocation(pos: vscode.Position): vscode.Location {
    for (const [range, _evaluatePosition, location] of resultsLocations) {
        if (range.contains(pos)) {
            return location;
        }
    }
}

function getEvaluationPosition(pos: vscode.Position): vscode.Position {
    for (const [range, evaluatePosition, _location] of resultsLocations) {
        if (range.contains(pos)) {
            return evaluatePosition;
        }
    }
}

function evaluated(contentText, hoverText, hasError) {
    return {
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
        rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
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
    setStateValue(key, ranges);
    editor.setDecorations(evalResultsDecorationType, ranges);
}

function setSelectionDecorations(editor, ranges, status) {
    let key = editor.document.uri + ':selectionDecorationRanges:' + status;
    setStateValue(key, ranges);
    editor.setDecorations(evalSelectionDecorationTypes[status], ranges);
}

function clearEvaluationDecorations(editor?: vscode.TextEditor) {
    editor = editor || vscode.window.activeTextEditor;
    if (editor) {
        removeStateValue(editor.document.uri + ':resultDecorationRanges');
        setResultDecorations(editor, []);
        for (const status in [AnnotationStatus.PENDING, AnnotationStatus.SUCCESS, AnnotationStatus.ERROR, AnnotationStatus.REPL_WINDOW]) {
            removeStateValue(editor.document.uri + ':selectionDecorationRanges:' + status);
            setSelectionDecorations(editor, [], status);
        }
    }
    resultsLocations = [];
}

function clearAllEvaluationDecorations() {
    vscode.window.visibleTextEditors.forEach(editor => {
        clearEvaluationDecorations(editor);
    });
}

function decorateResults(resultString, hasError, codeSelection: vscode.Range, editor: vscode.TextEditor) {
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

function decorateSelection(resultString: string, codeSelection: vscode.Selection, editor: vscode.TextEditor, evaluatePosition: vscode.Position, resultsLocation, status: AnnotationStatus) {
    const uri = editor.document.uri,
        key = uri + ':selectionDecorationRanges:' + status;
    let decoration = {},
        decorationRanges = state.deref().get(key) || [];
    decorationRanges = _.filter(decorationRanges, (o) => { return !o.range.intersection(codeSelection) });
    decoration["range"] = codeSelection;
    if (status != AnnotationStatus.PENDING && status != AnnotationStatus.REPL_WINDOW) {
        const commandUri = `command:calva.showOutputWindow`,
            commandMd = `[Open Results Window](${commandUri} "Open the results window")`;
        let hoverMessage = new vscode.MarkdownString(commandMd);
        hoverMessage.isTrusted = true;
        decoration["hoverMessage"] = status == AnnotationStatus.ERROR ? resultString : hoverMessage;
    }
    // for (let s = 0; s < evalSelectionDecorationTypes.length; s++) {
    //     setSelectionDecorations(editor, [], s);.
    // }
    setSelectionDecorations(editor, [], status);
    decorationRanges.push(decoration);
    setSelectionDecorations(editor, decorationRanges, status);
    if (status == AnnotationStatus.SUCCESS || status == AnnotationStatus.ERROR) {
        resultsLocations.push([codeSelection, evaluatePosition, resultsLocation]);
    }
}

function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    if (event.contentChanges.length) {
        const activeTextEditor: vscode.TextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor) {
            const activeDocument = activeTextEditor.document,
                changeDocument = event.document;
            if (activeDocument.uri == changeDocument.uri) {
                clearEvaluationDecorations(activeTextEditor);
            }
        }
    }
}

export default {
    AnnotationStatus,
    clearEvaluationDecorations,
    clearAllEvaluationDecorations,
    decorateResults,
    decorateSelection,
    onDidChangeTextDocument,
    getResultsLocation,
    getEvaluationPosition
};