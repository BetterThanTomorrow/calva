import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import evaluate from './repl/middleware/evaluate';
import annotations from './providers/annotations';
import select from './repl/middleware/select';
import shadow from './shadow';

const CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL = 'npx shadow-cljs clj-repl';
const CONNECT_SHADOW_CLJS_CLJS_BUILD_REPL = 'npx shadow-cljs cljs-repl';
const CONNECT_SHADOW_CLJS_CLJS_NODE_REPL = 'npx shadow-cljs node-repl';

function terminalSlug(sessionSlug) {
    return sessionSlug + '-terminal';
}

function createREPLTerminal(sessionType, shadowBuild: string, outputChan) {
    let current = state.deref(),
        slug = terminalSlug(sessionType),
        terminalName = (sessionType === 'clj' ? 'Clojure' : 'ClojureScript') + ' REPL',
        terminal = null;

    if (current.get(slug)) {
        current.get(slug).dispose();
    }
    terminal = vscode.window.createTerminal(terminalName);

    if (terminal) {
        state.cursor.set(slug, terminal);
        let connectCommand = shadow.isShadowCljs() ?
            (sessionType === 'cljs' ?
                (shadowBuild.startsWith(":") ?
                    `${CONNECT_SHADOW_CLJS_CLJS_BUILD_REPL} ${shadowBuild}` :
                    CONNECT_SHADOW_CLJS_CLJS_NODE_REPL) :
                CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL) :
            state.config().connectREPLCommand + " " + current.get('hostname') + ':' + current.get('port');
        terminal.sendText(connectCommand);
        if (!shadowBuild && sessionType === 'cljs') {
            terminal.sendText(util.getCljsReplStartCode());
        }
        outputChan.appendLine('Terminal created for: ' + terminalName);
    }
}

function openREPLTerminal() {
    let current = state.deref(),
        chan = state.outputChannel(),
        sessionType = util.getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.show(true);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function openREPLTerminalCommand() {
    openREPLTerminal();
}

function loadNamespace() {
    setREPLNamespace(true);
}

function loadNamespaceCommand(focus = true) {
    let terminal: vscode.Terminal = state.deref().get(terminalSlug(util.getREPLSessionType()));
    if (terminal) {
        terminal.show(focus);
        loadNamespace();
    }
}

function sendTextToREPLTerminal(text, addNewline = false) {
    let current = state.deref(),
        chan = state.outputChannel(),
        sessionType = util.getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.sendText(text, addNewline);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function setREPLNamespace(reload = false) {
    let nameSpace = util.getDocumentNamespace();

    if (reload) {
        evaluate.evaluateFile();
    }
    sendTextToREPLTerminal("(in-ns '" + nameSpace + ")", true);
}

function setREPLNamespaceCommand() {
    let terminal = state.deref().get(terminalSlug(util.getREPLSessionType()));
    if (terminal) {
        terminal.show(true);
        setREPLNamespace(false);
        openREPLTerminal();
    }
}

function evalCurrentFormInREPLTerminal(topLevel = false) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";

    if (selection.isEmpty) {
        state.analytics().logEvent("REPLEvaluation", topLevel ? "TopLevel" : "CurrentForm");
        codeSelection = select.getFormSelection(doc, selection.active, topLevel);
        annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.TERMINAL);
        code = doc.getText(codeSelection);
    } else {
        state.analytics().logEvent("REPLEvaluation", "Selection");
        codeSelection = selection;
        code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLTerminal(code, true)
    }
    openREPLTerminal();
}

function evalCurrentFormInREPLTerminalCommand() {
    evalCurrentFormInREPLTerminal(false);
}

function evalCurrentTopLevelFormInREPLTerminalCommand() {
    evalCurrentFormInREPLTerminal(true);
}

export default {
    createREPLTerminal,
    openREPLTerminal,
    openREPLTerminalCommand,
    loadNamespace,
    loadNamespaceCommand,
    setREPLNamespace,
    setREPLNamespaceCommand,
    evalCurrentFormInREPLTerminal,
    evalCurrentFormInREPLTerminalCommand,
    evalCurrentTopLevelFormInREPLTerminalCommand
};
