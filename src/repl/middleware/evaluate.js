const vscode = require('vscode');
const _ = require('lodash');
const state = require('../../state');
const repl = require('../client');
const message = require('../message');
const {
    getDocument,
    getFileName,
    getFileType,
    getNamespace,
    logSuccess,
    logError,
    ERROR_TYPE,
    getContentToNextBracket,
    getPrettyPrintCode,
    getContentToPreviousBracket
} = require('../../utilities');

function evaluateSelection(document = {}, options = {}) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        //doc = '(pprint ' + getDocument(document) + ')',
        doc = getDocument(document),
        pprint = options.pprint || false,
        session = current.get(getFileType(doc));

    chan.clear();
    if (current.get('connected')) {
        let editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            code = "";

        if (!selection.isEmpty) { //text selected by user, try to evaluate it
            code = doc.getText(selection);
            if (code === '(') {
                let currentPosition = selection.active,
                    previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
                    lastLine = doc.lineCount,
                    endPosition = currentPosition.with(lastLine, doc.lineAt(Math.max(lastLine - 1, 0)).text.length),
                    textSelection = new vscode.Selection(previousPosition, endPosition);
                [offset, code] = getContentToNextBracket(doc.getText(textSelection));
            } else if (code === ')') {
                let currentPosition = selection.active,
                    startPosition = currentPosition.with(0, 0),
                    textSelection = new vscode.Selection(startPosition, currentPosition);
                [offset, code] = getContentToPreviousBracket(doc.getText(textSelection));
            }
        } else { //no text selected, check if cursor at a start '(' or end ')' and evaluate the expression within
            let currentPosition = selection.active,
                nextPosition = currentPosition.with(currentPosition.line, (currentPosition.character + 1)),
                previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
                nextSelection = new vscode.Selection(currentPosition, nextPosition),
                previousSelection = new vscode.Selection(previousPosition, currentPosition),
                nextChar = doc.getText(nextSelection),
                prevChar = doc.getText(previousSelection);

            if (nextChar === '(' || prevChar === '(') {
                let lastLine = doc.lineCount,
                    endPosition = currentPosition.with(lastLine, doc.lineAt(Math.max(lastLine - 1, 0)).text.length),
                    startPosition = (nextChar === '(') ? currentPosition : previousPosition,
                    textSelection = new vscode.Selection(startPosition, endPosition);
                [offset, code] = getContentToNextBracket(doc.getText(textSelection));
            } else if (nextChar === ')' || prevChar === ')') {
                let startPosition = currentPosition.with(0, 0),
                    endPosition = (prevChar === ')') ? currentPosition : nextPosition,
                    textSelection = new vscode.Selection(startPosition, endPosition);
                [offset, code] = getContentToPreviousBracket(doc.getText(textSelection));
            }
        }

        if (code.length > 0) {
            chan.appendLine("Evaluating:");
            chan.appendLine(code);
            chan.appendLine("----------------------------");
            let evalClient = null;
            new Promise((resolve, reject) => {
                evalClient = repl.create().once('connect', () => {
                    let msg = message.evaluate(session, getNamespace(doc.getText()), (pprint ? getPrettyPrintCode(code) : code));
                    evalClient.send(msg, (result) => {
                        let exceptions = _.some(result, "ex"),
                            errors = _.some(result, "err");
                        if (!exceptions && !errors) {
                            logSuccess(result);
                            resolve(result);
                        } else {
                            logError({
                                type: ERROR_TYPE.ERROR,
                                reason: "Error: unable to evaluate sexp"
                            });
                        }
                        reject(result);
                    })
                });
            }).then(() => {
                evalClient.end();
            });
        }
    }
};

function evaluateSelectionPrettyPrint(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { pprint: true }));
};

function evaluateFile(document = {}) {
    let current = state.deref(),
        doc = getDocument(document);

    if (current.get('connected')) {
        let fileName = getFileName(doc),
            session = current.get(getFileType(doc)),
            chan = current.get('outputChannel');

        chan.clear();
        chan.appendLine("Evaluating file: " + fileName);
        chan.appendLine("----------------------------");
        let loadfileClient = null;
        new Promise((resolve, reject) => {
            loadfileClient = repl.create().once('connect', () => {
                let msg = message.loadFile(session, doc.getText(), fileName, doc.fileName);
                loadfileClient.send(msg, (result) => {
                    let exceptions = _.some(result, "ex"),
                        errors = _.some(result, "err");
                    if (!exceptions && !errors) {
                        logSuccess(result);
                        resolve(result);
                    } else {
                        logError({
                            type: ERROR_TYPE.ERROR,
                            reason: "Error: unable to evaluate file"
                        });
                    }
                    reject(result);
                });
            });
        }).then(() => {
            loadfileClient.end();
        });
    }
};

module.exports = {
    evaluateFile,
    evaluateSelection,
    evaluateSelectionPrettyPrint,
};
