import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import {
    cljfmtOptionsFromString,
    cljfmtOptions,
} from '../../../out/cljs-lib/cljs-lib.js';

const defaultCljfmtContent =
    '\
{:remove-surrounding-whitespace? true\n\
 :remove-trailing-whitespace? true\n\
 :remove-consecutive-blank-lines? false\n\
 :insert-missing-whitespace? true\n\
 :align-associative? false}';

const LSP_CONFIG_KEY = 'CLOJURE-LSP';
let lspFormatConfig: Object;

function configuration(
    workspaceConfig: vscode.WorkspaceConfiguration,
    cljfmt: string | Object
) {
    const config = {
        'format-as-you-type': workspaceConfig.get('formatAsYouType') as boolean,
        'keep-comment-forms-trail-paren-on-own-line?': workspaceConfig.get(
            'keepCommentTrailParenOnOwnLine'
        ) as boolean,
    };
    if (typeof cljfmt === 'string') {
        config['cljfmt-options'] = cljfmtOptionsFromString(cljfmt);
    } else {
        config['cljfmt-options'] = cljfmtOptions(cljfmt);
    }
    return config;
}

function readConfiguration() {
    const workspaceConfig = vscode.workspace.getConfiguration('calva.fmt');
    const configPath: string = workspaceConfig.get('configPath');
    const cljfmtContent: string | Object =
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

export function setLspFormatConfig(config: Object) {
    lspFormatConfig = config;
}

export function getConfig() {
    const config = readConfiguration();
    return config;
}
