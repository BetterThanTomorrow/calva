import * as process from 'process';

function getZipFileName(platform) {
    return {
        'darwin': 'clojure-lsp-native-macos-amd64.zip',
        'linux': 'clojure-lsp-native-linux-amd64.zip',
        'win32': 'clojure-lsp-native-windows-amd64.zip'
    }[platform];
}

function downloadClojureLsp (extenionPath: string, version: string): Promise<string> {
    const zipFileName = getZipFileName(process.platform);
    const urlPath = `/clojure-lsp/clojure-lsp/releases/download/${version}/${zipFileName}`;
}