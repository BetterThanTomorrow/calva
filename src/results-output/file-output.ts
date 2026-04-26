/**
 * File-path output destination support.
 * Handles path detection, resolution, tilde expansion, file writing, and error deduplication.
 * Free of VS Code dependencies except for the error-reporting callback pattern.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveFilePath } from '../util/resolve-file-arg';

/**
 * Returns true if the destination string looks like a file path.
 * Matches: `./`, `../`, `/`, `\`, `~/`, or a Windows drive letter (`C:\`, `D:/`).
 * Bare strings like `"terminal"` or `"repl-window"` do NOT match.
 */
const FILE_PATH_RE = /^([a-zA-Z]:|~|\.{0,2})[/\\]|^[/\\]/;

export function isFilePathDestination(dest: string): boolean {
  return FILE_PATH_RE.test(dest);
}

/**
 * Replaces a leading `~/` or `~\` with `os.homedir()`.
 * Does NOT expand `~user/` forms.
 */
export function expandTilde(p: string): string {
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/**
 * Resolves a file-path destination to an absolute path.
 * Handles tilde expansion, then delegates to `resolveFilePath`.
 * A `destination` may be a string or a `string[]` of path segments.
 */
export function resolveOutputFilePath(
  destination: string | string[],
  workspaceRoot: string | undefined
): string | undefined {
  if (typeof destination === 'string') {
    return resolveFilePath(expandTilde(destination), workspaceRoot);
  }
  // Array of path segments — join first, then expand + resolve
  const joined = path.join(...destination);
  return resolveFilePath(expandTilde(joined), workspaceRoot);
}

/**
 * Appends text to a file, creating parent directories as needed.
 */
export async function appendToOutputFile(resolvedPath: string, text: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.promises.appendFile(resolvedPath, text, 'utf-8');
}

// --- Error deduplication ---

const reportedErrors = new Set<string>();

/**
 * Reports a file-output error. Calls `showError` only on the first occurrence
 * per destination string per session. Logs to `console.error` on every occurrence.
 */
export function reportFileOutputError(
  destination: string,
  error: Error,
  showError: (msg: string) => void
): void {
  const message = `Calva: Failed to write output to file "${destination}": ${error.message}`;
  console.error(message, error);
  if (!reportedErrors.has(destination)) {
    reportedErrors.add(destination);
    showError(message);
  }
}

/**
 * Resets the error deduplication state. For testing only.
 */
export function resetFileOutputErrors(): void {
  reportedErrors.clear();
}
