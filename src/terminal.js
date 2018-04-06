const vscode = require('vscode');
const state = require('./state');
const util = require('./utilities');
const evaluate = require('./repl/middleware/evaluate');
const annotations = require('./providers/annotations');
const select = require('./repl/middleware/select');


function terminalSlug(sessionSlug) {
    return sessionSlug + '-terminal';
}

function createREPLTerminal(sessionType, outputChan) {
    let current = state.deref(),
        configOptions = vscode.workspace.getConfiguration('clojure4vscode'),
        slug = terminalSlug(sessionType),
        terminalName = (sessionType === 'clj' ? 'Clojure' : 'CojureScript') + ' REPL',
        terminal = null;

    if (current.get(slug)) {
        current.get(slug).dispose();
    }
    terminal = vscode.window.createTerminal(terminalName);

    if (terminal) {
        state.cursor.set(slug, terminal);
        terminal.sendText(configOptions.connectREPLCommand + " " + current.get('hostname') + ':' + current.get('port'));
        if (sessionType === 'cljs') {
            terminal.sendText(configOptions.startCLJSREPLCommand);
        }
        outputChan.appendLine('Terminal created for: ' + terminalName);
    }
}

function openREPLTerminal(keepFocus = true) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        sessionType = util.getREPLSessionType(),
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
    let terminal = state.deref().get(terminalSlug(util.getREPLSessionType()));
    if (terminal) {
        terminal.show();
        loadNamespace();
    }
}

function sendTextToREPLTerminal(text, addNewline = false) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        sessionType = util.getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.sendText(text, addNewline);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function setREPLNamespace(reload = false, keepFocus = true) {
    let nameSpace = util.getDocumentNamespace();

    if (reload) {
        evaluate.evaluateFile();
    }
    sendTextToREPLTerminal("(in-ns '" + nameSpace + ")", true);
    openREPLTerminal(keepFocus);
}

function setREPLNamespaceCommand() {
    let terminal = state.deref().get(terminalSlug(util.getREPLSessionType()));
    if (terminal) {
        terminal.show();
        setREPLNamespace(false, false);
    }
}

function evalCurrentFormInREPLTerminal(keepFocus = true) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";

    annotations.clearEvaluationDecorations(editor);
    if (selection.isEmpty) {
        codeSelection = select.getFormSelection(doc, selection.active);
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

module.exports = {
    createREPLTerminal,
    openREPLTerminal,
    openREPLTerminalCommand,
    loadNamespace,
    loadNamespaceCommand,
    setREPLNamespace,
    setREPLNamespaceCommand,
    evalCurrentFormInREPLTerminal,
    evalCurrentFormInREPLTerminalCommand
}