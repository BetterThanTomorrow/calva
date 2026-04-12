export type LegacyDramFileInput = {
  path: string;
  'open?'?: boolean;
};

export type GithubDramFileInput = {
  github: string;
};

export type DramFileInput = LegacyDramFileInput | GithubDramFileInput;

export type LegacyDramFile = {
  path: string;
  'open?': boolean;
};

export type DramConfig = {
  name: string;
  files: DramFileInput[];
  open?: string[];
};

export function isLegacyDramFile(file: DramFileInput): file is LegacyDramFileInput {
  return 'path' in file;
}

export function isGithubDramFile(file: DramFileInput): file is GithubDramFileInput {
  return 'github' in file;
}

export function normalizeLegacyDramFiles(files: DramFileInput[] | undefined): LegacyDramFile[] {
  return (files ?? []).filter(isLegacyDramFile).map((file) => ({
    path: file.path,
    'open?': Boolean(file['open?']),
  }));
}

export function getLegacyDramFilePaths(files: DramFileInput[] | undefined): string[] {
  return normalizeLegacyDramFiles(files).map((file) => file.path);
}

export function getLegacyOpenDramFiles(files: DramFileInput[] | undefined): LegacyDramFile[] {
  return normalizeLegacyDramFiles(files).filter((file) => file['open?']);
}

function dedupePathsPreservingLastPosition(paths: string[]): string[] {
  const seen = new Set<string>();
  const dedupedPaths: string[] = [];

  for (let index = paths.length - 1; index >= 0; index -= 1) {
    const filePath = paths[index];
    if (seen.has(filePath)) {
      continue;
    }
    seen.add(filePath);
    dedupedPaths.unshift(filePath);
  }

  return dedupedPaths;
}

export function resolveDramOpenPaths(config: DramConfig): string[] {
  return dedupePathsPreservingLastPosition([
    ...getLegacyOpenDramFiles(config.files).map((file) => file.path),
    ...(config.open ?? []),
  ]);
}
