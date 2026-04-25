import * as path from 'path';

/**
 * Resolves a file argument to an absolute file path string.
 *
 * Accepts:
 *  - A URI-like object with a `.scheme` property and `.fsPath` (returns fsPath)
 *  - A string (absolute path returned as-is, relative resolved against workspaceRoot)
 *  - A string[] of path segments (joined, then resolved like a string)
 *
 * Returns `undefined` when the argument is absent/empty or cannot be resolved.
 */
export function resolveFilePath(
  arg: unknown,
  workspaceRoot: string | undefined
): string | undefined {
  if (arg == null) {
    return undefined;
  }

  // URI-like object — duck-type check for `.scheme` + `.fsPath`
  if (typeof arg === 'object' && !Array.isArray(arg) && typeof (arg as any).scheme === 'string') {
    const fsPath = (arg as any).fsPath;
    return typeof fsPath === 'string' ? fsPath : undefined;
  }

  let raw: string | undefined;
  if (typeof arg === 'string') {
    raw = arg;
  } else if (Array.isArray(arg) && arg.length > 0 && arg.every((s) => typeof s === 'string')) {
    raw = path.join(...arg);
  }

  if (!raw) {
    return undefined;
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  // Workspace-relative
  if (workspaceRoot) {
    return path.join(workspaceRoot, raw);
  }

  return undefined;
}
