const vscode = require('vscode');
const _ = require('lodash');
const state = require('./state');
const util = require('./utilities');

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

function openREPLTerminal() {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        sessionType = util.getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.show(true);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function loadNamespace() {
    _setREPLNamespace(true);
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

function _setREPLNamespace(reload = false) {
    let nameSpace = util.getDocumentNamespace();

    if (reload) {
        sendTextToREPLTerminal("(require '" + nameSpace + " :reload-all)", true);
    }
    sendTextToREPLTerminal("(in-ns '" + nameSpace + ")", true);
    openREPLTerminal();
}

function setREPLNamespace() {
    _setREPLNamespace(false);
}

function evalCurrentFormInREPLTerminal() {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";

    if (selection.isEmpty) {
        codeSelection = util.getFormSelection(doc, selection.active);
        code = doc.getText(codeSelection);
    } else {
        codeSelection = selection,
            code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLTerminal(code, true)
    }
    openREPLTerminal();
}

module.exports = {
    createREPLTerminal,
    openREPLTerminal,
    loadNamespace,
    setREPLNamespace,
    evalCurrentFormInREPLTerminal
}