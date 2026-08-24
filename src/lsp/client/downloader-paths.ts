import * as path from 'node:path';
import * as fs from 'node:fs';
import JSZip = require('jszip');

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
  baseDir: string,
  platform: string = process.platform,
  arch: string = process.arch
): string {
  let name = getArtifactDownloadName(platform, arch);
  if (path.extname(name).toLowerCase() !== '.jar') {
    name = platform === 'win32' ? 'clojure-lsp.exe' : 'clojure-lsp';
  }
  return path.join(baseDir, name);
}

export function getVersionFilePath(baseDir: string): string {
  return path.join(baseDir, versionFileName);
}

export async function readVersionFile(baseDir: string) {
  const filePath = getVersionFilePath(baseDir);
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (e) {
    console.error('Could not read clojure-lsp version file.', e.message);
  }
}

export async function unzipFile(zipFilePath: string, targetDir: string): Promise<void> {
  console.log('Unzipping file');
  const zipData = await fs.promises.readFile(zipFilePath);
  const zip = await JSZip.loadAsync(new Uint8Array(zipData));
  const resolvedTargetDir = path.resolve(targetDir);

  for (const [filename, file] of Object.entries(zip.files)) {
    const destPath = path.resolve(targetDir, filename);
    if (!destPath.startsWith(resolvedTargetDir + path.sep) && destPath !== resolvedTargetDir) {
      throw new Error(`Refusing to extract entry outside target directory: ${filename}`);
    }
    if (file.dir) {
      await fs.promises.mkdir(destPath, { recursive: true });
    } else {
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
      const content = await file.async('nodebuffer');
      await fs.promises.writeFile(destPath, new Uint8Array(content));
    }
  }
}
