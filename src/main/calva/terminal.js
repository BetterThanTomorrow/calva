import vscode from 'vscode';
import { config, cursor, deref } from './state';
import { getCljsReplStartCode, getDocument, getDocumentNamespace, getREPLSessionType } from './utilities';
import { evaluateFile } from './repl/middleware/evaluate';
import annotations from './providers/annotations';
import { getFormSelection } from './repl/middleware/select';
import { isShadowCljs } from './shadow';

const CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL = 'npx shadow-cljs clj-repl';
const CONNECT_SHADOW_CLJS_CLJS_REPL = 'npx shadow-cljs cljs-repl';

function terminalSlug(sessionSlug) {
    return sessionSlug + '-terminal';
}

function createREPLTerminal(sessionType, shadowBuild, outputChan) {
    let current = deref(),
        slug = terminalSlug(sessionType),
        terminalName = (sessionType === 'clj' ? 'Clojure' : 'CojureScript') + ' REPL',
        terminal = null;

    if (current.get(slug)) {
        current.get(slug).dispose();
    }
    terminal = vscode.window.createTerminal(terminalName);

    if (terminal) {
        cursor.set(slug, terminal);
        let connectCommand = isShadowCljs() ?
            (sessionType === 'cljs' ?
                `${CONNECT_SHADOW_CLJS_CLJS_REPL} ${shadowBuild}` :
                CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL) :
            config().connectREPLCommand + " " + current.get('hostname') + ':' + current.get('port');
        terminal.sendText(connectCommand);
        if (!shadowBuild && sessionType === 'cljs') {
            terminal.sendText(getCljsReplStartCode());
        }
        outputChan.appendLine('Terminal created for: ' + terminalName);
    }
}

function openREPLTerminal(keepFocus = true) {
    let current = deref(),
        chan = current.get('outputChannel'),
        sessionType = getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.show(keepFocus);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function openREPLTerminalCommand() {
    openREPLTerminal(false);
}

function loadNamespace() {
    setREPLNamespace(true, false);
}

function loadNamespaceCommand() {
    let terminal = deref().get(terminalSlug(getREPLSessionType()));
    if (terminal) {
        terminal.show();
        loadNamespace();
    }
}

function sendTextToREPLTerminal(text, addNewline = false) {
    let current = deref(),
        chan = current.get('outputChannel'),
        sessionType = getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.sendText(text, addNewline);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function setREPLNamespace(reload = false, keepFocus = true) {
    let nameSpace = getDocumentNamespace();

    if (reload) {
        evaluateFile();
    }
    sendTextToREPLTerminal("(in-ns '" + nameSpace + ")", true);
    openREPLTerminal(keepFocus);
}

function setREPLNamespaceCommand() {
    let terminal = deref().get(terminalSlug(getREPLSessionType()));
    if (terminal) {
        terminal.show();
        setREPLNamespace(false, false);
    }
}

function evalCurrentFormInREPLTerminal(keepFocus = true) {
    let editor = vscode.window.activeTextEditor,
        doc = getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";

    annotations.clearEvaluationDecorations(editor);
    if (selection.isEmpty) {
        codeSelection = getFormSelection(doc, selection.active);
        annotations.decorateSelection(codeSelection, editor);
        code = doc.getText(codeSelection);
    } else {
        codeSelection = selection;
        code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLTerminal(code, true)
    }
    openREPLTerminal(keepFocus);
}

function evalCurrentFormInREPLTerminalCommand() {
    evalCurrentFormInREPLTerminal(false);
}

export {
    createREPLTerminal,
    openREPLTerminal,
    openREPLTerminalCommand,
    loadNamespace,
    loadNamespaceCommand,
    setREPLNamespace,
    setREPLNamespaceCommand,
    evalCurrentFormInREPLTerminal,
    evalCurrentFormInREPLTerminalCommand
};