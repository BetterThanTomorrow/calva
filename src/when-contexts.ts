import * as vscode from 'vscode';
import { Token } from './cursor-doc/lexer';
import { equal as deep_equal } from './cursor-doc/model'
import { TokenCursor, LispTokenCursor } from './cursor-doc/token-cursor';
import * as docMirror from './doc-mirror'

type CursorContext = LexerCursorContext | PreLexerCursorContext;
type LexerCursorContext = 'calva:cursorInString' | 'calva:cursorInComment';
type PreLexerCursorContext = 'calva:cursorAtStartOfLine' | 'calva:cursorAtEndOfLine'
const allCursorContexts: CursorContext[] = ['calva:cursorInString', 'calva:cursorInComment', 'calva:cursorAtStartOfLine', 'calva:cursorAtEndOfLine']

let lastContexts: CursorContext[] = [];

export default function setCursorContextIfChanged(editor: vscode.TextEditor) {
    if (!editor || !editor.document || editor.document.languageId !== 'clojure') return;

    const currentContexts = determineCursorContexts(editor.document, editor.selection.active);
    setCursorContexts(currentContexts);
}

function setCursorContexts(currentContexts: CursorContext[]) {
    if (deep_equal(lastContexts, currentContexts)) {
        return;
    }
    lastContexts = currentContexts;

    allCursorContexts.forEach(context => {
        vscode.commands.executeCommand('setContext', context, currentContexts.indexOf(context) > -1)
    })
}

function determineCursorContexts(document: vscode.TextDocument, position: vscode.Position): CursorContext[] {
    let contexts: CursorContext[] = [];
    const idx = document.offsetAt(position);
    const mirrorDoc = docMirror.getDocument(document);
    const tokenCursor = mirrorDoc.getTokenCursor(idx);
    const line = document.lineAt(position);

    if (position.character <= line.firstNonWhitespaceCharacterIndex) {
        contexts.push('calva:cursorAtStartOfLine');
        // no line end within multiline strings
    } else if (!tokenCursor.withinString()) {
        const lastNonWSIndex = line.text.match(/\S(?=(\s*$))/)?.index;
        if (position.character > lastNonWSIndex) {
            contexts.push('calva:cursorAtEndOfLine');
        }
    }

    if (tokenCursor.withinString()) {
        contexts.push('calva:cursorInString');
    } else if (tokenCursor.withinComment()) {
        contexts.push('calva:cursorInComment');
    }

    return contexts;
}
