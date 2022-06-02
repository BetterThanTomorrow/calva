import * as path from 'path';
import * as lspUtil from './utilities';
import * as util from '../utilities';
import * as fs from 'fs';
import { https } from 'follow-redirects';
import * as extractZip from 'extract-zip';

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

function backupExistingFile(clojureLspPath: string): string {
  const backupDir = path.join(path.dirname(clojureLspPath), 'backup');
  const backupPath = path.join(backupDir, path.basename(clojureLspPath));

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    console.log('Backing up existing clojure-lsp to', backupPath);
    fs.renameSync(clojureLspPath, backupPath);
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
  const filePath = lspUtil.getVersionFilePath(extensionPath);
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
  const artifactName = lspUtil.getArtifactDownloadName();
  const url =
    version !== 'nightly'
      ? `https://github.com/clojure-lsp/clojure-lsp/releases/download/${version}/${artifactName}`
      : `https://nightly.link/clojure-lsp/clojure-lsp/workflows/nightly/master/${artifactName}`;
  const downloadPath = path.join(extensionPath, artifactName);
  const clojureLspPath = lspUtil.getClojureLspPath(extensionPath);
  const backupPath = fs.existsSync(clojureLspPath) ? backupExistingFile(clojureLspPath) : clojureLspPath;
  try {
    await downloadArtifact(url, downloadPath);
    if (path.extname(downloadPath) === '.zip') {
      await unzipFile(downloadPath, extensionPath);
    }
    if (path.extname(clojureLspPath) === '') {
      fs.chmodSync(clojureLspPath, 0o775);
    }
    writeVersionFile(extensionPath, version);
  } catch (e) {
    console.log('Error downloading clojure-lsp.', e);
    return backupPath;
  }
  return clojureLspPath;
}

export { downloadClojureLsp, getLatestVersion };
