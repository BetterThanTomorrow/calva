import * as vscode from 'vscode';
import * as state from '../../state';
import { FormatOnTypeEditProvider } from './providers/ontype_formatter';
import { RangeEditProvider } from './providers/range_formatter';
import * as formatter from './format';
import * as inferer from './infer';
import * as docmirror from "../../doc-mirror"
import * as config from './config'

function getLanguageConfiguration(autoIndentOn: boolean): vscode.LanguageConfiguration {
    return {
        wordPattern: /[^\s,#()[\]{}꞉;"\\\@]+/, // NB: The ꞉ there is not a regular colon
        onEnterRules: autoIndentOn ? [
            // This is madness, but the only way to stop vscode from indenting new lines
            {
                beforeText: /.*/,
                action: {
                    indentAction: vscode.IndentAction.Outdent,
                    removeText: Number.MAX_VALUE
                }
            },
        ] : [],
        comments: {
            lineComment: ';;',
            blockComment: ['(comment\n', ')']
        }
    }
}


export function activate(context: vscode.ExtensionContext) {
    docmirror.activate();
    vscode.languages.setLanguageConfiguration("clojure", getLanguageConfiguration(config.getConfig()["format-as-you-type"]));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.formatCurrentForm', formatter.formatPositionCommand));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.alignCurrentForm', formatter.alignPositionCommand));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.inferParens', inferer.inferParensCommand));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.tabIndent', (e) => { inferer.indentCommand(e, " ", true) }));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.tabDedent', (e) => { inferer.indentCommand(e, " ", false) }));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(state.documentSelector, new FormatOnTypeEditProvider, "\r", "\n"));
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(state.documentSelector, new RangeEditProvider));
    vscode.window.onDidChangeActiveTextEditor(inferer.updateState);
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("calva.fmt.formatAsYouType")) {
            vscode.languages.setLanguageConfiguration("clojure", getLanguageConfiguration(config.getConfig()["format-as-you-type"]));
        }
    })
}
