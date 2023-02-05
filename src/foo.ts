import vscode from 'vscode';
import os from 'os';
import { someFunction } from './bar';
import * as cljsLib from '../out/cljs-lib/out/cljs-lib.js';

export function hello() {
  return 'hello';
}

export function callSomeFunctionFromBar() {
  return someFunction();
}

export function platform() {
  return os.platform();
}

export function cljsLibParseForms(forms: string) {
  return cljsLib.parseForms(forms);
}

export function showMessage(message: string) {
  void vscode.window.showInformationMessage(message);
}
