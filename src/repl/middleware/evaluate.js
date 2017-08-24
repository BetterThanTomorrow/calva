const vscode = require('vscode');
const _ = require('lodash');
const state = require ('../../state');
const repl = require('../client');
const message = require('../message');
const {getDocument, getFileName, getFileType, getNamespace, getActualWord} = require('../../utilities');

const ERROR = {DEFAULT: "Unknown error..",
               ILLEGAL_ARGUMENT: "java.lang.IllegalArgumentException"};

const WARNING = {DEFAULT: "Warning"};

function evaluationError (options = {}) {
    return _.merge({type: ERROR.DEFAULT,
                    reason: null,
                    file: null,
                    line: null,
                    column: null}, options);
};

function evaluationWarning (options = {}) {
    return _.merge({type: WARNING.DEFAULT,
                    reason: null,
                    file: null,
                    line: null,
                    column: null}, options);
};

function logError (error) {
    let chan = state.deref().get('outputChannel');

    chan.appendLine("Error evaluating file: " + error.type);
    chan.appendLine(error.reason);
    chan.appendLine("at line: " + error.line + " and column: " + error.column)
};

function logSuccess () {
    let chan = state.deref().get('outputChannel');
    chan.appendLine("Evaluation completed successfully");
};

function markError (error) {
    let position = new vscode.Position(error.line, error.column),
        diagnostic = state.deref().get('diagnosticCollection'),
        editor = vscode.window.activeTextEditor;

    editor.selection = new vscode.Selection(position, position);
    let line = error.line - 1,
        column = error.column,
        lineLength = editor.document.lineAt(line).text.length,
        lineText = editor.document.lineAt(line).text.substring(column, lineLength),
        firstWordStart = column + lineText.indexOf(" ");

    diagnostic.set(editor.document.uri, [new vscode.Diagnostic(new vscode.Range(line, column, line, firstWordStart),
                                                                error.reason,
                                                                vscode.DiagnosticSeverity.Error)]);
};

function logWarning (warning) {
    let chan = state.deref().get('outputChannel');
    chan.appendLine(warning.type + ": " + warning.reason);
    if (warning.line !== null) {
        if (warning.column !== null) {
            chan.appendLine("at line: " + warning.line + " and column: " + warning.column)
        } else {
            chan.appendLine("at line: " + warning.line)
        }
    }
};

function markWarning (warning) {
    if (warning.line === null) {
        warning.line = 0;
    }
    if (warning.column === null) {
      warning.column = 0;
    }

    let position = new vscode.Position(warning.line, warning.column),
        diagnostic = state.deref().get('diagnosticCollection'),
        editor = vscode.window.activeTextEditor;

    editor.selection = new vscode.Selection(position, position);
    let line = Math.max(0, (warning.line - 1)),
        column = warning.column,
        lineLength = editor.document.lineAt(line).text.length;

    diagnostic.set(editor.document.uri,
                   [new vscode.Diagnostic(new vscode.Range(line, column, line, lineLength),
                                          warning.reason,
                                          vscode.DiagnosticSeverity.Error)]);
};

function getReason (results) {
    let illegal_arguments = _.filter(results, {class: ERROR.ILLEGAL_ARGUMENT});
    if (illegal_arguments.length > 0) {
        return [ERROR.ILLEGAL_ARGUMENT, illegal_arguments[0].message];
    } else {
        console.log("UNKOWN REASON..");
        console.log(results);
    }
    return [ERROR.DEFAULT, "Something went wrong.."];
};

function getLineAndColumn (results) {
    let line = null, column = null,
        hasLine = (s) => { return (s.indexOf(":line") !== -1 || s.indexOf("line") !== -1); };
        hasCol = (s) => { return (s.indexOf(":column") !== -1 || s.indexOf("column") !== -1 || s.indexOf("col") !== -1 || s.indexOf(":col") !== -1); };
        extractWordPlacement = (words, word) => {for (var w = 0; w < words.length; w++) {
                                                    if (words[w].indexOf(word) !== -1) {
                                                        return words[w].replace(word, "")
                                                                       .replace("}", "")
                                                                       .replace("{","")
                                                                       .trim();
                                                }}}
    for(var r = 0; r < results.length; r++) {
        if (line !== null && column !== null) break;

        let data = null, message = null;
        if (results[r].hasOwnProperty('data')) {
            data = results[r].data;
        }
        if (results[r].hasOwnProperty('message')) {
            message = results[r].message;
        }

        if (line === null) {
            if (data !== null && hasLine(data)) {
                let words = data.replace(" ", "").split(",");
                line = extractWordPlacement(words, ":line");
            } else if (message !== null && hasLine(message)) {
                let words = message.split(" ");
                line = extractWordPlacement(words, "line");
            }
        }

        if (column === null) {
            if (data !== null && hasCol(data)) {
                let words = data.replace(" ", "").split(",");
                column = extractWordPlacement(words, ":column")
                       || extractWordPlacement(words, ":col");

            } else if (message !== null && hasCol(message)) {
                let words = message.split(" ");
                column = extractWordPlacement(words, "column")
                       || extractWordPlacement(words, "col");
            }
        }
    }
    return [parseInt(line,10), parseInt(column, 10)];
};

function getWarnings (results) {
    let errs = _.filter(results, (v) => { return v.hasOwnProperty("err") && (v.err.indexOf("WARNING") !== -1)});
    let warnings = [];
    let line = null, column = null;
    for(var e = 0; e < errs.length; e++) {
        let w = errs[e].err,
            wEnd = null;

        if (w.indexOf("at line") !== -1) {
            wEnd = w.indexOf("at line");
        } else if (w.indexOf("in file") !== -1) {
            wEnd = w.indexOf("in file");
        } else {
            wEnd = w.length - 1;
        }
        let reason = w.substring(0,wEnd).replace("WARNING:", "");

        if (w.indexOf("line") !== -1) {
            let words = w.split(" "),
            lidx = words.indexOf("line") + 1;
            line = parseInt(words[lidx], 10);
        }
        if (w.indexOf("column") !== -1) {
            let words = w.split(" ");
            cidx = words.indexOf("column") + 1;
            column = parseInt(words[cidx], 10);
        }
        warnings.push(evaluationWarning({line, column, reason}));
    }
    return warnings;
};

function evaluateSelection() {

};

function evaluateFile(document = {}) {
    let current = state.deref(),
        diagnostic = current.get('diagnosticCollection')
        doc = getDocument(document);

    diagnostic.clear();
    if (current.get('connected')) {
        let fileName = getFileName(doc),
            namespace = getNamespace(doc.getText()),
            session = current.get(getFileType(doc));

            chan = current.get('outputChannel');
            chan.clear();
            chan.appendLine("Evaluating file: " + fileName);
            chan.appendLine("----------------------------");

        new Promise((resolve, reject) => {
            let loadfileClient = repl.create().once('connect', () => {
                loadfileClient.send({op: "load-file",
                                     file: doc.getText(),
                                     "file-name": fileName,
                                     "file-path": doc.fileName,
                                     session}, (result) => {
                    loadfileClient.end();
                    resolve(result);
                });
            }).once('end', () => {
                reject("failed?");
            });
        }).then((loadFileResults) => {
            let exceptions = _.some(loadFileResults, "ex"),
                errors = _.some(loadFileResults, "err");

            if (!exceptions && !errors) {
                logSuccess();
            }

            if (exceptions) {
                new Promise((resolve, reject) => {
                    let stackTraceClient = repl.create().once('connect', () => {
                        stackTraceClient.send({op: "stacktrace", session}, (result) => {
                            stackTraceClient.end();
                            resolve(result);
                        });
                    }).once('end', () => {
                        reject("failed?");
                    });
                }).then((stackTraceResult) => {
                    let [line, column] = getLineAndColumn(stackTraceResult);
                    let [type, reason] = getReason(stackTraceResult);
                    let error = evaluationError({line, column, type, reason, file: doc.fileName});
                    logError(error);
                    markError(error);
                }).catch((error) => {
                    console.log("ERROR REJECTED! STACKTRACE!");
                    console.log(error);
                });
            }
            if (errors) {
                let warnings = getWarnings(loadFileResults);
                warnings.forEach(w => {
                    logWarning(w);
                    markWarning(w);
                });
            }
        }).catch((error) => {
            console.log("ERROR REJECTED! LOADFILE!");
            console.log(error);
        });
    }
};

module.exports = {
    evaluateFile,
    evaluateSelection
};
