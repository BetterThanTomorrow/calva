import * as vscode from 'vscode';

export function selectionFromOffsetRange(
  doc: vscode.TextDocument,
  range: [number, number]
): vscode.Selection {
  return new vscode.Selection(doc.positionAt(range[0]), doc.positionAt(range[1]));
}
