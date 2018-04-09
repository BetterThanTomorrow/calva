const vscode = require('vscode');
const _ = require('lodash');
const state = require('../../state');
const repl = require('../client');
const message = require('../message');
const annotations = require('../../providers/annotations');
const select = require('./select');
const {
    getDocument,
    getFileName,
    getFileType,
    getNamespace,
    getSession,
    logError,
    ERROR_TYPE,
} = require('../../utilities');

function evaluateMsg(msg, startStr, errorStr, callback) {
    let current = state.deref(),
        chan = current.get('outputChannel');

    chan.appendLine(startStr);

    let evalClient = null;
    new Promise((resolve, reject) => {
        evalClient = repl.create().once('connect', () => {
            evalClient.send(msg, (result) => {
                let exceptions = _.some(result, "ex"),
                    errors = _.some(result, "err");
                if (!exceptions && !errors) {
                    resolve(result);
                } else {
                    let err = _.find(result, "err").err;
                    logError({
                        type: ERROR_TYPE.ERROR,
                        reason: "Error, " + errorStr + ": " + err
                    });
                    reject(result);
                }
            });
        });
    }).then((result) => {
        evalClient.end();
        callback(result);
    }).catch((result) => {
        evalClient.end();
        callback(result, true);
    });
};

function evaluateSelection(document = {}, options = {}) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        doc = getDocument(document),
        pprint = options.pprint || false,
        replace = options.replace || false,
        session = getSession(getFileType(doc));

    if (current.get('connected')) {
        let editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            codeSelection = null,
            code = "";

        annotations.clearEvaluationDecorations(editor);

        if (selection.isEmpty) {
            codeSelection = select.getFormSelection(doc, selection.active);
            code = doc.getText(codeSelection);
        } else {
            codeSelection = selection,
                code = doc.getText(selection);
        }

        if (code.length > 0) {
            let msg = message.evaluate(session, getNamespace(doc.getText()), code, pprint),
                c = codeSelection.start.character,
                re = new RegExp("^\\s{" + c + "}", "gm");
            evaluateMsg(msg, "Evaluating:\n" + code.replace(re, ""), "unable to evaluate sexp", (results, hasError = false) => {
                let result = null;
                _.each(results, (r) => {
                    if (r.hasOwnProperty("err")) {
                        result = r.err;
                        return false;
                    } else if (r.hasOwnProperty("value")) {
                        result = r.value;
                    } else if (r.hasOwnProperty("pprint-out")) {
                        result = r["pprint-out"].replace(/\n$/, "");;
                    }
                });
                if (result !== null) {
                    if (replace && !hasError) {
                        const indent = ' '.repeat(c),
                            edit = vscode.TextEdit.replace(codeSelection, result.replace(/\n/gm, "\n" + indent)),
                            wsEdit = new vscode.WorkspaceEdit();
                        wsEdit.set(editor.document.uri, [edit]);
                        vscode.workspace.applyEdit(wsEdit);
                        chan.appendLine("Replaced inline.")
                    } else {
                        annotations.decorateSelection(codeSelection, editor);
                        chan.append('=> ');
                        if (pprint) {
                            chan.appendLine('');
                            chan.show();
                        } else {
                            annotations.decorateResults(' => ' + result.replace(/\n/gm, " ") + " ", hasError, codeSelection, editor);
                        }
                        chan.appendLine(result);
                    }
                } else {
                    chan.appendLine("Evaluation failed for unknown reasons. Sometimes it helps evaluating the file first.");
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

function evaluateFile(document = {}, callback) {
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
                chan.appendLine("=> " + result);
            } else {
                chan.appendLine("Evaluation failed?");
            }
            callback();
        });
    }
};

module.exports = {
    evaluateFile,
    evaluateSelection,
    evaluateSelectionPrettyPrint,
    evaluateSelectionReplace
};
