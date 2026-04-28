import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';

export class JarContentProvider implements vscode.TextDocumentContentProvider {
  state: any;

  constructor() {
    this.state = state;
  }

  provideTextDocumentContent(uri, token) {
    return util.getJarContents(uri);
  }
}
