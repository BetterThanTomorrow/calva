import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as which from 'which';
import * as screenshot from 'screenshot-desktop';
import * as state from '../../../state';
import * as projectRoot from '../../../project-root';
import * as clientRegistry from '../../../nrepl/client-registry';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as jackIn from '../../../nrepl/jack-in';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as output from '../../../results-output/output';
import { normalizeDestinations } from '../../../results-output/output-destinations';
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

  await waitForCondition(
    () => vscode.window.activeTextEditor?.document.uri.fsPath === filePath,
    4000,
    20,
    `Timed out waiting for active editor to open ${filePath}`
  );

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

export async function waitForValue<T>(
  selector: () => T | undefined | Promise<T | undefined>,
  timeoutMs = 4000,
  intervalMs = 50,
  timeoutMessage = 'Timed out waiting for value'
): Promise<T> {
  const start = Date.now();
  while (true) {
    const value = await selector();
    if (value !== undefined) {
      return value;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(timeoutMessage);
    }
    await sleep(intervalMs);
  }
}

export interface WaitForStableValueResult<T> {
  value: T;
  intermediateCount: number;
  stableAfterMs: number;
}

export async function waitForStableValue<T>(
  selector: () => T | undefined | Promise<T | undefined>,
  stableMs = 100,
  timeoutMs = 4000,
  intervalMs = 20,
  timeoutMessage = 'Timed out waiting for stable value'
): Promise<WaitForStableValueResult<T>> {
  const start = Date.now();
  let lastValue: T | undefined;
  let lastChangeTime: number | undefined;
  let intermediateCount = 0;

  while (true) {
    const value = await selector();
    if (value !== undefined) {
      if (lastValue === undefined || value !== lastValue) {
        if (lastValue !== undefined) {
          intermediateCount++;
        }
        lastValue = value;
        lastChangeTime = Date.now();
      }
      if (lastChangeTime !== undefined && Date.now() - lastChangeTime >= stableMs) {
        return {
          value: lastValue,
          intermediateCount,
          stableAfterMs: Date.now() - start,
        };
      }
    }
    if (Date.now() - start > timeoutMs) {
      if (lastValue !== undefined) {
        return {
          value: lastValue,
          intermediateCount,
          stableAfterMs: Date.now() - start,
        };
      }
      throw new Error(timeoutMessage);
    }
    await sleep(intervalMs);
  }
}

export async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 4000,
  intervalMs = 50,
  timeoutMessage = 'Timed out waiting for condition'
) {
  await waitForValue(
    async () => ((await predicate()) ? true : undefined),
    timeoutMs,
    intervalMs,
    timeoutMessage
  );
}

export async function waitForNewClient(
  suite: string,
  sinceConnectedAt = 0,
  timeoutMs = 60_000,
  intervalMs = 250
) {
  const client = await waitForValue(
    () => {
      const clients = clientRegistry.listClients();
      const newest = clients[clients.length - 1];
      return newest && newest.connectedAt > sinceConnectedAt ? newest : undefined;
    },
    timeoutMs,
    intervalMs,
    'Timed out waiting for new jack-in client'
  );
  log(
    suite,
    `Detected new client ${client.connectSequenceName ?? client.key} (${
      client.projectRoot ?? 'no-root'
    })`
  );
  return client;
}

export async function waitForJackInCompletionCount(
  suite: string,
  previousCount = 0,
  timeoutMs = 60_000,
  intervalMs = 250
): Promise<number> {
  const currentCount = await waitForValue(
    async () => {
      const resultsEditor = await outputWindow.openReplWindowDoc();
      const text = getDocument(resultsEditor).document.getText();
      const matchCount = (text.match(/Jack-in done\./g) || []).length;
      return matchCount > previousCount ? matchCount : undefined;
    },
    timeoutMs,
    intervalMs,
    'Timed out waiting for jack-in completion output'
  );
  log(suite, 'Jack-in completion detected');
  return currentCount;
}

export async function waitForSessionsReady(
  suite: string,
  clientKey: string,
  expectedSessionKeys?: string[],
  timeoutMs = 60_000,
  intervalMs = 250
): Promise<string[]> {
  const sessionKeys = await waitForValue(
    () => {
      const sessions = sessionRegistry.listSessionsByClient(clientKey);
      const keys = sessions.map((session) => session.key);
      if (expectedSessionKeys) {
        return expectedSessionKeys.every((expectedKey) => keys.includes(expectedKey))
          ? keys
          : undefined;
      }
      return keys.length > 0 ? keys : undefined;
    },
    timeoutMs,
    intervalMs,
    'Timed out waiting for sessions to be ready'
  );
  log(suite, `Sessions ready for client ${clientKey}: ${sessionKeys.join(', ')}`);
  return sessionKeys;
}

export async function waitForJackOutComplete(
  suite: string,
  timeoutMs = 60_000,
  intervalMs = 50
): Promise<void> {
  await waitForCondition(
    () =>
      jackIn.listJackInProcesses().length === 0 &&
      clientRegistry.listClients().length === 0 &&
      sessionRegistry.listSessions().length === 0,
    timeoutMs,
    intervalMs,
    'Timed out waiting for jack-out cleanup'
  );
  log(suite, 'Jack-out cleanup complete');
}

/**
 * Retries a jack-in sequence on failure. Useful in CI where resource pressure
 * can cause the nREPL handshake to fail transiently. On each failed attempt,
 * forces a full jack-out before retrying.
 */
export async function withJackInRetry(
  suite: string,
  jackInAction: () => Promise<void>,
  opts: {
    maxAttempts?: number;
    waitForClientSince?: number;
    expectedSessionKeys?: string[];
  } = {}
): Promise<{ clientKey: string; sessionKeys: string[] }> {
  const maxAttempts = opts.maxAttempts ?? (isCircleCI ? 3 : 1);
  const sinceConnectedAt = opts.waitForClientSince ?? 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await jackInAction();
      const client = await waitForNewClient(suite, sinceConnectedAt, 60_000);
      const sessionKeys = await waitForSessionsReady(suite, client.key, opts.expectedSessionKeys);
      log(suite, `Jack-in succeeded on attempt ${attempt}`);
      return { clientKey: client.key, sessionKeys };
    } catch (e) {
      log(suite, `Jack-in attempt ${attempt}/${maxAttempts} failed: ${e}`);
      if (attempt < maxAttempts) {
        log(suite, 'Cleaning up before retry...');
        try {
          await jackIn.calvaJackout({ force: true });
          await waitForJackOutComplete(suite, 30_000);
        } catch (cleanupErr) {
          log(suite, `Cleanup error (ignoring): ${cleanupErr}`);
        }
      } else {
        throw e;
      }
    }
  }
  // unreachable, but satisfies TypeScript
  throw new Error('withJackInRetry: exhausted attempts');
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
    await waitForSessionsReady(this.suiteName, clientKey);
    log(this.suiteName, 'Jack-in complete for client', clientKey);
    return clientKey;
  }

  async jackInWithConnectSequence(
    filePath: string,
    connectSequence: unknown,
    disableAutoSelect = true,
    expectedSessionKeys?: string[]
  ): Promise<string> {
    const { clientKey } = await withJackInRetry(
      this.suiteName,
      async () => {
        await openFile(filePath);
        log(this.suiteName, `Opened file for jack-in: ${filePath}`);
        await vscode.commands.executeCommand('calva.jackIn', {
          connectSequence,
          disableAutoSelect,
        });
      },
      {
        waitForClientSince: this.lastSeenClientConnectedAt,
        expectedSessionKeys,
      }
    );
    const clients = clientRegistry.listClients();
    const client = clients.find((c) => c.key === clientKey);
    if (client) {
      this.lastSeenClientConnectedAt = client.connectedAt;
    }
    await this.waitForJackInCompletion();
    log(this.suiteName, 'Jack-in complete for client', clientKey);
    return clientKey;
  }

  async waitForNextClient(timeoutMs = 60_000): Promise<string> {
    const client = await waitForNewClient(
      this.suiteName,
      this.lastSeenClientConnectedAt,
      timeoutMs
    );
    this.lastSeenClientConnectedAt = client.connectedAt;
    return client.key;
  }

  async waitForJackInCompletion(timeoutMs = 60_000): Promise<void> {
    if (
      !normalizeDestinations(output.getDestinationConfiguration().otherOutput).includes(
        'repl-window'
      )
    ) {
      log(
        this.suiteName,
        'Skipping REPL-window jack-in completion wait because other output is not routed there'
      );
      return;
    }
    this.lastJackInDoneCount = await waitForJackInCompletionCount(
      this.suiteName,
      this.lastJackInDoneCount,
      timeoutMs
    );
  }
}
