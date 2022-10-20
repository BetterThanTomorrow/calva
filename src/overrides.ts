import * as vscode from 'vscode';

const vscodeShowErrorMessage = vscode.window.showErrorMessage;

async function calvaShowErrorMessage(message: string) {
  const exlusionRegexps = [/Request textDocument\/codeAction failed./];
  if (!exlusionRegexps.some((re) => re.test(message))) {
    return vscodeShowErrorMessage(message);
  }
}

export function activate() {
  vscode.window.showErrorMessage = calvaShowErrorMessage;
}
