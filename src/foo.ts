//import * as vscode from 'vscode';
import * as os from 'os';

const bar = 'bar';

function hello() {
  return 'hello';
}

function platform() {
  return os.platform();
}

// function showMessage(message) {
//   void vscode.window.showInformationMessage(message);
// }

export { bar, hello };
