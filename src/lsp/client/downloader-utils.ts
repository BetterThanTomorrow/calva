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

export async function downloadWithBackupRecovery(
  filePath: string,
  download: () => Promise<void>
): Promise<{
  path: string;
  restored: boolean;
}> {
  const backupPath = await backupFile(filePath);
  try {
    await download();
    return { path: filePath, restored: false };
  } catch (e) {
    if (!backupPath) {
      throw e;
    }
    const restored = await restoreFile(backupPath, filePath);
    return {
      path: restored ? filePath : backupPath,
      restored: true,
    };
  }
}
