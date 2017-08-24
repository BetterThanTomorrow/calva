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
    console.log(warning);
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
                                          vscode.DiagnosticSeverity.Warning)]);
};

function getReason (results) {
    let illegal_arguments = _.filter(results, {class: ERROR.ILLEGAL_ARGUMENT});
    if (illegal_arguments.length > 0) {
        console.log(illegal_arguments);
        return [ERROR.ILLEGAL_ARGUMENT, illegal_arguments[0].message];
    }
    return [ERROR.DEFAULT, "Something went wrong.."];
};

function getLineAndColumn (results) {
    let line = null, column = null,
        hasLine = (s) => { return (s.indexOf(":line") !== -1 || s.indexOf("line") !== -1); };
        hasCol = (s) => { return (s.indexOf(":column") !== -1 || s.indexOf("column") !== -1); };
        extractWordPlacement = (words, word) => {for (var w = 0; w < words.length; w++) {
                                                    if (words[w].indexOf(word) !== -1) {
                                                        return words[w].replace(word, "").trim();
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
                console.log(words);
                line = extractWordPlacement(words, ":line");
            } else if (message !== null && hasLine(message)) {
                let words = message.split(" ");
                console.log(words);
                line = extractWordPlacement(words, "line");
            }
        }

        if (column === null) {
            if (data !== null && hasCol(data)) {
                let words = data.replace(" ", "").split(",");
                console.log(words);
                column = extractWordPlacement(words, ":column");
            } else if (message !== null && hasCol(message)) {
                let words = message.split(" ");
                console.log(words);
                column = extractWordPlacement(words, "column");
            }
        }
    }
    console.log("line: " + line + " and column: " + column);
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
        let loadFileResults = null,
            stacktraceResults = null,
            warnings = [],
            error = null,
            fileName = getFileName(doc),
            namespace = getNamespace(doc.getText()),
            session = current.get(getFileType(doc)),
            load_file = {op: "load-file",
                         file: doc.getText(),
                         "file-name": fileName,
                         "file-path": doc.fileName,
                         session},
            stacktrace = {op: "stacktrace", session},
            chan = current.get('outputChannel');
            chan.clear();
            chan.appendLine("Evaluating file: " + fileName);
            chan.appendLine("----------------------------");
        let loadfileClient = repl.create().once('connect', () => {
            loadfileClient.send(load_file, (lfr) => {
                loadFileResults = lfr;
                console.log("loaded file?");
                console.log(loadFileResults);
                if (_.some(loadFileResults, "ex")) {
                    let stackTraceClient = repl.create().once('connect', () => {
                        stackTraceClient.send(stacktrace, (str) => {
                            stackTraceResult = str;
                            console.log("stacktrace?");
                            console.log(stackTraceResult);

                            let [line, column] = getLineAndColumn(stackTraceResult);
                            let [type, reason] = getReason(stackTraceResult);

                            error = evaluationError({line, column, type, reason, file: doc.fileName});
                            logError(error);
                            markError(error);

                            stackTraceClient.end();
                        });
                    });
                }
                if (_.some(loadFileResults, "err")) {
                    warnings = getWarnings(loadFileResults);
                    warnings.forEach(w => {
                        logWarning(w);
                        markWarning(w);
                    });
                }

                if (warnings.length === 0 && error === null) {
                    logSuccess();
                }
                loadfileClient.end();
            });
        }).once('end', function() {
            console.log("loaded file!");
            //Fallback if stacktrace fails.
            setTimeout(() => {
                console.log(loadFileResults);
                console.log(stacktraceResults);
            }, 500);
        });
    }
};

module.exports = {
    evaluateFile,
    evaluateSelection
};
