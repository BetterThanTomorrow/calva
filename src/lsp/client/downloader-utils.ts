import * as path from 'node:path';
import * as fs from 'node:fs';

async function backupFile(filePath: string): Promise<string | null> {
  const backupDir = path.join(path.dirname(filePath), 'backup');
  const backupPath = path.join(backupDir, path.basename(filePath));

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    await fs.promises.mkdir(backupDir, { recursive: true });
    await fs.promises.rename(filePath, backupPath);
    return backupPath;
  } catch (e) {
    console.log('Error while backing up existing file.', e.message);
    return null;
  }
}

async function restoreFile(backupPath: string, originalPath: string): Promise<boolean> {
  try {
    await fs.promises.rename(backupPath, originalPath);
    return true;
  } catch {
    return false;
  }
}

function getBackupPath(filePath: string): string {
  return path.join(path.dirname(filePath), 'backup', path.basename(filePath));
}

export async function restoreFromBackup(filePath: string): Promise<boolean> {
  const backupPath = getBackupPath(filePath);
  if (!fs.existsSync(backupPath)) {
    return false;
  }
  return restoreFile(backupPath, filePath);
}

export interface LocalClojureLspCandidate {
  binaryPath: string;
  version: string;
}

export async function findHighestLocalClojureLsp(
  currentExtensionPath: string,
  binaryName: string,
  versionFileName: string
): Promise<LocalClojureLspCandidate | null> {
  const extensionsRoot = path.dirname(currentExtensionPath);
  const currentName = path.basename(currentExtensionPath);
  const prefix = currentName.split('-')[0];
  if (!prefix) {
    return null;
  }

  let siblings: string[];
  try {
    siblings = await fs.promises.readdir(extensionsRoot);
  } catch {
    return null;
  }

  const candidates: LocalClojureLspCandidate[] = [];
  for (const name of siblings) {
    if (name === currentName || !name.startsWith(`${prefix}-`)) {
      continue;
    }
    const folder = path.join(extensionsRoot, name);
    const binaryPath = path.join(folder, binaryName);
    if (!fs.existsSync(binaryPath)) {
      continue;
    }
    let version = '';
    try {
      version = (await fs.promises.readFile(path.join(folder, versionFileName), 'utf8')).trim();
    } catch {
      // ignore
    }
    candidates.push({ binaryPath, version });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.version.localeCompare(a.version));
  return candidates[0];
}

export async function adoptLocalClojureLsp(
  candidate: LocalClojureLspCandidate,
  targetBinaryPath: string,
  targetVersionFilePath: string
): Promise<void> {
  await fs.promises.copyFile(candidate.binaryPath, targetBinaryPath);
  if (path.extname(targetBinaryPath) === '') {
    await fs.promises.chmod(targetBinaryPath, 0o775);
  }
  if (candidate.version) {
    await fs.promises.writeFile(targetVersionFilePath, candidate.version);
  }
}

export async function downloadWithBackupRecovery(
  filePath: string,
  download: () => Promise<void>
): Promise<{
  path: string;
  restored: boolean;
  error?: string;
}> {
  const backupPath = await backupFile(filePath);
  try {
    await download();
    if (backupPath) {
      await fs.promises.unlink(backupPath).catch((_) => undefined);
    }
    return { path: filePath, restored: false };
  } catch (e) {
    if (!backupPath) {
      throw e;
    }
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Download failed, recovering from backup:', errorMessage);
    const restored = await restoreFile(backupPath, filePath);
    return {
      path: restored ? filePath : backupPath,
      restored: true,
      error: errorMessage,
    };
  }
}
