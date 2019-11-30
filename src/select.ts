import * as vscode from 'vscode';
import * as util from './utilities'
import * as docMirror from './doc-mirror'

function getFormSelection(doc: vscode.TextDocument, pos: vscode.Position, topLevel): vscode.Selection {
    const idx = doc.offsetAt(pos),
        cursor = docMirror.getDocument(doc).getTokenCursor(topLevel ? 0 : idx),
        range = topLevel ? cursor.rangeForDefun(idx) : cursor.rangeForCurrentForm(idx);
    return new vscode.Selection(doc.positionAt(range[0]), doc.positionAt(range[1]));
}

function selectCurrentForm(document = {}) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument(document),
        selection = editor.selection;

    if (selection.isEmpty) {
        let codeSelection = getFormSelection(doc, selection.active, false);
        if (codeSelection) {
            editor.selection = codeSelection;
        }
    }
}

export default {
    getFormSelection: getFormSelection,
    selectCurrentForm: selectCurrentForm
};