const vscode = require('vscode');
const state = require('./state');
const statusbar = require('./statusbar');
const connector = require('./connector');

const ClojureLanguageConfiguration = require('./language');

const CompletionItemProvider = require('./providers/completion');
const TextDocumentContentProvider = require('./providers/content');
const HoverProvider = require('./providers/hover');
const DefinitionProvider = require('./providers/definition');

const RefreshMiddleWare = require('./repl/middleware/refresh');

function activate(context) {
    //Set the language configuration for vscode when using this extension
    vscode.languages.setLanguageConfiguration(state.mode.language, new ClojureLanguageConfiguration());
    statusbar.update();

    //Try to connect using an existing .nrepl-port file, searching the root-directory
    connector.autoConnect();

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.connect', connector.connect));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.refresh', RefreshMiddleWare.refreshChanged));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.refreshAll', RefreshMiddleWare.refreshAll));
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.refreshClear', RefreshMiddleWare.refreshClear));

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.mode, new CompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.mode, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.mode, new DefinitionProvider()));
    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        //clojureEvaluation.evaluateFile(state, document);
        RefreshMiddleWare.refreshChanged(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        //clojureEvaluation.evaluateFile(state, document);
        RefreshMiddleWare.refreshChanged(document);
    }));
}

exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;
