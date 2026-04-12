import * as fs from 'node:fs';
import * as path from 'node:path';
import JSZip = require('jszip');

export type ArchiveStagingEntry = {
  archivePath: string;
  relativePath: string;
};

const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:\//;

function normalizeArchiveEntryPath(entryPath: string): string {
  const normalizedPath = path.posix.normalize(entryPath.replace(/\\/g, '/'));

  if (
    normalizedPath.length === 0 ||
    normalizedPath === '.' ||
    normalizedPath === '..' ||
    normalizedPath.startsWith('../') ||
    path.posix.isAbsolute(normalizedPath) ||
    WINDOWS_ABSOLUTE_PATH.test(normalizedPath)
  ) {
    throw new Error(`Unsafe archive entry path: ${entryPath}`);
  }

  return normalizedPath;
}

export function buildGithubArchiveStagingPlan(entryPaths: string[]): ArchiveStagingEntry[] {
  const normalizedEntries = entryPaths.map((archivePath) => ({
    archivePath,
    normalizedPath: normalizeArchiveEntryPath(archivePath),
  }));

  const shouldStripWrapperDirectory =
    normalizedEntries.length > 0 &&
    new Set(normalizedEntries.map((entry) => entry.normalizedPath.split('/')[0])).size === 1 &&
    normalizedEntries.every((entry) => entry.normalizedPath.includes('/'));

  return normalizedEntries.map(({ archivePath, normalizedPath }) => {
    const relativePath = shouldStripWrapperDirectory
      ? normalizedPath.split('/').slice(1).join('/')
      : normalizedPath;

    if (!relativePath) {
      throw new Error(`Archive entry resolved to an empty staging path: ${archivePath}`);
    }

    return {
      archivePath,
      relativePath,
    };
  });
}

async function writeStagedFile(
  destinationRootPath: string,
  relativePath: string,
  contents: Buffer
): Promise<string> {
  const destinationPath = path.join(destinationRootPath, ...relativePath.split('/'));
  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.promises.writeFile(destinationPath, new Uint8Array(contents));
  return destinationPath;
}

export async function stageOverlayFile(
  sourceFilePath: string,
  destinationRootPath: string,
  relativePath: string
): Promise<string> {
  const destinationPath = path.join(destinationRootPath, ...relativePath.split('/'));
  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.promises.copyFile(sourceFilePath, destinationPath);
  return destinationPath;
}

export async function stageGithubArchive(
  zipFilePath: string,
  destinationRootPath: string
): Promise<string[]> {
  const zipBuffer = await fs.promises.readFile(zipFilePath);
  const zip = await JSZip.loadAsync(new Uint8Array(zipBuffer));
  const archivePaths = Object.values(zip.files)
    .filter((file) => !file.dir)
    .map((file) => file.name);
  const stagingPlan = buildGithubArchiveStagingPlan(archivePaths);

  for (const entry of stagingPlan) {
    const archiveFile = zip.file(entry.archivePath);
    if (!archiveFile) {
      throw new Error(`Archive entry missing from zip: ${entry.archivePath}`);
    }
    const contents = await archiveFile.async('nodebuffer');
    await writeStagedFile(destinationRootPath, entry.relativePath, contents);
  }

  return stagingPlan.map((entry) => entry.relativePath);
}
