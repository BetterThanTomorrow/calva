import * as vscode from 'vscode';
import * as filesCache from '../../files-cache';
import * as cljsLib from '../../../out/cljs-lib/cljs-lib.js';
import * as lsp from '../../lsp/main';
const defaultCljfmtContent =
    '\
{:remove-surrounding-whitespace? true\n\
 :remove-trailing-whitespace? true\n\
 :remove-consecutive-blank-lines? false\n\
 :insert-missing-whitespace? true\n\
 :align-associative? false}';

const LSP_CONFIG_KEY = 'CLOJURE-LSP';
let lspFormatConfig: string;
let lspFormatConfigFetched = false;

function configuration(
    workspaceConfig: vscode.WorkspaceConfiguration,
    cljfmt: string
) {
    return {
        'format-as-you-type': workspaceConfig.get<boolean>('formatAsYouType'),
        'keep-comment-forms-trail-paren-on-own-line?':
            workspaceConfig.get<boolean>('keepCommentTrailParenOnOwnLine'),
        'cljfmt-options-string': cljfmt,
        'cljfmt-options': cljsLib.cljfmtOptionsFromString(cljfmt),
    };
}

async function readConfiguration(): Promise<{
    'format-as-you-type': boolean;
    'keep-comment-forms-trail-paren-on-own-line?': boolean;
    'cljfmt-options-string': string;
    'cljfmt-options': object;
}> {
    const workspaceConfig = vscode.workspace.getConfiguration('calva.fmt');
    const configPath: string = workspaceConfig.get('configPath');
    if (configPath === LSP_CONFIG_KEY && !lspFormatConfigFetched) {
      try {
        lspFormatConfig = await lsp.getCljFmtConfig(); 
        lspFormatConfigFetched = true;
      } catch (_) {
        lspFormatConfigFetched = true;
      }
    }
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

export async function getConfig() {
    const config = await readConfiguration();
    return config;
}
