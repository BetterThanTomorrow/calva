const vscode = require('vscode');
const specialWords = ['-', '+', '/', '*']; //TODO: Add more here
const _ = require('lodash');
const state = require('./state');

function getNamespace(text) {
    let match = text.match(/^[\s\t]*\((?:[\s\t\n]*(?:in-){0,1}ns)[\s\t\n]+'?([\w.\-\/]+)[\s\S]*\)[\s\S]*/);
    return match ? match[1] : 'user';
};

function getStartExpression(text) {
    let match = text.match(/^\(([^\)]+)[\)]+/g);
    return match ? match[0] : "(ns user)";
}

function getActualWord(document, position, selected, word) {
    if (selected === undefined) {
        let selectedChar = document.lineAt(position.line).text.slice(position.character, position.character + 1),
            isFn = document.lineAt(position.line).text.slice(position.character - 1, position.character) === "(";
        if (selectedChar !== undefined &&
            specialWords.indexOf(selectedChar) !== -1 &&
            isFn) {
            return selectedChar;
        } else {
            return "";
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

function getPrettyPrintCode(code) {
    let isCljs = state.deref().get('cljs');
    if (isCljs) {
        return "(cljs.pprint/pprint " + code + ")";
    } else {
        return "(clojure.pprint/pprint " + code + ")";
    }
};

// ERROR HELPERS
const ERROR_TYPE = {
    WARNING: "warning",
    ERROR: "error"
};

function logSuccess(results) {
    let chan = state.deref().get('outputChannel');
    chan.appendLine("Evaluation completed successfully");
    _.each(results, (r) => {
        let value = r.hasOwnProperty("value") ? r.value : null;
        let out = r.hasOwnProperty("out") ? r.out : null;
        if (value !== null) {
            chan.appendLine("=>\n" + value);
        }
        if (out !== null) {
            chan.appendLine("out:\n" + out);
        }
    });
};

function logError(error) {
    let chan = state.deref().get('outputChannel');

    chan.appendLine(error.reason);
    if (error.line !== undefined && error.line !== null &&
        error.column !== undefined && error.column !== null) {
        chan.appendLine("at line: " + error.line + " and column: " + error.column)
    }
};

function markError(error) {
    if (error.line === null) {
        error.line = 0;
    }
    if (error.column === null) {
        error.column = 0;
    }

    let position = new vscode.Position(error.line, error.column),
        diagnostic = state.deref().get('diagnosticCollection'),
        editor = vscode.window.activeTextEditor;

    //editor.selection = new vscode.Selection(position, position);
    let line = error.line - 1,
        column = error.column,
        lineLength = editor.document.lineAt(line).text.length,
        lineText = editor.document.lineAt(line).text.substring(column, lineLength),
        firstWordStart = column + lineText.indexOf(" "),
        existing = diagnostic.get(editor.document.uri),
        err = new vscode.Diagnostic(new vscode.Range(line, column, line, firstWordStart),
            error.reason,
            vscode.DiagnosticSeverity.Error);

    let errors = (existing !== undefined && existing.length > 0) ? [...existing, err] :
        [err];
    diagnostic.set(editor.document.uri, errors);
};

function logWarning(warning) {
    let chan = state.deref().get('outputChannel');
    chan.appendLine(warning.reason);
    if (warning.line !== null) {
        if (warning.column !== null) {
            chan.appendLine("at line: " + warning.line + " and column: " + warning.column)
        } else {
            chan.appendLine("at line: " + warning.line)
        }
    }
};

function markWarning(warning) {
    if (warning.line === null) {
        warning.line = 0;
    }
    if (warning.column === null) {
        warning.column = 0;
    }

    let position = new vscode.Position(warning.line, warning.column),
        diagnostic = state.deref().get('diagnosticCollection'),
        editor = vscode.window.activeTextEditor;

    //editor.selection = new vscode.Selection(position, position);
    let line = Math.max(0, (warning.line - 1)),
        column = warning.column,
        lineLength = editor.document.lineAt(line).text.length,
        existing = diagnostic.get(editor.document.uri),
        warn = new vscode.Diagnostic(new vscode.Range(line, column, line, lineLength),
            warning.reason,
            vscode.DiagnosticSeverity.Warning);

    let warnings = (existing !== undefined && existing.length > 0) ? [...existing, warn] :
        [warn];
    diagnostic.set(editor.document.uri, warnings);
};

module.exports = {
    getNamespace,
    getStartExpression,
    getActualWord,
    getDocument,
    getFileType,
    getFileName,
    getContentToNextBracket,
    getPrettyPrintCode,
    getContentToPreviousBracket,
    specialWords,
    ERROR_TYPE,
    logError,
    markError,
    logWarning,
    markWarning,
    logSuccess
};