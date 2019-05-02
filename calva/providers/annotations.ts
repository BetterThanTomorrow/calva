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

function allMatches(re: RegExp, text: string) {
    const matches: { start: number, end: number }[] = []
    let match
    while (match = re.exec(text)) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length
        })
    }
    return matches
}

function clearEvaluationCommentDecorations(editor?: vscode.TextEditor) {
    if (editor === undefined) {
        editor = vscode.window.activeTextEditor
    }

    const originalText = editor.document.getText()
    const comment = /\n;; ==>.*<== ;;/gm

    const matches = allMatches(comment, originalText)

    if (matches.length > 0) {
        const edits = matches.map(
          ({ start, end }) =>
            new vscode.TextEdit(new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(end)), ""),
        )
        const wsEdit = new vscode.WorkspaceEdit()
        wsEdit.set(editor.document.uri, edits)
        vscode.workspace.applyEdit(wsEdit)
    }
}

function clearDecorations(editor?: vscode.TextEditor) {
    clearEvaluationDecorations(editor)
    clearEvaluationCommentDecorations(editor)
}

function decorateResults(resultString, hasError, codeSelection: vscode.Range, editor) {
    let uri = editor.document.uri,
        key = uri + ':resultDecorationRanges',
        decorationRanges = state.deref().get(key) || [],
        decoration = evaluated(resultString, hasError);
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
    clearEvaluationCommentDecorations,
    clearEvaluationDecorations,
    clearDecorations,
    decorateResults,
    decorateSelection,
    onDidChangeTextDocument
};