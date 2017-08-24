const vscode = require('vscode');

function getNamespace(text) {
    let match = text.match(/^[\s\t]*\((?:[\s\t\n]*(?:in-){0,1}ns)[\s\t\n]+'?([\w.\-\/]+)[\s\S]*\)[\s\S]*/);
    return match ? match[1] : 'user';
};

function getActualWord(document, position, selected, word) {
    if (selected === undefined) {
        let selectedChar = document.lineAt(position.line).text.slice(position.character, position.character + 1),
            isFn = document.lineAt(position.line).text.slice(position.character - 1, position.character) === "(";
        if (this.specialWords.indexOf(selectedChar) !== -1 && isFn) {
            return selectedChar;
        } else {
            console.error("Unsupported selectedChar '" + selectedChar + "'");
            return word;
        }
    } else {
        return word;
    }
};

function getDocument(document) {
  return document.hasOwnProperty('fileName') ? document : vscode.window.activeTextEditor.document;
};

function getFileType(document) {
  let doc = getDocument(document);
  filetypeIndex = (doc.fileName.lastIndexOf('.') + 1);
  return doc.fileName.substr(filetypeIndex, doc.fileName.length);
};

function getFileName(document) {
  let fileNameIndex = (document.fileName.lastIndexOf('\\') + 1);
  return document.fileName.substr(fileNameIndex, document.fileName.length)
};

//using algorithm from: http://stackoverflow.com/questions/15717436/js-regex-to-match-everything-inside-braces-including-nested-braces-i-want/27088184#27088184
function getContentToNextBracket(block) {
    var currPos = 0,
        openBrackets = 0,
        stillSearching = true,
        waitForChar = false;

    while (stillSearching && currPos <= block.length) {
        var currChar = block.charAt(currPos);
        if (!waitForChar) {
            switch (currChar) {
                case '(':
                    openBrackets++;
                    break;
                case ')':
                    openBrackets--;
                    break;
                case '"':
                case "'":
                    waitForChar = currChar;
                    break;
                case '/':
                    var nextChar = block.charAt(currPos + 1);
                    if (nextChar === '/') {
                        waitForChar = '\n';
                    } else if (nextChar === '*') {
                        waitForChar = '*/';
                    }
                    break;
            }
        } else {
            if (currChar === waitForChar) {
                if (waitForChar === '"' || waitForChar === "'") {
                    block.charAt(currPos - 1) !== '\\' && (waitForChar = false);
                } else {
                    waitForChar = false;
                }
            } else if (currChar === '*') {
                block.charAt(currPos + 1) === '/' && (waitForChar = false);
            }
        }
        currPos++
        if (openBrackets === 0) {
            stillSearching = false;
        }
    }
    return [currPos, block.substr(0, currPos)];
};

function getContentToPreviousBracket(block) {
    var currPos = (block.length - 1),
        openBrackets = 0,
        stillSearching = true,
        waitForChar = false;

    while (stillSearching && currPos >= 0) {
        var currChar = block.charAt(currPos);
        if (!waitForChar) {
            switch (currChar) {
                case '(':
                    openBrackets--;
                    break;
                case ')':
                    openBrackets++;
                    break;
                case '"':
                case "'":
                    waitForChar = currChar;
                    break;
                case '/':
                    var nextChar = block.charAt(currPos + 1);
                    if (nextChar === '/') {
                        waitForChar = '\n';
                    } else if (nextChar === '*') {
                        waitForChar = '*/';
                    }
                    break;
            }
        } else {
            if (currChar === waitForChar) {
                if (waitForChar === '"' || waitForChar === "'") {
                    block.charAt(currPos - 1) !== '\\' && (waitForChar = false);
                } else {
                    waitForChar = false;
                }
            } else if (currChar === '*') {
                block.charAt(currPos + 1) === '/' && (waitForChar = false);
            }
        }
        currPos--
        if (openBrackets === 0) {
            stillSearching = false;
        }
    }
    return [currPos, block.substr(currPos + 1, block.length)];
};

module.exports = {
    getNamespace,
    getActualWord,
    getDocument,
    getFileType,
    getFileName,
    getContentToNextBracket,
    getContentToPreviousBracket
};
