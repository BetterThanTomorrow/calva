import select from '../select';
import { Position, TextDocument, Range } from 'vscode';

function findNamespaceRange(document: TextDocument): Range {
    let startPosition;
    for (let i = 0; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        if (line.text.match(/\([\s,]?ns\b/)) {
            startPosition = new Position(i, line.text.indexOf("("));
            break;
        }
    }

    if (startPosition) {
        return select.getFormSelection(document, startPosition, true);
    }
}

export {
    findNamespaceRange
}