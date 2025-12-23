import * as path from 'path';

export interface WorkspaceFolderInfo {
  fsPath: string;
  name?: string;
}

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

export function buildGlobCandidatePaths(fsPath: string, folders: WorkspaceFolderInfo[]): string[] {
  if (!fsPath) {
    return [];
  }

  const candidates = new Set<string>();
  const normalizedAbsolute = toPosixPath(fsPath);
  candidates.add(normalizedAbsolute);
  candidates.add(toPosixPath(path.basename(fsPath)));

  folders.forEach((folder) => {
    if (!folder?.fsPath) {
      return;
    }
    const relative = path.relative(folder.fsPath, fsPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return;
    }

    const normalizedRelative = toPosixPath(relative);
    candidates.add(normalizedRelative);

    if (folder.name) {
      candidates.add(toPosixPath(`${folder.name}/${normalizedRelative}`));
    }
  });

  return Array.from(candidates).filter(Boolean);
}
