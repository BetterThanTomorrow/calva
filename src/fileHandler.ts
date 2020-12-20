import * as vscode from 'vscode';
import { resolveNsName } from './util/ns-form';
import * as fs from 'fs';
import * as namespace from './namespace';

function isCljFile(filePath: string): boolean {
  return filePath && ((filePath.endsWith(".clj")
    || filePath.endsWith(".cljs")
    || filePath.endsWith(".cljc")));
}

async function handleNewCljFiles(e: vscode.FileCreateEvent) {
  const textDocuments: vscode.TextDocument[] = [];
  for (let file of e.files) {
    if (!isCljFile(file.fsPath)) {
      continue;
    }
    const textDocument = await vscode.workspace.openTextDocument(file);
    if (textDocument.getText()) { // Ignore non-empty files.
      continue;
    }
    textDocuments.push(textDocument);
  }
  if (!textDocuments.length) {
    return;
  }
  let sourcePaths: string[] = [];
  const client = namespace.getSession();
  if (client) {
      const resp = await client.classpath();
      if (resp && resp.classpath) {
        sourcePaths = resp.classpath.filter(p => fs.existsSync(p) && fs.lstatSync(p).isDirectory());
      }
  }
  for (let textDocument of textDocuments) {
      const nsname: string = resolveNsName(sourcePaths, textDocument.fileName);
      const snippet: string[] = [];
      snippet.push(`(ns ${nsname}\$1)`);
      snippet.push("");
      const textEditor = await vscode.window.showTextDocument(textDocument);
      textEditor.insertSnippet(new vscode.SnippetString(snippet.join("\n")));
  }
}

export default handleNewCljFiles;
