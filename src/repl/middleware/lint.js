const vscode = require('vscode');
const _ = require('lodash');
const cmd = require('node-cmd');
const state = require ('../../state');
const repl = require('../client');
const message = require('../message');
const {getDocument, getFileName, getFileType, getNamespace, getActualWord, getStartExpression,
       getContentToNextBracket, getContentToPreviousBracket} = require('../../utilities');

const TYPE = {ERROR: "ERROR",
              WARNING: "WARNING"};

function logError (error) {
    let chan = state.deref().get('outputChannel');

    chan.appendLine("Error evaluating file: " + error.type);
    chan.appendLine(error.reason);
    chan.appendLine("at line: " + error.line + " and column: " + error.column)
};

function logSuccess (results) {
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

function markError (error) {
    let position = new vscode.Position(error.line, error.column),
        diagnostic = state.deref().get('diagnosticCollection'),
        editor = vscode.window.activeTextEditor,
        errors = diagnostic.get(editor.document.uri) || [],
        newErrors = errors.slice();

    let line = error.line - 1,
        column = error.column,
        lineLength = editor.document.lineAt(line).text.length,
        lineText = editor.document.lineAt(line).text.substring(column, lineLength),
        firstWordStart = column + lineText.indexOf(" ");

    newErrors.push(new vscode.Diagnostic(new vscode.Range(line, column, line, firstWordStart),
                                         error.reason,
                                         vscode.DiagnosticSeverity.Error));
    diagnostic.set(editor.document.uri, newErrors);
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
        editor = vscode.window.activeTextEditor,
        warnings = diagnostic.get(editor.document.uri) || [],
        newWarnings = warnings.slice();

    let line = Math.max(0, (warning.line - 1)),
        lineLength = editor.document.lineAt(line).text.length,
        column = warning.column || lineLength;

        newWarnings.push(new vscode.Diagnostic(new vscode.Range(line, column, line, lineLength),
                                            warning.reason,
                                            vscode.DiagnosticSeverity.Warning));
    diagnostic.set(editor.document.uri, newWarnings);
};

function getErrors (result) {
    let isError = result.indexOf("Stacktrace"),
        matches = [],
        lineAndColumnRe = /:\b(\d*)+/g,
        regexResult = null,
        searchString = isError !== -1 ? result.substring(0, isError) : result,
        searchArray = searchString.split(":"),
        match = lineAndColumnRe.exec(searchString),
        errors = [];

        while(match !== null) {
            matches.push(match[1]);
            match = lineAndColumnRe.exec(searchString);
        }

        for (var i = 0; i < matches.length; i += 2) {
            let idx = searchArray.indexOf(matches[i]), //index of error line
                message = searchArray[idx + 2] + ":" + searchArray[idx + 3],
                errorType = searchArray[idx + 2].indexOf('warning') !== -1
                          ? TYPE.WARNING : TYPE.ERROR;
            errors.push({
                line: parseInt(matches[i], 10),
                column: parseInt(matches[i + 1], 10),
                reason: message.trim(),
                type: errorType
            });
        }
    return errors;
};

function lintFile(document = {}) {
    let current = state.deref(),
        diagnostic = current.get('diagnosticCollection')
        doc = getDocument(document);

    diagnostic.clear();

    let fileName = getFileName(doc),
        namespace = getNamespace(doc.getText()),
        session = current.get(getFileType(doc)),
        errors = [];

        chan = current.get('outputChannel');
        chan.clear();
        chan.appendLine("Evaluating file: " + fileName);
        chan.appendLine("----------------------------");

        let lintFileCmd = 'C:/Users/Stian/bin/joker.exe --lint ' + doc.fileName;
        cmd.get(
            lintFileCmd,
            function(err, data, result){
                if (result.length > 0) {
                    errors = getErrors(result);
                    errors.forEach(function(err) {
                        if (err.type === TYPE.ERROR) {
                            markError(err);
                        } else if (err.type === TYPE.WARNING) {
                            markWarning(err);
                        } else {
                            console.error("Unknown error type: " + err.type);
                            console.error(err);
                        }
                    }, this);
                } else {
                    //If no errors - Load file using nrepl
                    if (current.get('connected')) {
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
                                logSuccess(loadFileResults);
                            }
                        }).catch((error) => {
                            console.log("ERROR REJECTED! LOADFILE!");
                            console.log(error);
                        });
                    }
                }
            }
        );
        console.log(errors);
        return errors;
};

module.exports = {
    lintFile
};
