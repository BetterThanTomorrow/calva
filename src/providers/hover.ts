import * as vscode from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import * as clojureDocs from '../clojuredocs';
import { getConfig } from '../config';
import { evaluateSnippet } from '../custom-snippets';
import * as getText from '../util/get-text';
import _ = require('lodash');

export async function provideHover(document: vscode.TextDocument, position: vscode.Position) {
  if (util.getConnectedState()) {
    const text = util.getWordAtPosition(document, position);
    const ns = namespace.getNamespace(document);
    const client = replSession.getSession(util.getFileType(document));
    if (client) {
      await namespace.createNamespaceFromDocumentIfNotExists(document);
      const res = await client.info(ns, text);
      const customREPLHoverSnippets = getConfig().customREPLHoverSnippets;
      const hovers: vscode.MarkdownString[] = [];
      if (!res.status.includes('error') && !res.status.includes('no-info')) {
        const docsMd = infoparser.getHover(res);
        const clojureDocsMd = await clojureDocs.getExamplesHover(document, position);

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
        currentLine: editor.selection.active.line,
        currentColumn: editor.selection.active.character,
        currentFilename: editor.document.fileName,
        selection: editor.document.getText(editor.selection),
        ...getText.currentContext(editor.document, editor.selection.active),
        ...getText.currentContext(document, position, 'hover'),
      };

      await Promise.all(
        customREPLHoverSnippets.map(async (snippet) => {
          try {
            const text = await evaluateSnippet(snippet, context, {
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
  async provideHover(document, position, _) {
    return provideHover(document, position);
  }
}
