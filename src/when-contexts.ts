import * as vscode from 'vscode';
import { deepEqual } from './util/object'
import * as docMirror from './doc-mirror'
import * as context  from './cursor-doc/context-predicates';

type CursorContext = CursorAtomicContext | CursorCompoundContext;
type CursorAtomicContext = 'calva:cursorInString' | 'calva:cursorInComment' | 'calva:cursorAtStartOfLine' | 'calva:cursorAtEndOfLine';
type CursorCompoundContext = 'calva:cursorInsideComment' | 'calva:cursorInCommentExcludingSOL' | 'calva:cursorInCommentExcludingEOL';
const allCursorContexts: CursorContext[] = ['calva:cursorInString', 'calva:cursorInComment', 'calva:cursorAtStartOfLine', 'calva:cursorAtEndOfLine', 'calva:cursorInsideComment', 'calva:cursorInCommentExcludingSOL', 'calva:cursorInCommentExcludingEOL'];

let lastContexts: CursorContext[] = [];

export default function setCursorContextIfChanged(editor: vscode.TextEditor) {
    if (!editor || !editor.document || editor.document.languageId !== 'clojure') return;

    const currentContexts = determineCursorContexts(editor.document, editor.selection.active);
    setCursorContexts(currentContexts);
}

function determineCursorContexts(document: vscode.TextDocument, position: vscode.Position): CursorContext[] {
    let contexts: CursorContext[] = [];
    const idx = document.offsetAt(position);
    const mirrorDoc = docMirror.getDocument(document);
    const tokenCursor = mirrorDoc.getTokenCursor(idx);

    if (context.cursorAtLineStartIncLeadingWhitespace(tokenCursor, document.offsetAt(position))) {
        contexts.push('calva:cursorAtStartOfLine');
    } else if (context.cursorAtLineEndIncTrailingWhitespace(tokenCursor, document.lineAt(position).text, position.character)) {
        contexts.push('calva:cursorAtEndOfLine');
    }

    if (tokenCursor.withinString()) {
        contexts.push('calva:cursorInString');
    } else if (tokenCursor.withinComment()) {
        contexts.push('calva:cursorInComment');
    }

    // Compound contexts 
    if (contexts.includes('calva:cursorInComment')){
        if (!contexts.includes('calva:cursorAtEndOfLine')){
            contexts.push('calva:cursorInCommentExcludingEOL')
        }
        if(!contexts.includes('calva:cursorAtStartOfLine')){
            contexts.push('calva:cursorInCommentExcludingSOL')
        }
    }

    return contexts;
}

function setCursorContexts(currentContexts: CursorContext[]) {
    if (deepEqual(lastContexts, currentContexts)) {
        return;
    }
    lastContexts = currentContexts;

    allCursorContexts.forEach(context => {
        vscode.commands.executeCommand('setContext', context, currentContexts.indexOf(context) > -1)
    })
}
