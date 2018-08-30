import * as vscode from 'vscode';
import * as util from '../../utilities';
const paredit = require('paredit.js');


function adjustRangeIgnoringComment(doc, range) {
    let text = doc.getText(range);

    if (text.match(/^\(\s*comment\s+/m)) {
        let start = doc.offsetAt(range.start),
            preTextLength = 0,
            end = doc.offsetAt(range.end),
            postTextLength = 0,
            preMatch = text.match(/^\(\s*comment\s+/m),
            postMatch = text.match(/\s*\)\s*$/m);
        if (preMatch) {
            preTextLength = preMatch[0].length;
        }
        if (postMatch) {
            postTextLength = postMatch[0].length;
        }
        start += preTextLength;
        end -= postTextLength;
        return new vscode.Range(doc.positionAt(start), doc.positionAt(end));
    } else {
        return range;
    }
}


function getFormSelection(doc, pos, topLevel) : vscode.Selection {
    let allText = doc.getText(),
        ast = paredit.parse(allText),
        idx = doc.offsetAt(pos),
        range = topLevel ? paredit.navigator.rangeForDefun(ast, idx) : paredit.navigator.sexpRange(ast, idx),
        vsSelection = range? new vscode.Selection(doc.positionAt(range[0]), doc.positionAt(range[1])) : new vscode.Selection(pos, pos);

    return vsSelection;
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
    getFormSelection,
    selectCurrentForm,
    adjustRangeIgnoringComment
};