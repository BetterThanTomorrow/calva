import * as vscode from 'vscode';
import * as util from '../../utilities';
const paredit = require('paredit.js');


function _adjustRangeIgnoringComment(doc, range) {
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
        end -= postTextLength - 1;
        return new vscode.Range(doc.positionAt(start), doc.positionAt(end));
    } else {
        return range;
    }
}

function _getFormSelection(doc, pos, topLevel, ignoreComment = true): vscode.Selection {
    let allText = doc.getText(),
        ast = paredit.parse(allText),
        idx = doc.offsetAt(pos),
        peRange = topLevel ? paredit.navigator.rangeForDefun(ast, idx) : paredit.navigator.sexpRange(ast, idx);
    if (peRange) {
        let range = new vscode.Selection(doc.positionAt(peRange[0]), doc.positionAt(peRange[1]));
        if (ignoreComment) {
            range = _adjustRangeIgnoringComment(doc, range);
            if (topLevel) {
                const idxOffset = doc.offsetAt(range.start);
                ast = paredit.parse(doc.getText(range));
                idx = idx - idxOffset;
                peRange = paredit.navigator.rangeForDefun(ast, idx);
                range = new vscode.Selection(doc.positionAt(peRange[0] + idxOffset), doc.positionAt(peRange[1] + idxOffset));
            }
        }
        return range;
    }
    else {
        return new vscode.Selection(pos, pos);
    }
}

function _selectCurrentForm(document = {}) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument(document),
        selection = editor.selection;

    if (selection.isEmpty) {
        let codeSelection = _getFormSelection(doc, selection.active, false, false);
        if (codeSelection) {
            editor.selection = codeSelection;
        }
    }
}

export default {
    getFormSelection: _getFormSelection,
    selectCurrentForm: _selectCurrentForm
};