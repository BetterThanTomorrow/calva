import * as vscode from 'vscode';
import select from '../select';
import * as paredit from '../cursor-doc/paredit'
import * as docMirror from '../doc-mirror/index';

type SelectionAndText = [vscode.Selection, string];

function _currentFormText(editor: vscode.TextEditor, topLevel: boolean): SelectionAndText {
    const doc = editor.document;
    if (doc) {
        const codeSelection = select.getFormSelection(doc, editor.selection.active, topLevel);
        return [codeSelection, doc.getText(codeSelection)];
    }
    return [undefined, ''];

}

export function currentTopLevelFormText(editor: vscode.TextEditor): SelectionAndText {
    return _currentFormText(editor, true);
}

export function currentFormText(editor: vscode.TextEditor): SelectionAndText {
    return _currentFormText(editor, false);
}

export function currentFunction(editor: vscode.TextEditor): SelectionAndText {
    if (editor) {
        const document = editor.document;
        const tokenCursor = docMirror.getDocument(editor.document).getTokenCursor();
        const [start, end] = tokenCursor.getFunctionSexpRange();
        if (start && end) {
            const startPos = document.positionAt(start);
            const endPos = document.positionAt(end);
            const selection = new vscode.Selection(startPos, endPos);
            return [selection, document.getText(selection)];
        }
    }
    return [undefined, ''];
}

export function currentTopLevelFunction(editor: vscode.TextEditor): SelectionAndText {
    if (editor) {
        const document = editor.document;
        const selection = select.getFormSelection(document, editor.selection.active, true);
        const startPositionOfTopLevelForm = selection.start;
        const cursorOffset = editor.document.offsetAt(startPositionOfTopLevelForm);
        const tokenCursor = docMirror.getDocument(editor.document).getTokenCursor(cursorOffset);
        if (tokenCursor.downList()) {
            tokenCursor.forwardWhitespace();
            while (tokenCursor.next()) {
                const symbol = tokenCursor.getToken();
                if (symbol.type === 'id') {
                    return [selection, symbol.raw];
                }
            }
        }
    }
    return [undefined, ''];
}

function fromFn(editor: vscode.TextEditor, cursorDocFn: Function): SelectionAndText{
    if (editor) {
        const document = editor.document;
        const cursorDoc = docMirror.getDocument(document);
        const range = cursorDocFn(cursorDoc);
        const selection = new vscode.Selection(
            document.positionAt(range[0]),
            document.positionAt(range[1]))
        const text = document.getText(selection);
        return [selection, text];
    }
    return [undefined, ''];
}

export function toStartOfList(editor: vscode.TextEditor): SelectionAndText {
    return fromFn(editor, paredit.rangeToBackwardList);
}

export function toEndOfList(editor: vscode.TextEditor): SelectionAndText {
    return fromFn(editor, paredit.rangeToForwardList);
}