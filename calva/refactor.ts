import * as state from './state';
import * as util from './utilities';
import * as path from 'path';
import { Position, TextDocument, WorkspaceEdit, Range, workspace } from 'vscode';

function count(main_str: string, sub_str: string) {
    main_str += '';
    sub_str += '';
    if (sub_str.length <= 0) {
        return main_str.length + 1;
    }
    let subStr = sub_str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (main_str.match(new RegExp(subStr, 'gi')) || []).length;
}

function findClosingLine(startLine: Position, document: TextDocument): Position {
    let closingPosition;
    let openBr = 0;
    for (let i = startLine.line; i < document.lineCount; i++) {
        let line = document.lineAt(i).text;
        if (line.includes("(")) {
            openBr = openBr + count(line, "(");
        }

        if (line.includes(")")) {
            openBr = openBr - count(line, ")");
        }

        if (openBr === 0) {
            closingPosition = new Position(i, line.lastIndexOf(")") + 1);
            break;
        }
    }

    return closingPosition;
}

function findNamespaceRange(document: TextDocument): Range {
    let startPosition;
    for (let i = 0; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        if (line.text.includes("(ns")) {
            startPosition = new Position(i, line.text.indexOf("("));
            break;
        }
    }
    
    if (startPosition) {
        let closingPosition = findClosingLine(startPosition, document);
        if (closingPosition) {
            return new Range(startPosition, closingPosition);
        }
    }
}

async function artifactVersions(document = {}, callback = () => { }) {
    let current = state.deref(),
        doc = util.getDocument(document),
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        client = util.getSession(util.getFileType(doc)),
        chan = state.outputChannel();

    if (doc && doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        chan.appendLine("Artifact-Versions");

        let {versions} = await client.artifactVersions();
        console.log("Artifact-Versions result:", versions);
    }

    callback();
}

async function cleanNS(document = {}, callback = () => { }) {
    let current = state.deref(),
        doc = util.getDocument(document),
        filePath = doc.fileName,
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        client = util.getSession(util.getFileType(doc)),
        chan = state.outputChannel();

    if (doc && doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        chan.appendLine("Clean-NS: " + fileName);
        let {ns} = await client.cleanNS(filePath);

        if (ns ) {
            let namespaceRange = findNamespaceRange(doc);
            let edit = new WorkspaceEdit();
            edit.replace(doc.uri, namespaceRange, ns);

            workspace.applyEdit(edit).then(() => {
                console.log("applied edit to workspace");
            });
        }
    }

    callback();
}

export default {
    artifactVersions,
    cleanNS
};