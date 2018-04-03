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
    terminal: null,
    connected: false,
    connecting: config().autoConnect ? true : false,
    outputChannel: vscode.window.createOutputChannel("clojure4vscode"),
    diagnosticCollection: vscode.languages.createDiagnosticCollection('clojure4vscode: Evaluation errors'),
    autoAdjustIndent: config().autoAdjustIndent
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
    let configOptions = vscode.workspace.getConfiguration('clojure4vscode');
    return {
        format: configOptions.get("formatOnSave"),
        evaluate: configOptions.get("evalOnSave"),
        lint: configOptions.get("lintOnSave"),
        test: configOptions.get("testOnSave"),
        autoConnect: configOptions.get("autoConnect"),
        autoAdjustIndent: configOptions.get("autoAdjustIndent")
    };
};

module.exports = {
    cursor,
    mode,
    deref,
    reset,
    config
};
