import * as path from 'path';
import * as vscode from 'vscode';
import * as which from 'which';

export const testDataDir = path.join(
  __dirname,
  ...['..', '..', '..', '..'],
  'test-data',
  'integration-test'
);

export const isCircleCI = process.env.CIRCLECI === 'true';

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

export function showMessage(suite: string, message: string) {
  void vscode.window.showInformationMessage(`Integration testing, ${suite}: ${message}`);
}

export function getExecutablePath(executablePathMaybe: string) {
  try {
    return which.sync(executablePathMaybe);
  } catch (_e) {
    return null;
  }
}
