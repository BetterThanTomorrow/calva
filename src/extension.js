const vscode = require('vscode');
const state = require('./state');
const status = require('./status');
const connector = require('./connector');
const greet = require('./greet');
const terminal = require('./terminal');

const ClojureLanguageConfiguration = require('./language');

const CompletionItemProvider = require('./providers/completion');
const TextDocumentContentProvider = require('./providers/content');
const HoverProvider = require('./providers/hover');
const DefinitionProvider = require('./providers/definition');
const FormattingProvider = require('./providers/formatter');
const ClojureOnTypeFormattingProvider = require('./providers/ontype_formatter');

const EvaluateMiddleWare = require('./repl/middleware/evaluate');
const LintMiddleWare = require('./repl/middleware/lint');
const TestRunnerMiddleWare = require('./repl/middleware/testRunner');
const select = require('./repl/middleware/select');

function onSave(document) {
    let {
        evaluate,
        lint,
        test
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
    if (test) {
        TestRunnerMiddleWare.runNamespaceTests(document);
    }
};

function activate(context) {
    let {
        autoConnect
    } = state.config();
    //Set the language configuration for vscode when using this extension
    vscode.languages.setLanguageConfiguration(state.mode.language, new ClojureLanguageConfiguration());

    status.update();

    //Set clojure4vscodes output channel to active
    let chan = state.deref().get('outputChannel');
    chan.show();

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.connect', connector.connect));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.reconnect', connector.reconnect));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.toggleCLJCSession', connector.toggleCLJCSession));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.selectCurrentForm', select.selectCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.evaluateFile', EvaluateMiddleWare.evaluateFile));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.evaluateSelection', EvaluateMiddleWare.evaluateSelection));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.evaluateSelectionPrettyPrint', EvaluateMiddleWare.evaluateSelectionPrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.evaluateSelectionReplace', EvaluateMiddleWare.evaluateSelectionReplace));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.lintFile', LintMiddleWare.lintDocument));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.runNamespaceTests', TestRunnerMiddleWare.runNamespaceTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.runAllTests', TestRunnerMiddleWare.runAllTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.openREPLTerminal', terminal.openREPLTerminalCommand));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.loadNamespace', terminal.loadNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.setREPLNamespace', terminal.setREPLNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('clojure4vscode.evalCurrentFormInREPLTerminal', terminal.evalCurrentFormInREPLTerminalCommand));

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(state.mode, new CompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(state.mode, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(state.mode, new DefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(state.mode, new FormattingProvider()));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(state.mode, new ClojureOnTypeFormattingProvider(), "\n"));

    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        onSave(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        onSave(document);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        status.update(editor);
    }));

    greet.activationGreetings(chan);

    //Try to connect using an existing .nrepl-port file, searching the root-directory
    if (autoConnect) {
        connector.autoConnect().catch((err) => {
            chan.appendLine("Failed to connect: " + err + "\nDo you have a REPL running? (Autoconnect can be switched of in User Settings.)");
        });
    } else {
        chan.appendLine("Autoconnect disabled in User Settings.")
    }

}

exports.activate = activate;

function deactivate() { }
exports.deactivate = deactivate;
