import * as vscode from 'vscode';
import select from '../select';
import * as paredit from '../cursor-doc/paredit'
import * as docMirror from '../doc-mirror/index';
import * as cursorTextGetter from './cursor-get-text';

export type SelectionAndText = [vscode.Selection, string];

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

export function currentEnclosingFormText(editor: vscode.TextEditor): SelectionAndText {
    const doc = editor.document;
    if (doc) {
        const codeSelection = select.getEnclosingFormSelection(doc, editor.selection.active);
        return [codeSelection, doc.getText(codeSelection)];
    }
    return [undefined, ''];
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
        const mirrorDoc = docMirror.getDocument(document);
        const [range, text] = cursorTextGetter.currentTopLevelFunction(mirrorDoc);
        if (range) {
            return [select.selectionFromOffsetRange(document, range), text];
        }
    }
    return [undefined, ''];
}

export function currentTopLevelFormToCursor(editor: vscode.TextEditor): SelectionAndText {
    if (editor) {
        const document = editor.document;
        const mirrorDoc = docMirror.getDocument(document);
        const [range, text] = cursorTextGetter.currentTopLevelFormToCursor(mirrorDoc);
        if (range) {
            return [select.selectionFromOffsetRange(document, range), text];
        }
    }
    return [undefined, ''];
}


function fromFn(editor: vscode.TextEditor, cursorDocFn: Function): SelectionAndText{
    if (editor) {
        const document = editor.document;
        const cursorDoc = docMirror.getDocument(document);
        const range = cursorDocFn(cursorDoc);
        const selection = select.selectionFromOffsetRange(document, range);
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