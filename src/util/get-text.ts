import * as vscode from 'vscode';
import select from '../select';
import * as paredit from '../cursor-doc/paredit'
import * as docMirror from '../doc-mirror/index';

export function currentFormText(editor: vscode.TextEditor, topLevel: boolean) {
    const doc = editor.document;
    if (doc) {
        const codeSelection = select.getFormSelection(doc, editor.selection.active, topLevel);
        return doc.getText(codeSelection);
    } else {
        return '';
    }
}

export function currentFunction(editor: vscode.TextEditor) {
    if (editor) {
        const document = editor.document;
        const tokenCursor = docMirror.getDocument(editor.document).getTokenCursor();
        const [start, end] = tokenCursor.getFunctionSexpRange();
        if (start && end) {
            const startPos = document.positionAt(start);
            const endPos = document.positionAt(end);
            return document.getText(new vscode.Range(startPos, endPos));
        }
    }
}

export function currentTopLevelFunction(editor: vscode.TextEditor) {
    if (editor) {
        const document = editor.document;
        const startPositionOfTopLevelForm = select.getFormSelection(document, editor.selection.active, true).start;
        const cursorOffset = editor.document.offsetAt(startPositionOfTopLevelForm);
        const tokenCursor = docMirror.getDocument(editor.document).getTokenCursor(cursorOffset);
        if (tokenCursor.downList()) {
            tokenCursor.forwardWhitespace();
            while (tokenCursor.next()) {
                const symbol = tokenCursor.getToken();
                if (symbol.type === 'id') {
                    return symbol.raw;
                }
            }
            return '';
        }
        return '';
    }
}

function textFromFn(editor: vscode.TextEditor, cursorDocFn: Function): string{
    if (editor) {
        const document = editor.document;
        const cursorDoc = docMirror.getDocument(document);
        const range = cursorDocFn(cursorDoc);
        const vcRange = new vscode.Range(
            document.positionAt(range[0]),
            document.positionAt(range[1]))
        const text = document.getText(vcRange);
        return text;
    }
    return '';
}

export function textToStartOfList(editor: vscode.TextEditor): string {
    return textFromFn(editor, paredit.rangeToBackwardList);
}

export function textToEndOfList(editor: vscode.TextEditor): string {
    return textFromFn(editor, paredit.rangeToForwardList);
}