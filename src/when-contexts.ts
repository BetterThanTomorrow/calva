import * as vscode from 'vscode';
import config from './config';
import * as docMirror from './doc-mirror'

type CursorContext = 'calva-standard' | AltCursorContext;
type AltCursorContext = 'string' | 'comment';
let lastContext: CursorContext = null;

export default function setCursorContextIfChanged(editor: vscode.TextEditor) {
    if (!editor || !editor.document || editor.document.languageId !== 'clojure') return;

    const currentContext = determineCursorContext(editor.document, editor.selection.active);
    setCursorContext(currentContext);
}

function setCursorContext(currentContext: CursorContext) {
    if (lastContext === currentContext) {
        return;
    }
    lastContext = currentContext;
    const commentContext = config.CURSOR_CONTEXT_IN_COMMENT;
    const stringContext = config.CURSOR_CONTEXT_IN_STRING;
    vscode.commands.executeCommand('setContext', commentContext, false);
    vscode.commands.executeCommand('setContext', stringContext, false);

    switch (currentContext) {
        case 'calva-standard':
            break;
        case 'comment':
            vscode.commands.executeCommand('setContext', commentContext, true);
            break;
        case 'string':
            vscode.commands.executeCommand('setContext', stringContext, true);
            break;
        default:
        // TODO: throw? log?
    }
}

function determineCursorContext(document: vscode.TextDocument, position: vscode.Position): CursorContext {
    const idx = document.offsetAt(position);
    const mirrorDoc = docMirror.getDocument(document);
    const tokenCursor = mirrorDoc.getTokenCursor(idx);

    let context: CursorContext;
    if (tokenCursor.withinString()) {
        context = 'string';
    } else if (tokenCursor.withinComment()) {
        context = 'comment';
    } else {
        context = 'calva-standard';
    }

    return context;
}