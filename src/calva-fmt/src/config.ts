import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import * as cljsLib from '../../../out/cljs-lib/cljs-lib.js';

const defaultCljfmtContent =
    '\
{:remove-surrounding-whitespace? true\n\
 :remove-trailing-whitespace? true\n\
 :remove-consecutive-blank-lines? false\n\
 :insert-missing-whitespace? true\n\
 :align-associative? false}';

const LSP_CONFIG_KEY = 'CLOJURE-LSP';
let lspFormatConfig: string;

function configuration(
    workspaceConfig: vscode.WorkspaceConfiguration,
    cljfmt: string
) {
    const config = {
        'format-as-you-type': workspaceConfig.get('formatAsYouType') as boolean,
        'keep-comment-forms-trail-paren-on-own-line?': workspaceConfig.get(
            'keepCommentTrailParenOnOwnLine'
        ) as boolean,
    };
    config['cljfmt-options-string'] = cljfmt;
    config['cljfmt-options'] = cljsLib.cljfmtOptionsFromString(cljfmt);
    return config;
}

function readConfiguration() {
    const workspaceConfig = vscode.workspace.getConfiguration('calva.fmt');
    const configPath: string = workspaceConfig.get('configPath');
    if (configPath === LSP_CONFIG_KEY && !lspFormatConfig) {
        vscode.window.showErrorMessage(
            'Fetching formatting settings from clojure-lsp failed. Check that you are running a version of clojure-lsp that provides "cljfmt-raw" in serverInfo.',
            'Roger that'
        );
    }
    const cljfmtContent: string =
        configPath === LSP_CONFIG_KEY
            ? lspFormatConfig
                ? lspFormatConfig
                : defaultCljfmtContent
            : filesCache.content(configPath);
    const config = configuration(
        workspaceConfig,
        cljfmtContent ? cljfmtContent : defaultCljfmtContent
    );
    if (!config['cljfmt-options']['error']) {
        return config;
    } else {
        vscode.window.showErrorMessage(
            `Error parsing ${configPath}: ${config['cljfmt-options']['error']}\n\nUsing default formatting configuration.`
        );
        return configuration(workspaceConfig, defaultCljfmtContent);
    }
}

export function setLspFormatConfig(config: string) {
    lspFormatConfig = config;
}

export function getConfig() {
    const config = readConfiguration();
    return config;
}
