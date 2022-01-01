import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import { cljfmtOptions } from '../../../out/cljs-lib/cljs-lib.js';
import * as docMirror from '../../doc-mirror';

type FormatConfig = {
    "keep-comment-forms-trail-paren-on-own-line?": boolean,
    "infer-parens-as-you-type": boolean,
    "full-format-on-type": boolean,
    "alert-on-parinfer-problems": boolean,
    "cljfmt-string": string,
    "cljfmt-options": any
}

let CONFIG: FormatConfig;

export function updateConfig() {
    CONFIG = _updateConfig();
    if (docMirror.statusBar) {
        docMirror.statusBar.update(vscode.window.activeTextEditor?.document);
    }
}

export function getConfig(): FormatConfig {
    return CONFIG;
}

const defaultCljfmtContent = "\
{:remove-surrounding-whitespace? true\n\
 :remove-trailing-whitespace? true\n\
 :remove-consecutive-blank-lines? false\n\
 :insert-missing-whitespace? true\n\
 :align-associative? false}";

function globalOrDefault(wsConfig: vscode.WorkspaceConfiguration, key: string) {
    const config = wsConfig.inspect(key);
    return config.globalValue === undefined ? config.defaultValue : config.globalValue;
}

function configuration(workspaceConfig: vscode.WorkspaceConfiguration, cljfmtString: string): FormatConfig {
    return {
        "full-format-on-type": globalOrDefault(workspaceConfig, "experimental.fullFormatOnType") as boolean,
        "infer-parens-as-you-type": globalOrDefault(workspaceConfig, "experimental.inferParensAsYouType") as boolean,
        "alert-on-parinfer-problems": globalOrDefault(workspaceConfig, "experimental.alertOnParinferProblems") as boolean,
        "keep-comment-forms-trail-paren-on-own-line?": workspaceConfig.get("keepCommentTrailParenOnOwnLine"),
        "cljfmt-string": cljfmtString,
        "cljfmt-options": cljfmtOptions(cljfmtString)
    };
}

let hasNaggedAboutParinferConflict = false;

export function maybeNagAboutParinferExtension(config: FormatConfig) {
    const parinferExtension = vscode.extensions.getExtension('shaunlebron.vscode-parinfer') || vscode.extensions.getExtension('eduarddyckman.vscode-parinfer');
    const parinferExtensionIsActive = parinferExtension && parinferExtension.isActive;
    if (config['infer-parens-as-you-type']) {
        if (!hasNaggedAboutParinferConflict && parinferExtensionIsActive) {
            vscode.window.showWarningMessage(`Extension ${parinferExtension.id} is enabled, this will conflict with Calva's Parinfer implementation.`, "OK, I'll disable that other extension");
            hasNaggedAboutParinferConflict = true;
        }
    }
}

function _updateConfig(): FormatConfig {
    const workspaceConfig = vscode.workspace.getConfiguration("calva.fmt");
    const configPath: string = workspaceConfig.get("configPath");
    const cljfmtContent: string = filesCache.content(configPath);
    const config = configuration(workspaceConfig, cljfmtContent ? cljfmtContent : defaultCljfmtContent);
    const editorConfig = vscode.workspace.getConfiguration("editor", { languageId: 'clojure' });
    if (config['infer-parens-as-you-type']) {
        editorConfig.update("autoClosingBrackets", 'never', true, true);
        editorConfig.update("autoClosingOvertype", 'never', true, true);
    } else {
        let keyMap = vscode.workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
        keyMap = String(keyMap).trim().toLowerCase();
        const isStrict = keyMap === 'strict';
        editorConfig.update("autoClosingBrackets", isStrict ? 'always' : 'never', true, true);                
        editorConfig.update("autoClosingOvertype", isStrict ? 'always' : 'never', true, true);                
    }

    editorConfig.update("formatOnPaste", !(config['infer-parens-as-you-type'] || config['full-format-on-type']), true, true);
        
    maybeNagAboutParinferExtension(config);
    if (!config["cljfmt-options"]["error"]) {
        return config;
    } else {
        vscode.window.showErrorMessage(`Error parsing ${configPath}: ${config["cljfmt-options"]["error"]}\n\nUsing default formatting configuration.`);
        return configuration(workspaceConfig, defaultCljfmtContent)
    }
}

export function onConfigurationChanged(e: vscode.ConfigurationChangeEvent) {
    if (e.affectsConfiguration("calva.fmt")) {
        updateConfig();
        if (e.affectsConfiguration('calva.fmt.experimental.inferParensAsYouType')) {
            const config = vscode.workspace.getConfiguration("calva.fmt");
            if (config.get('experimental.inferParensAsYouType')) {
                vscode.window.showInformationMessage('Parinfer toggled ON. It is an experimental feature. Please make sure to read calva.io/parinfer to learn about what you can expect.', 'OK');
            } else {
                vscode.window.showInformationMessage('Parinfer toggled OFF. Some settings are automatically changed for you. Please make sure to read calva.io/parinfer to learn about it.', 'OK');
            }
        }
    }
}