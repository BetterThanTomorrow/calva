import vscode from 'vscode';
import util from '../../utilities';

function getFormSelection(doc, currentPosition) {
    let nextPosition = currentPosition.with(currentPosition.line, (currentPosition.character + 1)),
        previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
        nextSelection = new vscode.Selection(currentPosition, nextPosition),
        previousSelection = new vscode.Selection(previousPosition, currentPosition),
        nextChar = doc.getText(nextSelection), prevChar = doc.getText(previousSelection),
        codeSelection = null,
        startBracketRE = /^[\(\[\{]$/,
        endBracketRE = /^[\)\]\}]$/;

    if (nextChar.match(startBracketRE) || prevChar.match(startBracketRE)) {
        let lastLine = doc.lineCount,
            endPosition = currentPosition.with(lastLine, doc.lineAt(Math.max(lastLine - 1, 0)).text.length),
            startPosition = nextChar.match(startBracketRE) ? currentPosition : previousPosition,
            bracket = doc.getText(nextChar.match(startBracketRE) ? nextSelection : previousSelection),
            textSelection = new vscode.Selection(startPosition, endPosition);

        codeSelection = getSelectionToNextBracket(doc, textSelection, startPosition, bracket);
    }
    else if (nextChar.match(endBracketRE) || prevChar.match(endBracketRE)) {
        let startPosition = currentPosition.with(0, 0),
            endPosition = prevChar.match(endBracketRE) ? currentPosition : nextPosition,
            bracket = doc.getText(prevChar.match(endBracketRE) ? previousSelection : nextSelection),
            textSelection = new vscode.Selection(startPosition, endPosition);

        codeSelection = getSelectionToPreviousBracket(doc, textSelection, endPosition, bracket);
    }
    return codeSelection;
}

function findSexpStartFromOpeningBracket(block, start, endBracket) {
    if (block.charAt(start).match(/['`]/)) {
        // Quote form: '()
        // Syntax quote: `()
        start--;
    }
    else if (endBracket.match(/[\}\)]/) && block.charAt(start).match(/\#/)) {
        // Sets: #{}
        // Functions: #()
        start--;
    }
    else if (endBracket === ')') {
        // Conditionals: #?(), #?@()
        // Deref: @()
        let readerMacroMatch = block.substr(Math.max(start - 2, 0), Math.min(start + 1, 3)).match(/(#\?@?|@)$/);
        if (readerMacroMatch) {
            start -= readerMacroMatch[0].length;
        }
    }
    return start;
}

//using algorithm from: http://stackoverflow.com/questions/15717436/js-regex-to-match-everything-inside-braces-including-nested-braces-i-want/27088184#27088184
function getSelectionToNextBracket(doc, selection, startPosition, startBracket) {
    var block = doc.getText(selection),
        end = 0,
        openBrackets = 0,
        stillSearching = true,
        waitForChar = false,
        endBracket = startBracket === '(' ? ')' : startBracket === '[' ? ']' : '}';

    while (stillSearching && end <= block.length) {
        var currChar = block.charAt(end);
        if (!waitForChar) {
            switch (currChar) {
                case startBracket:
                    openBrackets++;
                    break;
                case endBracket:
                    openBrackets--;
                    break;
                case '"':
                    waitForChar = currChar;
                    break;
            }
        } else {
            if (currChar === waitForChar) {
                if (waitForChar === '"') {
                    block.charAt(end - 1) !== '\\' && (waitForChar = false);
                } else {
                    waitForChar = false;
                }
            }
        }
        end++
        if (openBrackets === 0) {
            stillSearching = false;
        }
    }
    const start = findSexpStartFromOpeningBracket(doc.getText(), doc.offsetAt(startPosition) - 1, endBracket);
    return new vscode.Selection(doc.positionAt(start + 1), doc.positionAt(doc.offsetAt(startPosition) + end));
}

function getSelectionToPreviousBracket(doc, selection, endPosition, endBracket) {
    var block = doc.getText(selection),
        start = (block.length - 1),
        openBrackets = 0,
        stillSearching = true,
        waitForChar = false,
        startBracket = endBracket === ')' ? '(' : endBracket === ']' ? '[' : '{';

    while (stillSearching && start >= 0) {
        var currChar = block.charAt(start);
        if (!waitForChar) {
            switch (currChar) {
                case startBracket:
                    openBrackets--;
                    break;
                case endBracket:
                    openBrackets++;
                    break;
                case '"':
                    waitForChar = currChar;
                    break;
            }
        } else {
            if (currChar === waitForChar) {
                if (waitForChar === '"') {
                    block.charAt(start - 1) !== '\\' && (waitForChar = false);
                } else {
                    waitForChar = false;
                }
            }
        }
        start--
        if (openBrackets === 0) {
            stillSearching = false;
        }
    }
    start = findSexpStartFromOpeningBracket(block, start, endBracket);
    return new vscode.Selection(doc.positionAt(start + 1), endPosition);
}

function selectCurrentForm(document = {}) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument(document),
        selection = editor.selection,
        codeSelection = null;

    if (selection.isEmpty) {
        codeSelection = getFormSelection(doc, selection.active);
        if (codeSelection) {
            editor.selection = codeSelection;
        }
    }
}

export default {
    getFormSelection,
    selectCurrentForm
};