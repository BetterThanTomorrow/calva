import * as vscode from 'vscode';
import { FormatOnTypeEditProvider } from './providers/ontype_formatter';
import { RangeEditProvider } from './providers/range_formatter';
import * as formatter from './format';
import * as inferer from './infer';
import * as docmirror from "./docmirror"

const ClojureLanguageConfiguration: vscode.LanguageConfiguration = {
    wordPattern: /[^\s,#()[\]{};"\\]+/,
    onEnterRules: [
        // This is madness, but the only way to stop vscode from indenting new lines
        {
            beforeText: /.*/,
            action: {
                indentAction: vscode.IndentAction.Outdent,
                removeText: Number.MAX_VALUE
            }
        },
    ]
}



export function activate(context: vscode.ExtensionContext) {
    docmirror.activate();
    vscode.languages.setLanguageConfiguration("clojure", ClojureLanguageConfiguration);
    // this doesn't actually grow anything yet, but just jumps to the start of the enclosing expression.
    // context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.forwardSexp', docmirror.forwardSexp))
    // context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.backwardSexp', docmirror.backwardSexp))
    // context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.forwardList', docmirror.forwardList))
    // context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.backwardList', docmirror.backwardList))
    // context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.downList', docmirror.downList))
    // context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.upList', docmirror.upList))
    // context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.backwardUpList', docmirror.backwardUpList))

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.formatCurrentForm', formatter.formatPositionCommand));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.alignCurrentForm', formatter.alignPositionCommand));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.inferParens', inferer.inferParensCommand));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.tabIndent', (e) => { inferer.indentCommand(e, " ", true) }));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.tabDedent', (e) => { inferer.indentCommand(e, " ", false) }));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider("clojure", new FormatOnTypeEditProvider, "\r", "\n"));
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider("clojure", new RangeEditProvider));
    vscode.window.onDidChangeActiveTextEditor(inferer.updateState);
}
