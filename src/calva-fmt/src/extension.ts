import * as vscode from 'vscode';
import { FormatOnTypeEditProvider } from './providers/ontype_formatter';
import { RangeEditProvider } from './providers/range_formatter';
import * as formatter from './format';
import * as inferer from './infer';
import * as docmirror from "../../doc-mirror/index"
import * as config from './config'
import * as calvaConfig from '../../config';

function getLanguageConfiguration(autoIndentOn: boolean): vscode.LanguageConfiguration {
    return {
        onEnterRules: autoIndentOn && calvaConfig.getConfig().format ? [
            // When Calva is the formatter disable all vscode default indentation
            // (By outdenting a lot, which is the only way I have found that works)
            // TODO: Make it actually consider whether Calva is the formatter or not
            {
                beforeText: /.*/,
                action: {
                    indentAction: vscode.IndentAction.Outdent,
                    removeText: Number.MAX_VALUE
                }
            },
        ] : []
    }
}

export function activate(context: vscode.ExtensionContext) {
    config.updateConfig();
    docmirror.activate(context);
    vscode.languages.setLanguageConfiguration("clojure", getLanguageConfiguration(config.getConfig()["format-as-you-type"]));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.formatCurrentForm', formatter.formatPositionCommand));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('calva-fmt.alignCurrentForm', formatter.alignPositionCommand));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(calvaConfig.documentSelector, new FormatOnTypeEditProvider, "\r", "\n"));
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(calvaConfig.documentSelector, new RangeEditProvider));
    vscode.workspace.onDidChangeConfiguration(e => {
        config.onConfigurationChanged(e);
    });
    setTimeout(() => config.maybeNagAboutParinferExtension(config.getConfig()), 5000);
}
