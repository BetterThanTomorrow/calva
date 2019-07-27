import * as state from '../state';
import * as util from '../utilities';
import { Position, TextDocument, Range } from 'vscode';

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

function neededVariables(document) {
    let current = state.deref(),
        doc = util.getDocument(document),
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        client = util.getSession(util.getFileType(doc)),
        chan = state.outputChannel(),
        isValid = doc && doc.languageId == "clojure" && fileType != "edn" && current.get('connected');
    return { current, doc, fileName, client, chan, isValid };
}

export {
    findNamespaceRange,
    neededVariables
}