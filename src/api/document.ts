import * as vscode from 'vscode';
import * as namespace from '../namespace';

export function getNamespace(document?: vscode.TextDocument) {
  return namespace.getDocumentNamespace(document || {})?.[0] ?? null;
}

export const getNamespaceAndNsForm = namespace.getDocumentNamespace;
