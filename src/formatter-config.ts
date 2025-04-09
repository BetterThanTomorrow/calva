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
let lspFormatDate: number = 0;
const lspFormatTTLms: number = 6000;

function configuration(): {
  'format-as-you-type': boolean;
  'keep-comment-forms-trail-paren-on-own-line?': boolean;
  'cljfmt-options-string': string;
  'cljfmt-options': object;
} {
  const workspaceConfig = vscode.workspace.getConfiguration('calva.fmt');
  const configPath: string | undefined = getConfigPath(workspaceConfig);

  const cljfmtContent: string | undefined =
    configPath === LSP_CONFIG_KEY
      ? lspFormatConfig
        ? lspFormatConfig
        : defaultCljfmtContent
      : filesCache.content(configPath);
  const cljfmt = cljfmtContent ? cljfmtContent : defaultCljfmtContent;
  const cljfmtOptions = cljsLib.cljfmtOptionsFromString(cljfmt);
  return {
    'format-as-you-type': !!formatOnTypeEnabled(),
    'keep-comment-forms-trail-paren-on-own-line?': !!workspaceConfig.get<boolean>(
      'keepCommentTrailParenOnOwnLine'
    ),
    'cljfmt-options-string': cljfmt,
    'cljfmt-options': cljfmtOptions,
  };
}

function getConfigPath(workspaceConfig: vscode.WorkspaceConfiguration): string | undefined {
  const pathFromSettings = workspaceConfig.get<string>('configPath');
  if (pathFromSettings) {
    return pathFromSettings;
  }
  // if not set, check default cljfmt paths (https://github.com/weavejester/cljfmt#configuration)
  const configFileNames = ['.cljfmt.edn', '.cljfmt.clj', 'cljfmt.edn', 'cljfmt.clj'];
  return configFileNames.find((configPath) => {
    return filesCache.content(configPath);
  });
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
  const configPath: string | undefined = getConfigPath(workspaceConfig);

  if (configPath === LSP_CONFIG_KEY && document) {
    const clientProvider = lsp.getClientProvider();
    const client = clientProvider.getClientForDocumentUri(document.uri);
    if (client && client.isRunning) {
      lspFormatConfig = await lsp.api.getCljFmtConfig(client);
      if (!lspFormatConfig) {
        console.error(
          'Fetching formatting settings from clojure-lsp failed. Check that you are running a version of clojure-lsp that provides "cljfmt-raw" in serverInfo.'
        );
      } else {
        lspFormatDate = Date.now();
      }
    }
  }
  return configuration();
}

/**
 * @param document
 * @returns FormatterConfig, possibly with cached or default LSP information
 */
export function getConfigNow(
  document: vscode.TextDocument = vscode.window.activeTextEditor?.document
): FormatterConfig {
  // Begin async update from LSP if stale:
  if (Date.now() - lspFormatDate > lspFormatTTLms) {
    void getConfig(document);
  }
  // Config using cached LSP info:
  return configuration();
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
