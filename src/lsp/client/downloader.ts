import * as extractZip from 'extract-zip';
import * as followRedirects from 'follow-redirects';
import * as util from '../../utilities';
import * as config from '../../config';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as downloaderUtils from './downloader-utils';

const DOWNLOAD_TIMEOUT_MS = 120_000;

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

async function downloadClojureLsp(extensionPath: string, version: string): Promise<string> {
  const isNightly = version.endsWith('-nightly');
  // There were no Apple Silicon builds prior to version 2022.06.22-14.09.50
  const artifactName =
    version >= '2022.06.22-14.09.50' || isNightly || process.platform !== 'darwin'
      ? getArtifactDownloadName()
      : getArtifactDownloadName('darwin', 'x64');
  const repo = isNightly ? 'clojure-lsp-dev-builds' : 'clojure-lsp';
  const url = `https://github.com/clojure-lsp/${repo}/releases/download/${version}/${artifactName}`;
  const downloadPath = path.join(extensionPath, artifactName);
  const clojureLspPath = getClojureLspPath(extensionPath);

  const result = await downloaderUtils.downloadWithBackupRecovery(clojureLspPath, async () => {
    await downloadArtifact(url, downloadPath);
    if (path.extname(downloadPath) === '.zip') {
      await unzipFile(downloadPath, extensionPath);
    }
    if (path.extname(clojureLspPath) === '') {
      await fs.promises.chmod(clojureLspPath, 0o775);
    }
    writeVersionFile(extensionPath, version);
  });

  if (result.restored) {
    const reason = result.error ? `: ${result.error}` : '';
    console.warn(
      `Failed to download clojure-lsp ${version}${reason}. Falling back to previously downloaded version.`
    );
  }
  return result.path;
}

export const ensureServerDownloaded = async (
  context: vscode.ExtensionContext,
  forceDownload = false
): Promise<string> => {
  const currentVersion = await readVersionFile(context.extensionPath);
  console.log(`Current clojure-lsp version: ${currentVersion}`);
  const configuredVersion: string = config.getConfig().clojureLspVersion;
  const clojureLspPath = getClojureLspPath(context.extensionPath);
  const versionSource = ['', 'latest'].includes(configuredVersion)
    ? 'latest'
    : configuredVersion === 'nightly'
    ? 'nightly'
    : 'configured';
  console.log(`clojure-lsp version source: ${versionSource} (setting: '${configuredVersion}')`);
  const downloadVersion =
    versionSource === 'latest'
      ? await util.getLatestGitHubReleaseTag('clojure-lsp/clojure-lsp')
      : versionSource === 'nightly'
      ? await util.getLatestGitHubReleaseTag('clojure-lsp/clojure-lsp-dev-builds')
      : configuredVersion;
  console.log(`clojure-lsp download version: ${downloadVersion}`);

  const exists = await fs.promises
    .stat(clojureLspPath)
    .then(() => true)
    .catch((err) => {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      return false;
    });
  console.log(`clojure-lsp binary exists: ${exists}`);

  // If there's no existing clojure-lsp file, and we can't fetch the latest version, throw an error, because the download of clojure-lsp will fail
  if (downloadVersion === '' && !exists) {
    throw 'Could not fetch latest version for clojure-lsp. Please check your internet connection and try again. You can also download clojure-lsp manually and set the path in the Calva settings. See https://calva.io/clojure-lsp/#using-a-custom-clojure-lsp for more info.';
  } else if (
    (currentVersion !== downloadVersion && downloadVersion !== '') ||
    forceDownload ||
    !exists
  ) {
    console.log(
      `clojure-lsp downloading: currentVersion='${currentVersion}', downloadVersion='${downloadVersion}', forceDownload=${forceDownload}, exists=${exists}`
    );
    return await downloadClojureLsp(context.extensionPath, downloadVersion);
  }
  console.log(`clojure-lsp skipping download, already up to date (${currentVersion})`);
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
