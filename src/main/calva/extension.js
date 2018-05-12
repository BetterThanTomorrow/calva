import vscode from 'vscode';
import { config, deref, mode } from './state';
import { autoConnect, connect, disconnect, reconnect, recreateCljsRepl, toggleCLJCSession } from './connector';
import { evalCurrentFormInREPLTerminalCommand, loadNamespaceCommand, openREPLTerminalCommand, setREPLNamespaceCommand } from './terminal';
import { evaluateFile, evaluateSelection, evaluateSelectionPrettyPrint, evaluateSelectionReplace } from './repl/middleware/evaluate';
import { runAllTestsCommand, rerunTestsCommand, runNamespaceTests, runNamespaceTestsCommand } from './repl/middleware/testRunner';
import { selectCurrentForm } from './repl/middleware/select';
import activationGreetings from './greet';
import lintDocument from './repl/middleware/lint';
import updateStatus from './status';
import ClojureLanguageConfiguration from './language';
import CompletionItemProvider from './providers/completion';
import TextDocumentContentProvider from './providers/content';
import HoverProvider from './providers/hover';
import DefinitionProvider from './providers/definition';
import FormattingProvider from './providers/formatter';
import ClojureOnTypeFormattingProvider from './providers/ontype_formatter';

function onDidSave(document) {
    let {
        evaluate,
        lint,
        test
    } = config();

    if (document.languageId !== 'clojure') {
        return;
    }

    if (test) {
        if (test) {
            runNamespaceTests(document);
        }
    } else if (evaluate) {
        evaluateFile(document);
    }
    if (lint) {
        lintDocument(document);
    }
}

function onDidOpen(document) {
    if (document.languageId !== 'clojure') {
        return;
    }

    if (config().lint) {
        lintDocument(document);
    }
}


function activate(context) {
    let { autoConnectConfig } = config();
    //Set the language configuration for vscode when using this extension
    vscode.languages.setLanguageConfiguration(mode.language, new ClojureLanguageConfiguration());

    updateStatus();

    //Set calvas output channel to active
    let chan = deref().get('outputChannel');
    chan.show(true);

    // COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('calva.connect', connect));
    context.subscriptions.push(vscode.commands.registerCommand('calva.reconnect', reconnect));
    context.subscriptions.push(vscode.commands.registerCommand('calva.toggleCLJCSession', toggleCLJCSession));
    context.subscriptions.push(vscode.commands.registerCommand('calva.recreateCljsRepl', recreateCljsRepl));
    context.subscriptions.push(vscode.commands.registerCommand('calva.selectCurrentForm', selectCurrentForm));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateFile', evaluateFile));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelection', evaluateSelection));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionPrettyPrint', evaluateSelectionPrettyPrint));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evaluateSelectionReplace', evaluateSelectionReplace));
    context.subscriptions.push(vscode.commands.registerCommand('calva.lintFile', lintDocument));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runNamespaceTests', runNamespaceTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.runAllTests', runAllTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.rerunTests', rerunTestsCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.openREPLTerminal', openREPLTerminalCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.loadNamespace', loadNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.setREPLNamespace', setREPLNamespaceCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.evalCurrentFormInREPLTerminal', evalCurrentFormInREPLTerminalCommand));
    context.subscriptions.push(vscode.commands.registerCommand('calva.toggleAutoAdjustIndent', ClojureOnTypeFormattingProvider.toggleAutoAdjustIndentCommand));

    // PROVIDERS
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(mode, new CompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(mode, new HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(mode, new DefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(mode, new FormattingProvider()));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(mode, new ClojureOnTypeFormattingProvider(), "\n"));

    vscode.workspace.registerTextDocumentContentProvider('jar', new TextDocumentContentProvider());

    // //EVENTS
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        onDidOpen(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        onDidSave(document);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        updateStatus(editor);
    }));
    context.subscriptions.push(new vscode.Disposable(() => {
        disconnect();
        chan.dispose();
    }));

    // context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    //     console.log(event);
    // }));

    activationGreetings(chan);

    //Try to connect using an existing .nrepl-port file, searching the root-directory
    if (autoConnectConfig) {
        chan.appendLine("Autoconnecting... (This can be disabled in Settings)");
        autoConnect();
    } else {
        chan.appendLine("Autoconnect disabled in Settings.")
    }
    chan.show(true);
}

function deactivate() { }
export { activate, deactivate };
