import select from '../select';
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