import * as vscode from 'vscode';
import * as filesCache from './files-cache';
import * as cljsLib from '../out/cljs-lib/cljs-lib.js';
import * as lsp from './lsp';

const defaultCljfmtContent =
  '\
{:remove-surrounding-whitespace? true\n\
 :remove-trailing-whitespace? true\n\
 :remove-consecutive-blank-lines? false\n\
 :insert-missing-whitespace? true\n\
 :align-associative? false}';

const LSP_CONFIG_KEY = 'CLOJURE-LSP';
let lspFormatConfig: string | undefined;

function cljfmtOptionsFromString(cljfmt: string) {
  const options = cljsLib.cljfmtOptionsFromString(cljfmt);
  return {
    ...options,
    // because we can't correctly pass ordered map from cljs
    // but we need it to determine the order of applying indent rules
    indents: Object.fromEntries(options['indents']),
  };
}

function configuration(workspaceConfig: vscode.WorkspaceConfiguration, cljfmt: string) {
  return {
    'format-as-you-type': !!formatOnTypeEnabled(),
    'keep-comment-forms-trail-paren-on-own-line?': !!workspaceConfig.get<boolean>(
      'keepCommentTrailParenOnOwnLine'
    ),
    'cljfmt-options-string': cljfmt,
    'cljfmt-options': cljfmtOptionsFromString(cljfmt),
  };
}

export type FormatterConfig = Partial<Awaited<ReturnType<typeof getConfig>>>;

export async function getConfig(
  document: vscode.TextDocument = vscode.window.activeTextEditor?.document
): Promise<{
  'format-as-you-type': boolean;
  'keep-comment-forms-trail-paren-on-own-line?': boolean;
  'cljfmt-options-string': string;
  'cljfmt-options': object;
}> {
  const workspaceConfig = vscode.workspace.getConfiguration('calva.fmt');
  const configPath: string | undefined = workspaceConfig.get('configPath');

  if (configPath === LSP_CONFIG_KEY && document) {
    const clientProvider = lsp.getClientProvider();
    const client = clientProvider.getClientForDocumentUri(document.uri);
    if (client && client.isRunning) {
      lspFormatConfig = await lsp.api.getCljFmtConfig(client);
    }
    if (client.isRunning && !lspFormatConfig) {
      console.error(
        'Fetching formatting settings from clojure-lsp failed. Check that you are running a version of clojure-lsp that provides "cljfmt-raw" in serverInfo.'
      );
    }
  }
  const cljfmtContent: string | undefined =
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
    void vscode.window.showErrorMessage(
      `Error parsing ${configPath}: ${config['cljfmt-options']['error']}\n\nUsing default formatting configuration.`
    );
    return configuration(workspaceConfig, defaultCljfmtContent);
  }
}

export function formatOnTypeEnabled() {
  return (
    vscode.workspace.getConfiguration('editor').get('formatOnType') ||
    vscode.workspace
      .getConfiguration('editor')
      .inspect('formatOnType')
      .languageIds.includes('clojure')
  );
}
