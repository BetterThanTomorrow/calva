import vscode from 'vscode';
import state from '../state';
import util from '../utilities';

export default class JarContentProvider implements vscode.TextDocumentContentProvider {
  state: any;

  constructor() {
    this.state = state;
  }

  provideTextDocumentContent(uri, token) {
    return util.getJarContents(uri);
  }
}
