const vscode = require('vscode');
const util = require('../../utilities');

function selectCurrentForm(document = {}) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null;

    if (selection.isEmpty) {
        codeSelection = util.getFormSelection(doc, selection.active);
        if (codeSelection) {
            editor.selection = codeSelection;
        }
    }
}

module.exports = {
    selectCurrentForm
}