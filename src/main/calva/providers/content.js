import { deref } from '../state';
import os from 'os';
import fs from 'fs';
import JSZip from 'jszip';

export default class TextDocumentContentProvider {
    provideTextDocumentContent(uri, token) {
        const current = deref();
        if (current.get('connected')) {
            return new Promise((resolve, reject) => {
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
