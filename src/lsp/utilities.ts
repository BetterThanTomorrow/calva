import * as path from 'path';
import * as fs from 'fs';

const versionFileName = 'clojure-lsp-version';

function getClojureLspPath(extensionPath: string, isWindows: boolean): string {
  const fileExtension = isWindows ? '.exe' : '';
  return path.join(extensionPath, `clojure-lsp${fileExtension}`);
}

function getVersionFilePath(extensionPath: string): string {
  return path.join(extensionPath, versionFileName);
}

function readVersionFile(extensionPath: string): string {
  const filePath = getVersionFilePath(extensionPath);
  try {
    const version = fs.readFileSync(filePath, 'utf8');
    return version;
  } catch (e) {
    console.log('Could not read clojure-lsp version file.', e.message);
    return '';
  }
}

export { getClojureLspPath, getVersionFilePath, readVersionFile };
