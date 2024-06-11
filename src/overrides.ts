import * as vscode from 'vscode';

const vscodeShowErrorMessage = vscode.window.showErrorMessage;
const vscodeShowWarningMessage = vscode.window.showWarningMessage;

const errorExclusionRegexps: RegExp[] = [/Request textDocument\/codeAction failed./];
const warningExclusionRegexps: RegExp[] = [];

export function addErrorExclusionRegexp(re: RegExp) {
  errorExclusionRegexps.push(re);
}

export function addWarningExclusionRegexp(re: RegExp) {
  warningExclusionRegexps.push(re);
}

async function calvaShowErrorMessage<T extends string>(message: string, ...items: T[]) {
  if (!errorExclusionRegexps.some((re) => re.test(message))) {
    return vscodeShowErrorMessage(message, ...items);
  } else {
    console.error(`Calva: ${message}`);
  }
}

async function calvaShowWarningMessage<T extends string>(message: string, ...items: T[]) {
  if (!warningExclusionRegexps.some((re) => re.test(message))) {
    return vscodeShowWarningMessage(message, ...items);
  } else {
    console.info(`Calva: ${message}`);
  }
}

export function activate() {
  vscode.window.showErrorMessage = calvaShowErrorMessage;
  vscode.window.showWarningMessage = calvaShowWarningMessage;
}
