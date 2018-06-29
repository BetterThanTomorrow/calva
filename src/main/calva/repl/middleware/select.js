import vscode from 'vscode';
import * as util from '../../utilities';
const paredit = require('paredit.js');

function getFormSelection(doc, pos, topLevel) {
    let allText = doc.getText(),
        ast = paredit.parse(allText),
        idx = doc.offsetAt(pos),
        range = topLevel ? paredit.navigator.rangeForDefun(ast, idx) : paredit.navigator.sexpRange(ast, idx);

    if (range) {
        return new vscode.Range(doc.positionAt(range[0]), doc.positionAt(range[1]));
    } else {
        return new vscode.Range(pos, pos);
    }
}


function selectCurrentForm(document = {}) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument(document),
        selection = editor.selection,
        codeSelection = null;

    if (selection.isEmpty) {
        codeSelection = getFormSelection(doc, selection.active);
        if (codeSelection) {
            editor.selection = codeSelection;
        }
    }
}


export default {
    getFormSelection,
    selectCurrentForm
};