const vscode = require('vscode');
const _ = require('lodash');
const state = require('./state');

function createREPLTerminal(sessionSlug, outputChan) {
    let current = state.deref(),
        terminalSlug = sessionSlug + '-terminal',
        terminalName = (sessionSlug === 'clj' ? 'Clojure' : 'CojureScript') + ' REPL',
        terminal = null;

    if (current.get(terminalSlug)) {
        current.get(terminalSlug).dispose();
    }
    terminal = vscode.window.createTerminal(terminalName);

    if (terminal) {
        state.cursor.set(terminalSlug, terminal);
        terminal.sendText("lein repl :connect " + current.get('hostname') + ':' + current.get('port'), true);
        if (sessionSlug === 'cljs') {
            terminal.sendText("(cljs-repl)", true);
        }
        outputChan.appendLine('Terminal created for: ' + terminalName);
    }
}

module.exports = {
    createREPLTerminal
}