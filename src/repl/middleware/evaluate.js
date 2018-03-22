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
    getFormSelection,
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
        session = getSession(getFileType(doc));

    if (current.get('connected')) {
        let editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            codeSelection = null;
        code = "";

        editor.setDecorations(annotations.evalAnnotationDecoration, []);

        if (selection.isEmpty) {
            codeSelection = getFormSelection(doc, selection.active);
            code = doc.getText(codeSelection);
        } else {
            codeSelection = selection,
                code = doc.getText(selection);
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
