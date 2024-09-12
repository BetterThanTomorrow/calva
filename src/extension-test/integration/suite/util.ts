import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as which from 'which';
import * as screenshot from 'screenshot-desktop';

export const testDataDir = path.join(
  __dirname,
  ...['..', '..', '..', '..'],
  'test-data',
  'integration-test'
);

export const isCircleCI = process.env.CIRCLECI === 'true';

// The top level directory where screenshots will be stored.
const screenshotsDir = path.join(__dirname, '../screenshots');

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

// Captures a screenshot and saves it to
// <screenshotsDir>/SUITE/TESTNAME.png. Waits DELAYMS milliseconds
// before capturing. Returns the file path or null on error.
export async function captureScreenshot(
  suite: string,
  testName: string,
  delayMs: number
): Promise<string> {
  let outputPath = path.join(screenshotsDir, suite, `${testName}.png`);

  try {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const imageBuffer = await screenshot();

    fs.writeFileSync(outputPath, imageBuffer);
    log(suite, `Screenshot saved to ${outputPath}`);
  } catch (error) {
    log(suite, 'Error capturing screenshot:', error);
    outputPath = null;
  }
  return outputPath;
}

// Attempts to creates a wrapper around all functions and properties
// of vscode.TextEditor EDITOR and returns it. This enables `sinon` to
// spy even on read-only properties andfunctions of the EDITOR.
export function createVscTextEditorProxy(editor: vscode.TextEditor): vscode.TextEditor {
  const proxyEditor = {} as unknown as vscode.TextEditor;

  Object.keys(editor).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(editor, key);
    {
      const realValue = (editor as any)[key];
      if (typeof realValue === 'function') {
        (proxyEditor as any)[key] = (...args: any[]) => {
          return realValue.apply(editor, args);
        };
      } else {
        Object.defineProperty(proxyEditor, key, {
          get: descriptor.get,
          set: descriptor.set,
          configurable: descriptor.configurable,
          enumerable: descriptor.enumerable,
        });
      }
    }
  });

  return proxyEditor;
}
