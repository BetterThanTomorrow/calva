import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';

const versionFileName = 'clojure-lsp-version';

const artifacts = {
  darwin: {
    x64: 'clojure-lsp-native-macos-amd64.zip',
    // Should M1 Macs use emulated native binary or native standalone jar until M1 native available?
    // For now, let's use the Intel binary
    arm64: 'clojure-lsp-native-macos-amd64.zip',
  },
  linux: {
    x64: 'clojure-lsp-native-static-linux-amd64.zip',
    arm64: 'clojure-lsp-native-linux-aarch64.zip',
  },
  win32: {
    x64: 'clojure-lsp-native-windows-amd64.zip',
  },
};

function getArtifactDownloadName(
  platform: string = process.platform,
  arch: string = process.arch
): string {
  return artifacts[platform]?.[arch] ?? 'clojure-lsp-standalone.jar';
}

function getClojureLspPath(
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

export { getArtifactDownloadName, getClojureLspPath, getVersionFilePath, readVersionFile };
