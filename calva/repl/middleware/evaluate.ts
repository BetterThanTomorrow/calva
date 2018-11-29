import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from '../../state';
import repl from '../client';
import annotations from '../../providers/annotations';
import select from './select';
import * as util from '../../utilities';

import * as calvaLib from '../../../lib/calva';


function evaluateMsg(msg, startStr, errorStr, callback) {
    let current = state.deref(),
        chan = current.get('outputChannel');

    chan.appendLine(startStr);

    let evalClient = null;
    new Promise((resolve, reject) => {
        evalClient = calvaLib.nrepl_create(repl.getDefaultOptions()).once('connect', () => {
            evalClient.send(msg, (result) => {
                resolve(result);
            });
        });
    }).then((result) => {
        evalClient.end();
        callback(result);
    });
}

function evaluateSelection(document = {}, options = {}) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        doc = util.getDocument(document),
        pprint = options["pprint"] || false,
        replace = options["replace"] || false,
        topLevel = options["topLevel"] || false,
        session = util.getSession(util.getFileType(doc));

    if (current.get('connected')) {
        let editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            codeSelection = null,
            code = "";

        if (selection.isEmpty) {
            codeSelection = select.getFormSelection(doc, selection.active, topLevel);
            code = doc.getText(codeSelection);
        } else {
            codeSelection = selection,
                code = doc.getText(selection);
        }

        if (code.length > 0) {
            annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.PENDING);
            let msg = calvaLib.message_evaluateMsg(session, util.getNamespace(doc.getText()), code, pprint),
                c = codeSelection.start.character,
                re = new RegExp("^\\s{" + c + "}", "gm");
            evaluateMsg(msg, "Evaluating:\n" + code.replace(re, ""), "unable to evaluate sexp", (results) => {
                const hasExceptions = _.some(results, "ex"),
                    hasStdErr = _.some(results, "err"),
                    hasError = hasExceptions | hasStdErr;

                let result = [],
                    out = [],
                    err = [];
                _.each(results, (r) => {
                    if (r.hasOwnProperty("err")) {
                        err.push(r.err);
                    } else if (r.hasOwnProperty("value")) {
                        result.push(r.value);
                    } else if (r.hasOwnProperty("pprint-out")) {
                        result.push(r["pprint-out"].replace(/\n$/, ""));
                    } else if (r.hasOwnProperty("out")) {
                        if (hasExceptions && !hasStdErr) {
                            // venantius/ultra outputs errors on stdout, it seems.
                            err.push(r.out)
                        }
                        else {
                            out.push(r.out);
                        }
                    }
                });
                if (result.length + out.length + err.length > 0) {
                    if (replace && !hasError) {
                        const indent = ' '.repeat(c),
                            edit = vscode.TextEdit.replace(codeSelection, result.join("\n").replace(/\n/gm, "\n" + indent)),
                            wsEdit = new vscode.WorkspaceEdit();
                        wsEdit.set(editor.document.uri, [edit]);
                        vscode.workspace.applyEdit(wsEdit);
                        chan.appendLine("Replaced inline.")
                    } else {
                        annotations.decorateSelection(codeSelection, editor, (hasError ? annotations.AnnotationStatus.ERROR : annotations.AnnotationStatus.SUCCESS));
                        if (!pprint) {
                            const annotation = hasError ? err.join("\n") : result.join("\n");
                            annotations.decorateResults(' => ' + annotation.replace(/\n/gm, " ") + " ", hasError, codeSelection, editor);
                        }
                        if (out.length > 0) {
                            chan.append("out: ")
                            chan.append(out.join("\n"));
                        }
                        if (result.length > 0) {
                            chan.append('=> ');
                            if (pprint) {
                                chan.appendLine('');
                                chan.show(true);
                            }
                            chan.appendLine(result.join("\n"));
                        }
                        if (err.length > 0) {
                            chan.append("Error: ")
                            chan.append(err.join("\n"));
                        }
                    }
                } else {
                    chan.appendLine("Evaluation failed for unknown reasons. Sometimes it helps evaluating the file first.");
                }
            });
        }
    }
}

function evaluateSelectionReplace(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { replace: true, pprint: true }));
}

function evaluateSelectionPrettyPrint(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { pprint: true }));
}
function evaluateCurrentTopLevelFormPrettyPrint(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { pprint: true, topLevel: true }));
}

function evaluateTopLevelForm(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { topLevel: true }));
}

function evaluateFile(document = {}, callback = () => { }) {
    let current = state.deref(),
        doc = util.getDocument(document),
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        chan = current.get('outputChannel');

    if (doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        let session = util.getSession(util.getFileType(doc)),
            msg = calvaLib.message_loadFileMsg(session, doc.getText(), fileName, doc.fileName);

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
                chan.appendLine("No results from file evaluation.");
            }
            callback();
        });
    }
}

export default {
    evaluateFile,
    evaluateSelection,
    evaluateTopLevelForm,
    evaluateSelectionPrettyPrint,
    evaluateCurrentTopLevelFormPrettyPrint,
    evaluateSelectionReplace
};
