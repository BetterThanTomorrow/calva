const vscode = require('vscode');
const Immutable = require('immutable');
const ImmutableCursor = require('immutable-cursor');

const mode = { language: 'clojure', scheme: 'file'};
const support = {
    CLJS: ["cljc", "cljs"],
    CLJ: ["cljc", "clj"]
};



var data = Immutable.fromJS({
    hostname: null,
    port: null,
    clj: null,
    cljs: null,
    connected: false,
    outputChannel: vscode.window.createOutputChannel("VisualClojure"),
    diagnosticCollection: vscode.languages.createDiagnosticCollection('VisualClojure: Evaluation errors')
});

const cursor = ImmutableCursor.from(data, [], (nextState, currentState) => {
	data = Immutable.fromJS(nextState);
});

function deref() {
    return data;
};

module.exports = {
    cursor,
    support,
    mode,
    deref
};
