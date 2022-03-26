import * as path from 'path';
import * as vscode from 'vscode';

export const testDataDir = path.join(
  __dirname,
  ...['..', '..', '..', '..'],
  'test-data',
  'integration-test'
);

export async function openFile(filePath: string) {
  const uri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);

  await sleep(300);

  return editor;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function log(suite: string, ...things: any[]) {
  console.log(`Integration testing, ${suite}:`, ...things);
}