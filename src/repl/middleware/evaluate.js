const vscode = require('vscode');
const _ = require('lodash');
const state = require('../../state');
const repl = require('../client');
const format = require('./format');
const message = require('../message');
const annotations = require('../../providers/annotations');
const {
    getDocument,
    getFileName,
    getFileType,
    getNamespace,
    getSession,
    logSuccess,
    logError,
    ERROR_TYPE,
    getContentToNextBracket,
    getContentToPreviousBracket
} = require('../../utilities');

function evaluateMsg(msg, startStr, errorStr, callback, document = {}) {
    let current = state.deref(),
        doc = getDocument(document),
        session = getSession(getFileType(doc)),
        chan = current.get('outputChannel');

    chan.appendLine(startStr);
    chan.appendLine("----------------------------");

    let evalClient = null;
    evaluationResult = "";
    new Promise((resolve, reject) => {
        evalClient = repl.create().once('connect', () => {
            evalClient.send(msg, (result) => {
                let exceptions = _.some(result, "ex"),
                    errors = _.some(result, "err");
                if (!exceptions && !errors) {
                    resolve(result);
                } else {
                    logError({
                        type: ERROR_TYPE.ERROR,
                        reason: "Error, " + errorStr + ": " + _.find(result, "err").err
                    });
                    reject(result);
                }
            });
        });
    }).then((result) => {
        evalClient.end();
        callback(result);
    }).catch(() => {
        evalClient.end();
    });
};

function evaluateSelection(document = {}, options = {}) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        doc = getDocument(document),
        pprint = options.pprint || false,
        replace = options.replace || false,
        session = getSession(getFileType(doc)),
        codeSelection = null;

    if (current.get('connected')) {
        let editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            codeSelection = selection,
            textSelection = selection,
            offset = 0,
            code = "";

        if (!selection.isEmpty) { //text selected by user, try to evaluate it
            code = doc.getText(selection);
            if (code === '(') {
                let currentPosition = selection.active,
                    previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
                    lastLine = doc.lineCount,
                    endPosition = currentPosition.with(lastLine, doc.lineAt(Math.max(lastLine - 1, 0)).text.length);

                textSelection = new vscode.Selection(previousPosition, endPosition);
                [offset, code] = getContentToNextBracket(doc.getText(textSelection));
                codeSelection = new vscode.Selection(previousPosition, doc.positionAt(doc.offsetAt(previousPosition) + code.length));
            } else if (code === ')') {
                let currentPosition = selection.active,
                    startPosition = currentPosition.with(0, 0);

                textSelection = new vscode.Selection(startPosition, currentPosition);
                [offset, code] = getContentToPreviousBracket(doc.getText(textSelection));
                codeSelection = new vscode.Selection(doc.positionAt(offset + 1), currentPosition);
            }
        } else {
            //no text selected, check if cursor at a start '(' or end ')' and evaluate the expression within
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
                    startPosition = (nextChar === '(') ? currentPosition : previousPosition;

                textSelection = new vscode.Selection(startPosition, endPosition);
                [offset, code] = getContentToNextBracket(doc.getText(textSelection));
                codeSelection = new vscode.Selection(startPosition, doc.positionAt(doc.offsetAt(startPosition) + code.length));
            } else if (nextChar === ')' || prevChar === ')') {
                let startPosition = currentPosition.with(0, 0),
                    endPosition = (prevChar === ')') ? currentPosition : nextPosition;

                textSelection = new vscode.Selection(startPosition, endPosition);
                [offset, code] = getContentToPreviousBracket(doc.getText(textSelection));
                codeSelection = new vscode.Selection(doc.positionAt(offset + 1), endPosition);
            }
        }

        if (code.length > 0) {
            let msg = message.evaluate(session, getNamespace(doc.getText()), code, pprint),
                c = codeSelection.start.character,
                re = new RegExp("^\\s{" + c + "}", "gm");
            evaluateMsg(msg, "Evaluating:\n" + code.replace(re, ""), "unable to evaluate sexp", (results) => {
                let result = null;
                _.each(results, (r) => {
                    if (r.hasOwnProperty("value")) {
                        result = r.value;
                    } else if (r.hasOwnProperty("pprint-out")) {
                        result = r["pprint-out"].replace(/\n$/, "");;
                    }
                });
                if (result !== null) {
                    if (replace) {
                        let edit = vscode.TextEdit.replace(codeSelection, result);
                        let wsEdit = new vscode.WorkspaceEdit();
                        wsEdit.set(editor.document.uri, [edit]);
                        vscode.workspace.applyEdit(wsEdit);
                        chan.appendLine("Replaced inline.")
                    } else {
                        if (!pprint) {
                            let decoration = annotations.evaluated('=> ' + result.replace(/\n/g, " "), editor);
                            decoration.range = new vscode.Selection(codeSelection.end, codeSelection.end);
                            editor.setDecorations(annotations.evalAnnotationDecoration, [decoration]);
                            setTimeout(() => {
                                let subscription = vscode.window.onDidChangeTextEditorSelection((e) => {
                                    editor.setDecorations(annotations.evalAnnotationDecoration, []);
                                    subscription.dispose();
                                });
                            }, 250);
                        }
                        chan.appendLine(result);
                    }
                } else {
                    chan.appendLine("Evaluation failed?");
                }
            });
        }
    }
};

function evaluateSelectionReplace(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { replace: true, pprint: true }));
};

function evaluateSelectionPrettyPrint(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { pprint: true }));
};

function evaluateFile(document = {}) {
    let current = state.deref(),
        doc = getDocument(document),
        chan = current.get('outputChannel');

    if (current.get('connected')) {
        let fileName = getFileName(doc),
            session = getSession(getFileType(doc)),
            msg = message.loadFile(session, doc.getText(), fileName, doc.fileName);

        evaluateMsg(msg, "Evaluating file: " + fileName, "unable to evaluate file", (results) => {
            let result = null;
            _.each(results, (r) => {
                if (r.hasOwnProperty("value")) {
                    result = r.value;
                }
            });
            if (result !== null) {
                chan.appendLine(result);
            } else {
                chan.appendLine("Evaluation failed?");
            }
        });
    }
};

module.exports = {
    evaluateFile,
    evaluateSelection,
    evaluateSelectionPrettyPrint,
    evaluateSelectionReplace
};
