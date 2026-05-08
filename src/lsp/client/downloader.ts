import * as extractZip from 'extract-zip';
import * as followRedirects from 'follow-redirects';
import * as util from '../../utilities';
import * as config from '../../config';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as fs from 'node:fs';
const DOWNLOAD_TIMEOUT_MS = 120_000;

const versionFileName = 'clojure-lsp-version';

export function getClojureLspStorageDir(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, 'clojure-lsp');
}

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
    name = platform === 'win32' ? 'clojure-lsp.exe' : 'clojure-lsp';
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

function downloadArtifact(url: string, filePath: string): Promise<void> {
  console.log('Downloading clojure-lsp from', url);
  return new Promise((resolve, reject) => {
    const request = followRedirects.https
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
          response.resume();
          reject(new Error(response.statusMessage));
        }
      })
      .on('error', reject);
    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      request.destroy(new Error('Download timed out'));
    });
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

async function downloadClojureLsp(storageDir: string, version: string): Promise<string> {
  const isNightly = version.endsWith('-nightly');
  // There were no Apple Silicon builds prior to version 2022.06.22-14.09.50
  const artifactName =
    version >= '2022.06.22-14.09.50' || isNightly || process.platform !== 'darwin'
      ? getArtifactDownloadName()
      : getArtifactDownloadName('darwin', 'x64');
  const repo = isNightly ? 'clojure-lsp-dev-builds' : 'clojure-lsp';
  const url = `https://github.com/clojure-lsp/${repo}/releases/download/${version}/${artifactName}`;
  const clojureLspPath = getClojureLspPath(storageDir);

  const tempDir = path.join(storageDir, `.download-${Date.now()}`);
  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    const tempDownloadPath = path.join(tempDir, artifactName);
    await downloadArtifact(url, tempDownloadPath);
    if (path.extname(tempDownloadPath) === '.zip') {
      await unzipFile(tempDownloadPath, tempDir);
      await fs.promises.unlink(tempDownloadPath).catch(() => undefined);
    }
    const tempBinaryName = getClojureLspPath(tempDir);
    if (path.extname(tempBinaryName) === '') {
      await fs.promises.chmod(tempBinaryName, 0o775);
    }
    try {
      await fs.promises.rename(tempBinaryName, clojureLspPath);
    } catch (renameErr) {
      if ((renameErr as NodeJS.ErrnoException).code === 'EXDEV') {
        await fs.promises.copyFile(tempBinaryName, clojureLspPath);
        await fs.promises.unlink(tempBinaryName).catch(() => undefined);
      } else {
        throw renameErr;
      }
    }
    writeVersionFile(storageDir, version);
  } catch (err) {
    console.error('clojure-lsp download failed:', err);
    throw err;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
  return clojureLspPath;
}

export const ensureServerDownloaded = async (
  context: vscode.ExtensionContext,
  forceDownload = false
): Promise<string | undefined> => {
  const storageDir = getClojureLspStorageDir(context);
  await fs.promises.mkdir(storageDir, { recursive: true });

  const clojureLspPath = getClojureLspPath(storageDir);

  const exists = await fs.promises
    .stat(clojureLspPath)
    .then(() => true)
    .catch((err) => {
      if (err.code !== 'ENOENT') {
        console.error('Error checking clojure-lsp binary:', err);
      }
      return false;
    });

  // If binary exists and not forcing download, return immediately — no network, no blocking
  if (exists && !forceDownload) {
    console.log('clojure-lsp binary found, starting immediately');
    return clojureLspPath;
  }

  // Binary missing or force download — must download now
  try {
    const configuredVersion: string = config.getConfig().clojureLspVersion;
    const versionSource = ['', 'latest'].includes(configuredVersion)
      ? 'latest'
      : configuredVersion === 'nightly'
      ? 'nightly'
      : 'configured';
    const downloadVersion =
      versionSource === 'latest'
        ? await util.getLatestGitHubReleaseTag('clojure-lsp/clojure-lsp')
        : versionSource === 'nightly'
        ? await util.getLatestGitHubReleaseTag('clojure-lsp/clojure-lsp-dev-builds')
        : configuredVersion;

    if (downloadVersion === '') {
      console.error('Could not determine clojure-lsp version to download');
      return undefined;
    }

    console.log(`clojure-lsp downloading version ${downloadVersion}`);
    return await downloadClojureLsp(storageDir, downloadVersion);
  } catch (err) {
    console.error('clojure-lsp download failed:', err);
    return undefined;
  }
};

export async function checkForUpgrade(context: vscode.ExtensionContext): Promise<void> {
  try {
    const storageDir = getClojureLspStorageDir(context);
    const currentVersion = await readVersionFile(storageDir);
    const configuredVersion: string = config.getConfig().clojureLspVersion;
    const versionSource = ['', 'latest'].includes(configuredVersion)
      ? 'latest'
      : configuredVersion === 'nightly'
      ? 'nightly'
      : 'configured';
    const latestVersion =
      versionSource === 'latest'
        ? await util.getLatestGitHubReleaseTag('clojure-lsp/clojure-lsp')
        : versionSource === 'nightly'
        ? await util.getLatestGitHubReleaseTag('clojure-lsp/clojure-lsp-dev-builds')
        : configuredVersion;

    if (latestVersion === '' || latestVersion === currentVersion) {
      console.log(`clojure-lsp is up to date (${currentVersion})`);
      return;
    }

    console.log(
      `clojure-lsp upgrade available: ${currentVersion} → ${latestVersion}, downloading in background`
    );
    await downloadClojureLsp(storageDir, latestVersion);
    console.log(`clojure-lsp upgraded to ${latestVersion}`);
  } catch (err) {
    console.error('clojure-lsp background upgrade failed (will retry next activation):', err);
  }
}

export async function ensureLSPServer(
  context: vscode.ExtensionContext,
  forceDownload = false
): Promise<string | undefined> {
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
