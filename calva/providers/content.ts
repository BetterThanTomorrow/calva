import * as vscode from 'vscode';
import * as state from '../state';
import * as os from 'os';
import * as fs from 'fs';
import * as JSZip from 'jszip';

export default class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    state: any;

    constructor() {
        this.state = state;
    }

    provideTextDocumentContent(uri, token) {
        let current = this.state.deref();
        if (current.get('connected')) {
            return new Promise<string>((resolve, reject) => {
                let rawPath = uri.path,
                    pathToFileInJar = rawPath.slice(rawPath.search('!/') + 2),
                    pathToJar = rawPath.slice('file:'.length);

                pathToJar = pathToJar.slice(0, pathToJar.search('!'));
                if (os.platform() === 'win32') {
                    pathToJar = pathToJar.replace(/\//g, '\\').slice(1);
                }

                fs.readFile(pathToJar, (err, data) => {
                    let zip = new JSZip();
                    zip.loadAsync(data).then((new_zip) => {
                        new_zip.file(pathToFileInJar).async("string").then((value) => {
                            resolve(value);
                        })
                    })
                });
            });
        } else {
            console.warn("Unable to provide textdocumentcontent, not connected to nREPL");
        }
    }
};
