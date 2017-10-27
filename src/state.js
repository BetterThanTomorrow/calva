const vscode = require('vscode');
const Immutable = require('immutable');
const ImmutableCursor = require('immutable-cursor');

const mode = { language: 'clojure', scheme: 'file'};
const support = {
    CLJS: ["cljc", "cljs"],
    CLJ: ["cljc", "clj"]
};
var data;
const initialData = {
    hostname: null,
    port: null,
    clj: null,
    cljs: null,
    connected: false,
    connection: null,
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
        refresh: configOptions.get("refreshOnSave"),
        eval: configOptions.get("evalOnSave"),
        connect: configOptions.get("autoConnect")
    };
};

module.exports = {
    cursor,
    support,
    mode,
    deref,
    reset,
    config
};
