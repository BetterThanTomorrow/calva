const vscode = require('vscode');
const state = require('./state');
const statusbar = require('./statusbar');
const connector = require('./connector');
const ClojureLanguageConfiguration = require('./language');

const CompletionItemProvider = require('./providers/completion');
const TextDocumentContentProvider = require('./providers/content');
const HoverProvider = require('./providers/hover');
const DefinitionProvider = require('./providers/definition');
const FormatingProvider = require('./providers/formater');

const EvaluateMiddleWare = require('./repl/middleware/evaluate');
const LintMiddleWare = require('./repl/middleware/lint');

function onSave(document) {
    let {
        evaluate,
        lint
    } = state.config();

    if (document.languageId !== 'clojure') {
        return;
    }

    if (evaluate) {
        EvaluateMiddleWare.evaluateFile(document);
    }
    if (lint) {
        LintMiddleWare.lintDocument(document);
    }
};

function activate(context) {
    let {
        connect
    } = state.config();
    //Set the language configuration for vscode when using this extension
    vscode.languages.setLanguageConfiguration(state.mode.language, new ClojureLanguageConfiguration());
    statusbar.update();

    //Set visualclojures output channel to active
    let chan = state.deref().get('outputChannel');
    chan.show();


    //Try to connect using an existing .nrepl-port file, searching the root-directory
    if (connect) {
        connector.autoConnect();
    }

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.connect', connector.connect));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.reconnect', connector.reconnect));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.evaluateFile', EvaluateMiddleWare.evaluateFile));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.evaluateSelection', EvaluateMiddleWare.evaluateSelection));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.evaluateSelectionPrettyPrint', EvaluateMiddleWare.evaluateSelectionPrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.lintFile', LintMiddleWare.lintDocument));

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.mode, new CompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.mode, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.mode, new DefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(state.mode, new FormatingProvider()))
    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        onSave(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        onSave(document);
    }));
}

exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;
