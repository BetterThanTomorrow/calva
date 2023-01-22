import vscode from 'vscode';
import os from 'os';

const bar = 'bar';

function hello() {
  return 'hello';
}

function platform() {
  return os.platform();
}

function showMessage(message: string) {
  void vscode.window.showInformationMessage(message);
}

export { bar, hello, platform, showMessage };
