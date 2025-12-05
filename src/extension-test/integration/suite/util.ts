import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as which from 'which';
import * as screenshot from 'screenshot-desktop';
import * as state from '../../../state';
import * as projectRoot from '../../../project-root';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import { getDocument } from '../../../doc-mirror';
import connector from '../../../connector';

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

    fs.writeFileSync(outputPath, new Uint8Array(imageBuffer));
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

export async function ensureOutputDir(projectPath: string): Promise<void> {
  const outputDir = path.join(projectPath, '.calva', 'output-window');
  try {
    await fs.promises.mkdir(outputDir, { recursive: true });
  } catch (err) {
    console.log(`Error creating output directory: ${err}`);
  }
}

export async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 4000,
  intervalMs = 50
) {
  const start = Date.now();
  while (true) {
    if (predicate()) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await sleep(intervalMs);
  }
}

export class JackInHarness {
  private lastSeenClientConnectedAt = 0;
  private lastJackInDoneCount = 0;

  constructor(private readonly suiteName: string) {}

  reset(): void {
    this.lastSeenClientConnectedAt = 0;
    this.lastJackInDoneCount = 0;
  }

  async disconnectAllClients(): Promise<void> {
    const existingClients = clientRegistry.listClients();
    for (const client of existingClients) {
      try {
        await connector.disconnect({ clientKey: client.key });
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  async jackInWithQuickPick(filePath: string, projectType: string): Promise<string> {
    await openFile(filePath);
    log(this.suiteName, `Opened file for jack-in: ${filePath}`);

    const projectRootUri = projectRoot.findClosestParent(
      vscode.window.activeTextEditor?.document.uri,
      await projectRoot.findProjectRoots()
    );
    const saveAs = `qps-${projectRootUri?.toString() ?? 'unknown-root'}/jack-in-type`;
    await state.extensionContext.workspaceState.update(saveAs, { label: projectType });

    let resolved = false;
    void vscode.commands.executeCommand('calva.jackIn').then(() => {
      resolved = true;
    });

    while (!resolved) {
      await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
      await sleep(100);
    }

    const clientKey = await this.waitForNextClient();
    await this.waitForJackInCompletion();
    await sleep(500);
    log(this.suiteName, 'Jack-in complete for client', clientKey);
    return clientKey;
  }

  async jackInWithConnectSequence(
    filePath: string,
    connectSequence: unknown,
    disableAutoSelect = true
  ): Promise<string> {
    await openFile(filePath);
    log(this.suiteName, `Opened file for jack-in: ${filePath}`);

    await vscode.commands.executeCommand('calva.jackIn', {
      connectSequence,
      disableAutoSelect,
    });

    const clientKey = await this.waitForNextClient();
    await this.waitForJackInCompletion();
    await sleep(500);
    log(this.suiteName, 'Jack-in complete for client', clientKey);
    return clientKey;
  }

  async waitForNextClient(timeoutMs = 60_000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const clients = clientRegistry.listClients();
      const newest = clients[clients.length - 1];
      if (newest && newest.connectedAt > this.lastSeenClientConnectedAt) {
        this.lastSeenClientConnectedAt = newest.connectedAt;
        log(
          this.suiteName,
          `Detected new client ${newest.connectSequenceName ?? newest.key} (${
            newest.projectRoot ?? 'no-root'
          })`
        );
        return newest.key;
      }
      log(this.suiteName, 'Waiting for new jack-in client...');
      await sleep(250);
    }
    throw new Error('Timed out waiting for new jack-in client');
  }

  async waitForJackInCompletion(timeoutMs = 60_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const resultsEditor = await outputWindow.openReplWindowDoc();
      const text = getDocument(resultsEditor).document.getText();
      const currentCount = (text.match(/Jack-in done\./g) || []).length;
      if (currentCount > this.lastJackInDoneCount) {
        this.lastJackInDoneCount = currentCount;
        log(this.suiteName, 'Jack-in completion detected');
        return;
      }
      log(this.suiteName, 'Waiting for jack-in completion output...');
      await sleep(250);
    }
    throw new Error('Timed out waiting for jack-in completion output');
  }
}
