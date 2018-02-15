const vscode = require('vscode');
const Immutable = require('immutable');
const ImmutableCursor = require('immutable-cursor');

const mode = {
    language: 'clojure',
    scheme: 'file'
};
var data;
const initialData = {
    hostname: null,
    port: null,
    clj: null,
    cljs: null,
    connected: false,
    outputChannel: vscode.window.createOutputChannel("VisualClojure"),
    diagnosticCollection: vscode.languages.createDiagnosticCollection('VisualClojure: Evaluation errors')
};

reset();

const cursor = ImmutableCursor.from(data, [], (nextState, currentState) => {
    data = Immutable.fromJS(nextState);
});

function deref() {
    return data;
};

function reset() {
    data = Immutable.fromJS(initialData);
};

function config() {
    let configOptions = vscode.workspace.getConfiguration('visualclojure');
    return {
        format: configOptions.get("formatOnSave"),
        evaluate: configOptions.get("evalOnSave"),
        lint: configOptions.get("lintOnSave"),
        connect: configOptions.get("autoConnect")
    };
};

module.exports = {
    cursor,
    mode,
    deref,
    reset,
    config
};
