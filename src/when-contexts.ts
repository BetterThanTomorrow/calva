import * as vscode from 'vscode';
import { deepEqual } from './util/object'
import { LispTokenCursor, TokenCursor } from './cursor-doc/token-cursor';
import * as docMirror from './doc-mirror'

// TODO: what to do about parens not being available in when expressions?
// TODO: unit tests

type CursorContext = 'calva:cursorInString' | 'calva:cursorInComment' | 'calva:cursorAtStartOfLine' | 'calva:cursorAtEndOfLine';
const allCursorContexts: CursorContext[] = ['calva:cursorInString', 'calva:cursorInComment', 'calva:cursorAtStartOfLine', 'calva:cursorAtEndOfLine']

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

    if (cursorAtLineStartIncLeadingWhitespace(tokenCursor, document.offsetAt(position))) {
        contexts.push('calva:cursorAtStartOfLine');
    } else if (cursorAtLineEndIncTrailingWhitespace(tokenCursor, document.lineAt(position), position)) {
        contexts.push('calva:cursorAtEndOfLine');
    }

    if (tokenCursor.withinString()) {
        contexts.push('calva:cursorInString');
    } else if (tokenCursor.withinComment()) {
        contexts.push('calva:cursorInComment');
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


// context predicates
function cursorAtLineStartIncLeadingWhitespace(cursor: TokenCursor, documentOffset: number) {
    const tk = cursor.clone();
    let startOfLine = false;
    //  only at start if we're in ws, or at the 1st char of a non-ws sexp
    if (tk.getToken().type === 'ws' || tk.offsetStart >= documentOffset) {
        while (tk.getPrevToken().type === 'ws') {
            tk.previous();
        }
        startOfLine = tk.getPrevToken().type === 'eol';
    }

    return startOfLine;
}

function cursorAtLineEndIncTrailingWhitespace(tokenCursor: LispTokenCursor, line: vscode.TextLine, position: vscode.Position) {
    //  consider a multiline string as a single line
    if (tokenCursor.withinString()) {
        return false;
    }

    const lastNonWSIndex = line.text.match(/\S(?=(\s*$))/)?.index;
    
    return position.character > lastNonWSIndex
}

