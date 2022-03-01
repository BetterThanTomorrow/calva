import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';

function selectionFromOffsetRange(
    doc: vscode.TextDocument,
    range: [number, number]
): vscode.Selection {
    return new vscode.Selection(
        doc.positionAt(range[0]),
        doc.positionAt(range[1])
    );
}

function getFormSelection(
    doc: vscode.TextDocument,
    pos: vscode.Position,
    topLevel: boolean
): vscode.Selection {
    const idx = doc.offsetAt(pos);
    const cursor = docMirror.getDocument(doc).getTokenCursor(idx);
    const range = topLevel
        ? cursor.rangeForDefun(idx)
        : cursor.rangeForCurrentForm(idx);
    if (range) {
        return selectionFromOffsetRange(doc, range);
    }
}

function getEnclosingFormSelection(
    doc: vscode.TextDocument,
    pos: vscode.Position
): vscode.Selection {
    const idx = doc.offsetAt(pos);
    const cursor = docMirror.getDocument(doc).getTokenCursor(idx);
    if (cursor.backwardList()) {
        cursor.backwardUpList();
        const start = cursor.offsetStart;
        if (cursor.forwardSexp()) {
            const end = cursor.offsetStart;
            return selectionFromOffsetRange(doc, [start, end]);
        }
    }
}

function selectForm(
    document = {},
    selectionFn: (
        doc: vscode.TextDocument,
        pos: vscode.Position,
        topLevel: boolean
    ) => vscode.Selection,
    toplevel: boolean
) {
    const editor = util.mustGetActiveTextEditor(),
        doc = util.getDocument(document),
        selection = editor.selection;

    if (selection.isEmpty) {
        const codeSelection = selectionFn(doc, selection.active, toplevel);
        if (codeSelection) {
            editor.selection = codeSelection;
        }
    }
}

function selectCurrentForm(document = {}) {
    selectForm(document, getFormSelection, false);
}

export default {
    getFormSelection,
    getEnclosingFormSelection,
    selectCurrentForm,
    selectionFromOffsetRange,
};
