import * as path from 'path';
import * as util from '../utilities';
import * as fs from 'fs';
import { https } from 'follow-redirects';

const DEPS_CLJ_FILE = 'deps.clj.jar';
const DEPS_CLJ_VERSION_FILE = 'deps-clj-version';

async function getLatestVersion(): Promise<string> {
  const releasesJSON = await util.fetchFromUrl(
    'https://api.github.com/repos/borkdude/deps.clj/releases'
  );
  const releases = JSON.parse(releasesJSON);
  return releases[0].tag_name;
}

function backupExistingFile(depsCljPath: string, backupPath: string): string {
  const backupDir = path.dirname(backupPath);
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    console.log('Backing up existing deps.clj.jar to', backupPath);
    fs.renameSync(depsCljPath, backupPath);
  } catch (e) {
    console.log('Error while backing up existing deps.clj.jar.', e.message);
  }
  return backupPath;
}

function restoreBackupFile(depsCljPath: string, backupPath: string): string {
  try {
    console.log('Restoring back up deps.clj.jar to', depsCljPath);
    fs.renameSync(backupPath, depsCljPath);
  } catch (e) {
    console.log('Error while restoring back up deps.clj.jar.', e.message);
  }
  return backupPath;
}

function downloadArtifact(url: string, filePath: string): Promise<void> {
  console.log('Downloading deps.clj.jar from', url);
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          const writeStream = fs.createWriteStream(filePath);
          response
            .on('end', () => {
              writeStream.close();
              console.log('deps.clj.jar artifact downloaded to', filePath);
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

function readVersionFile(extensionPath: string): string {
  const filePath = path.join(extensionPath, DEPS_CLJ_VERSION_FILE);
  try {
    const version = fs.readFileSync(filePath, 'utf8');
    return version;
  } catch (e) {
    console.log('Could not read deps.clj.jar version file.', e.message);
    return '';
  }
}

function writeVersionFile(extensionPath: string, version: string): void {
  console.log('Writing deps.clj.jar version file');
  const filePath = path.join(extensionPath, DEPS_CLJ_VERSION_FILE);
  try {
    fs.writeFileSync(filePath, version);
  } catch (e) {
    console.log('Could not write deps.clj.jar version file.', e.message);
  }
}

export async function downloadDepsClj(extensionPath: string): Promise<string> {
  const filePath = path.join(extensionPath, DEPS_CLJ_FILE);
  try {
    const currentVersion = readVersionFile(extensionPath);
    console.log(`Current deps.clj.jar version: ${currentVersion}`);
    const latestVersion = await getLatestVersion();
    console.log(`Latest deps.clj.jar version: ${latestVersion}`);
    if (latestVersion !== currentVersion) {
      const artifactName = `deps.clj-${latestVersion.substring(1)}-standalone.jar`;
      const url = `https://github.com/borkdude/deps.clj/releases/download/${latestVersion}/${artifactName}`;
      const backupPath = path.join(extensionPath, 'backup', DEPS_CLJ_FILE);
      if (fs.existsSync(filePath)) {
        backupExistingFile(filePath, backupPath);
      }
      try {
        await downloadArtifact(url, filePath);
        writeVersionFile(extensionPath, latestVersion);
      } catch (e) {
        console.error('Error downloading deps.clj.jar.', e);
        if (fs.existsSync(backupPath)) {
          restoreBackupFile(filePath, backupPath);
        }
      }
    } else {
      console.log(`deps.clj.jar is up to date`);
    }
  } catch (e) {
    console.error(`Error checking latest deps.clj version: ${e}`);
  }
  return filePath;
}
