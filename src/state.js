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
    shadowBuild: null,
    terminal: null,
    connected: false,
    connecting: false,
    outputChannel: vscode.window.createOutputChannel("Calva says"),
    diagnosticCollection: vscode.languages.createDiagnosticCollection('calva: Evaluation errors'),
    autoAdjustIndent: config().autoAdjustIndent
};

reset();

const cursor = ImmutableCursor.from(data, [], (nextState) => {
    data = Immutable.fromJS(nextState);
});

function deref() {
    return data;
};

function reset() {
    data = Immutable.fromJS(initialData);
};

function config() {
    let configOptions = vscode.workspace.getConfiguration('calva');
    return {
        format: configOptions.get("formatOnSave"),
        evaluate: configOptions.get("evalOnSave"),
        lint: configOptions.get("lintOnSave"),
        test: configOptions.get("testOnSave"),
        autoConnect: configOptions.get("autoConnect"),
        autoAdjustIndent: configOptions.get("autoAdjustIndent"),
        connectREPLCommand: configOptions.get("connectREPLCommand"),
        projectRootDirectory: configOptions.get("projectRootDirectory").replace(/^\/|\/$/g, "")
    };
};

module.exports = {
    cursor,
    mode,
    deref,
    reset,
    config
};
