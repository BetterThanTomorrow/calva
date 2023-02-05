import extractZip from 'extract-zip';
import { https } from 'follow-redirects';
import util from '../../utilities';
import config from '../../config';
import path from 'node:path';
import vscode from 'vscode';
import fs from 'node:fs';

const versionFileName = 'clojure-lsp-version';

const artifacts = {
  darwin: {
    x64: 'clojure-lsp-native-macos-amd64.zip',
    arm64: 'clojure-lsp-native-macos-aarch64.zip',
  },
  linux: {
    x64: 'clojure-lsp-native-static-linux-amd64.zip',
    arm64: 'clojure-lsp-native-linux-aarch64.zip',
  },
  win32: {
    x64: 'clojure-lsp-native-windows-amd64.zip',
  },
};

export function getArtifactDownloadName(
  platform: string = process.platform,
  arch: string = process.arch
): string {
  return artifacts[platform]?.[arch] ?? 'clojure-lsp-standalone.jar';
}

export function getClojureLspPath(
  extensionPath: string,
  platform: string = process.platform,
  arch: string = process.arch
): string {
  let name = getArtifactDownloadName(platform, arch);
  if (path.extname(name).toLowerCase() !== '.jar') {
    name = arch === 'win32' ? 'clojure-lsp.exe' : 'clojure-lsp';
  }
  return path.join(extensionPath, name);
}

export function getVersionFilePath(extensionPath: string): string {
  return path.join(extensionPath, versionFileName);
}

export async function readVersionFile(extensionPath: string) {
  const filePath = getVersionFilePath(extensionPath);
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (e) {
    console.error('Could not read clojure-lsp version file.', e.message);
  }
}

async function getLatestVersion(): Promise<string> {
  try {
    const releasesJSON = await util.fetchFromUrl(
      'https://api.github.com/repos/clojure-lsp/clojure-lsp/releases'
    );
    const releases = JSON.parse(releasesJSON);
    return releases[0].tag_name;
  } catch (err) {
    return '';
  }
}

async function backupExistingFile(clojureLspPath: string): Promise<string> {
  const backupDir = path.join(path.dirname(clojureLspPath), 'backup');
  const backupPath = path.join(backupDir, path.basename(clojureLspPath));

  try {
    await fs.promises.mkdir(backupDir, {
      recursive: true,
    });
    console.log('Backing up existing clojure-lsp to', backupPath);
    await fs.promises.rename(clojureLspPath, backupPath);
  } catch (e) {
    console.log('Error while backing up existing clojure-lsp file.', e.message);
  }

  return backupPath;
}

function downloadArtifact(url: string, filePath: string): Promise<void> {
  console.log('Downloading clojure-lsp from', url);
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          const writeStream = fs.createWriteStream(filePath);
          response
            .on('end', () => {
              writeStream.close();
              console.log('Clojure-lsp artifact downloaded to', filePath);
              resolve();
            })
            .pipe(writeStream);
        } else {
          response.resume(); // Consume response to free up memory
          reject(new Error(response.statusMessage));
        }
      })
      .on('error', reject);
  });
}

function writeVersionFile(extensionPath: string, version: string): void {
  console.log('Writing version file');
  const filePath = getVersionFilePath(extensionPath);
  try {
    fs.writeFileSync(filePath, version);
  } catch (e) {
    console.log('Could not write clojure-lsp version file.', e.message);
  }
}

async function unzipFile(zipFilePath: string, extensionPath: string): Promise<void> {
  console.log('Unzipping file');
  return extractZip(zipFilePath, { dir: extensionPath });
}

async function downloadClojureLsp(extensionPath: string, version: string): Promise<string> {
  // There were no Apple Silicon builds prior to version 2022.06.22-14.09.50
  const artifactName =
    version >= '2022.06.22-14.09.50' || process.platform !== 'darwin'
      ? getArtifactDownloadName()
      : getArtifactDownloadName('darwin', 'x64');
  const url =
    version !== 'nightly'
      ? `https://github.com/clojure-lsp/clojure-lsp/releases/download/${version}/${artifactName}`
      : `https://github.com/clojure-lsp/clojure-lsp-dev-builds/releases/latest/download/${artifactName}`;
  const downloadPath = path.join(extensionPath, artifactName);
  const clojureLspPath = getClojureLspPath(extensionPath);
  const backupPath = fs.existsSync(clojureLspPath)
    ? backupExistingFile(clojureLspPath)
    : clojureLspPath;
  try {
    await downloadArtifact(url, downloadPath);
    if (path.extname(downloadPath) === '.zip') {
      await unzipFile(downloadPath, extensionPath);
    }
    if (path.extname(clojureLspPath) === '') {
      await fs.promises.chmod(clojureLspPath, 0o775);
    }
    writeVersionFile(extensionPath, version);
  } catch (e) {
    console.log('Error downloading clojure-lsp.', e);
    return backupPath;
  }
  return clojureLspPath;
}

export const ensureServerDownloaded = async (
  context: vscode.ExtensionContext,
  forceDownload = false
): Promise<string> => {
  const currentVersion = await readVersionFile(context.extensionPath);
  const configuredVersion: string = config.getConfig().clojureLspVersion;
  const clojureLspPath = getClojureLspPath(context.extensionPath);
  const downloadVersion = ['', 'latest'].includes(configuredVersion)
    ? await getLatestVersion()
    : configuredVersion;

  const exists = await fs.promises
    .stat(clojureLspPath)
    .then(() => true)
    .catch((err) => {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      return false;
    });

  if (
    (currentVersion !== downloadVersion && downloadVersion !== '') ||
    forceDownload ||
    downloadVersion === 'nightly' ||
    !exists
  ) {
    await downloadClojureLsp(context.extensionPath, downloadVersion);
  }
  return clojureLspPath;
};

export async function ensureLSPServer(
  context: vscode.ExtensionContext,
  forceDownload = false
): Promise<string> {
  const userConfiguredClojureLspPath = config.getConfig().clojureLspPath;
  if (userConfiguredClojureLspPath !== '') {
    if (forceDownload) {
      void vscode.window.showErrorMessage(
        `Not downloading, because 'calva.clojureLspPath' is configured (${userConfiguredClojureLspPath})`
      );
    }
    return userConfiguredClojureLspPath;
  }
  return await ensureServerDownloaded(context, forceDownload);
}
