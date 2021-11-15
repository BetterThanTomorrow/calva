import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import { cljfmtOptions } from '../../../out/cljs-lib/cljs-lib.js';
import * as docMirror from '../../doc-mirror';

type FormatConfig = {
    "format-as-you-type": boolean,
    "keep-comment-forms-trail-paren-on-own-line?": boolean,
    "infer-parens-as-you-type": boolean,
    "alert-on-paredit-problems": boolean,
    "format-forward-list-on-same-line": boolean,
    "cljfmt-string": string,
    "cljfmt-options": any
}

let CONFIG: FormatConfig;

export function updateConfig() {
    CONFIG = _getConfig();
    if (docMirror.statusBar) {
        docMirror.statusBar.update();
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

function configuration(workspaceConfig: vscode.WorkspaceConfiguration, cljfmtString: string): FormatConfig {
    return {
        "format-as-you-type": workspaceConfig.get("formatAsYouType") as boolean,
        "keep-comment-forms-trail-paren-on-own-line?": workspaceConfig.get("keepCommentTrailParenOnOwnLine") as boolean,
        "infer-parens-as-you-type": workspaceConfig.get("experimental.inferParensAsYouType") as boolean,
        "alert-on-paredit-problems": workspaceConfig.get("experimental.alertOnParinferProblems") as boolean,
        "format-forward-list-on-same-line": workspaceConfig.get("experimental.ßformatForward") as boolean,
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

function _getConfig(): FormatConfig {
    const workspaceConfig = vscode.workspace.getConfiguration("calva.fmt");
    const configPath: string = workspaceConfig.get("configPath");
    const cljfmtContent: string = filesCache.content(configPath);
    const config = configuration(workspaceConfig, cljfmtContent ? cljfmtContent : defaultCljfmtContent);
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
        if (e.affectsConfiguration("calva.fmt.experimental.inferParensAsYouType")) {
            const performInferParens = getConfig()['infer-parens-as-you-type'];
            docMirror.getDocuments().forEach((doc: docMirror.MirroredDocument, _key: any) => {
                doc.model.performInferParens = performInferParens;
            });
        }
        if (e.affectsConfiguration("calva.fmt.experimental.formatForward")) {
            const performFormatForward = getConfig()['format-forward-list-on-same-line'];
            docMirror.getDocuments().forEach((doc: docMirror.MirroredDocument, _key: any) => {
                doc.model.performFormatForward = performFormatForward;
            });
        }
    }
}