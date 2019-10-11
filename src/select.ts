import * as vscode from 'vscode';
import * as util from './utilities';
const paredit = require('paredit.js');


function _adjustRangeIgnoringComment(doc, range) {
    let text = doc.getText(range);
    if (text.match(/^\(\s*comment\s+/m)) {
        // Create a new top level context by removing the first and last characters of the range.
        // These will always be the opening and the closing parens of the `(comment ...)` form.
        const start = doc.offsetAt(range.start),
            end = doc.offsetAt(range.end);
        return new vscode.Range(doc.positionAt(start + 1), doc.positionAt(end - 1));
    } else {
        return range;
    }
}

function _getFormSelection(doc, pos: vscode.Position, topLevel): vscode.Selection {
    let allText = doc.getText(),
        ast = paredit.parse(allText),
        idx = doc.offsetAt(pos),
        peRange = topLevel ? paredit.navigator.rangeForDefun(ast, idx) : paredit.navigator.sexpRange(ast, idx);
    if (peRange) {
        let range = new vscode.Selection(doc.positionAt(peRange[0]), doc.positionAt(peRange[1]));
        if (pos.isAfter(range.start) && pos.isBefore(range.end)) {
            range = _adjustRangeIgnoringComment(doc, range);
            if (topLevel) {
                const idxOffset = doc.offsetAt(range.start);
                ast = paredit.parse(doc.getText(range));
                idx = idx - idxOffset;
                peRange = paredit.navigator.rangeForDefun(ast, idx);
                if (peRange) {
                    return new vscode.Selection(doc.positionAt(peRange[0] + idxOffset), doc.positionAt(peRange[1] + idxOffset));
                } else {
                    return new vscode.Selection(pos, pos);
                } 
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
        let codeSelection = _getFormSelection(doc, selection.active, false);
        if (codeSelection) {
            editor.selection = codeSelection;
        }
    }
}

export default {
    getFormSelection: _getFormSelection,
    selectCurrentForm: _selectCurrentForm
};