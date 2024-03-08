import * as vscode from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import * as clojureDocs from '../clojuredocs';
import { getConfig } from '../config';
import { evaluateSnippet } from '../custom-snippets';
import * as getText from '../util/get-text';
import * as lsp from '../lsp';
import _ = require('lodash');

export async function provideHover(
  clientProvider: lsp.ClientProvider,
  document: vscode.TextDocument,
  position: vscode.Position
) {
  if (util.getConnectedState()) {
    const text = util.getWordAtPosition(document, position);
    const [ns, _] = namespace.getNamespace(document, position);
    const client = replSession.getSession(util.getFileType(document));
    if (client && client.supports('info')) {
      await namespace.createNamespaceFromDocumentIfNotExists(document);
      const res = await client.info(ns, text);
      const customREPLHoverSnippets = getConfig().customREPLHoverSnippets;
      const hovers: vscode.MarkdownString[] = [];
      if (!res.status.includes('error') && !res.status.includes('no-info')) {
        const docsMd = infoparser.getHover(res);
        const clojureDocsMd = await clojureDocs.getExamplesHover(
          clientProvider,
          document,
          position
        );

        hovers.push(docsMd);

        if (clojureDocsMd) {
          hovers.push(clojureDocsMd);
        }
      }
      const editor = util.getActiveTextEditor();

      const context = {
        ns,
        editorNs: ns,
        repl: document.languageId === 'clojure' ? replSession.getReplSessionTypeFromState() : 'clj',
        hoverText: text,
        hoverLine: position.line + 1,
        hoverColumn: position.character + 1,
        hoverFilename: document.fileName,
        currentLine: editor.selections[0].active.line,
        currentColumn: editor.selections[0].active.character,
        currentFilename: editor.document.fileName,
        selection: editor.document.getText(editor.selections[0]),
        currentFileText: getText.currentFileText(editor.document),
        ...getText.currentClojureContext(editor.document, editor.selections[0].active),
        ...getText.currentClojureContext(document, position, 'hover'),
      };

      await Promise.all(
        customREPLHoverSnippets.map(async (snippet) => {
          try {
            const text = await evaluateSnippet(editor, snippet.snippet, context, {
              evaluationSendCodeToOutputWindow: false,
              showErrorMessage: false,
              showResult: false,
            });

            if (text) {
              const hover = new vscode.MarkdownString();
              hover.isTrusted = true;
              const hoverText = text
                .replace(/^"|"$/g, '')
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"');
              hover.appendMarkdown(hoverText);
              hovers.push(hover);
            }
          } catch (error) {
            console.log('custom hover exploded');
          }
        })
      );
      if (hovers.length) {
        return new vscode.Hover(hovers);
      }
    }
    return null; //new vscode.Hover(infoparser.getHoverNotAvailable(text));
  }
}

export default class HoverProvider implements vscode.HoverProvider {
  constructor(private readonly clientProvider: lsp.ClientProvider) {}

  async provideHover(document, position, _) {
    return provideHover(this.clientProvider, document, position);
  }
}
