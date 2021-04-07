import * as vscode from 'vscode';
import { deepEqual } from './util/object'
import * as docMirror from './doc-mirror'
import * as context from './cursor-doc/cursor-context';

let lastContexts: context.CursorContext[] = [];

export default function setCursorContextIfChanged(editor: vscode.TextEditor) {
    if (!editor || !editor.document || editor.document.languageId !== 'clojure') return;

    const currentContexts = determineCursorContexts(editor.document, editor.selection.active);
    setCursorContexts(currentContexts);
}

function determineCursorContexts(document: vscode.TextDocument, position: vscode.Position): context.CursorContext[] {
    const idx = document.offsetAt(position);
    const mirrorDoc = docMirror.getDocument(document);
    const tokenCursor = mirrorDoc.getTokenCursor(idx);
    return context.determineContexts(tokenCursor, idx);
}

function setCursorContexts(currentContexts: context.CursorContext[]) {
    if (deepEqual(lastContexts, currentContexts)) {
        return;
    }
    lastContexts = currentContexts;

    context.allCursorContexts.forEach(context => {
        vscode.commands.executeCommand('setContext', context, currentContexts.indexOf(context) > -1)
    })
}
