import * as vscode from 'vscode';

const vscodeShowErrorMessage = vscode.window.showErrorMessage;

async function calvaShowErrorMessage<T extends string>(message: string, ...items: T[]) {
  const exlusionRegexps = [/Request textDocument\/codeAction failed./];
  if (!exlusionRegexps.some((re) => re.test(message))) {
    return vscodeShowErrorMessage(message, ...items);
  }
}

export function activate() {
  vscode.window.showErrorMessage = calvaShowErrorMessage;
}
