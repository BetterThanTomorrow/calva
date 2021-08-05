import * as process from 'process';
import * as path from 'path';
import * as lspUtil from './utilities';
import * as util from '../utilities';
import * as fs from 'fs';
import { https } from 'follow-redirects';
import * as extractZip from 'extract-zip';

async function getLatestVersion(): Promise<string> {
    const releasesJSON = await util.fetchFromUrl('https://api.github.com/repos/clojure-lsp/clojure-lsp/releases');
    const releases = JSON.parse(releasesJSON);
    return releases[0].tag_name;
}

function getZipFileName(platform: string): string {
    return {
        'darwin': 'clojure-lsp-native-macos-amd64.zip',
        'linux': 'clojure-lsp-native-linux-amd64.zip',
        'win32': 'clojure-lsp-native-windows-amd64.zip'
    }[platform];
}

function getZipFilePath(extensionPath: string, platform: string): string {
    return path.join(extensionPath, getZipFileName(platform));
}

function getBackupPath(clojureLspPath: string, isWindows: boolean): string {
    return `${clojureLspPath}_backup${isWindows ? '.exe' : ''}`;
}

function backupExistingFile(clojureLspPath: string, backupPath: string): void {
    console.log('Backing up existing clojure-lsp to', backupPath);
    try {
        fs.renameSync(clojureLspPath, backupPath);
    } catch (e) {
        console.log("Error while backing up existing clojure-lsp file.", e.message);
    }
}

function downloadZipFile(urlPath: string, filePath: string): Promise<void> {
    console.log('Downloading clojure-lsp from', urlPath);
    return new Promise((resolve, reject) => {
        https.get({
            hostname: 'github.com',
            path: urlPath
        }, (response) => {
            if (response.statusCode === 200) {
                const writeStream = fs.createWriteStream(filePath);
                response.on('end', () => {
                    writeStream.close();
                    console.log('Clojure-lsp zip file downloaded to', filePath);
                    resolve();
                }).pipe(writeStream);
            } else {
                response.resume(); // Consume response to free up memory
                reject(new Error(response.statusMessage));
            }
        }).on('error', reject);
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
    const zipFileName = getZipFileName(process.platform);
    const urlPath = `/clojure-lsp/clojure-lsp/releases/download/${version}/${zipFileName}`;
    const zipFilePath = getZipFilePath(extensionPath, process.platform);
    const clojureLspPath = lspUtil.getClojureLspPath(extensionPath, util.isWindows);
    const backupPath = getBackupPath(clojureLspPath, util.isWindows);
    backupExistingFile(clojureLspPath, backupPath);
    try {
        await downloadZipFile(urlPath, zipFilePath);
        await unzipFile(zipFilePath, extensionPath);
        writeVersionFile(extensionPath, version);
    } catch (e) {
        console.log('Error downloading clojure-lsp.', e);
        return backupPath;
    }
    return clojureLspPath;
}

export {
    downloadClojureLsp,
    getLatestVersion
}