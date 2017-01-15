const vscode = require('vscode');
const helpers = require('./helpers');
const nreplClient = require('../nrepl/client');
const nreplMsg = require('../nrepl/message');

function evaluateExpression(state, document = null) {
    if (state.connected) {
        let editor = vscode.window.activeTextEditor;
        document = document === null ? editor.document : document;
        if (editor !== undefined) {
            let filetypeIndex = (document.fileName.lastIndexOf('.') + 1),
                filetype = document.fileName.substr(filetypeIndex,
                    document.fileName.length);
            if (state.session_type.supports.indexOf(filetype) >= 0) {
                let documentText = document.getText(),
                    selection = editor.selection,
                    isSelection = !selection.isEmpty,
                    code = '';
                if (isSelection) { //text selected by user, try to evaluate it
                    code = document.getText(selection);
                    //If a '(' or ')' is selected, evaluate the expression within
                    if (code === '(') {
                        let currentPosition = selection.active,
                            previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
                            lastLine = document.lineCount,
                            endPosition = currentPosition.with(lastLine, document.lineAt(Math.max(lastLine - 1, 0)).text.length),
                            textSelection = new vscode.Selection(previousPosition, endPosition);
                        code = helpers.getContentToNextBracket(document.getText(textSelection));
                    } else if (code === ')') {
                        let currentPosition = selection.active,
                            startPosition = currentPosition.with(0, 0),
                            textSelection = new vscode.Selection(startPosition, currentPosition);
                        code = helpers.getContentToPreviousBracket(document.getText(textSelection));
                    }
                } else { //no text selected, check if cursor at a start '(' or end ')' and evaluate the expression within
                    let currentPosition = selection.active,
                        nextPosition = currentPosition.with(currentPosition.line, (currentPosition.character + 1)),
                        previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
                        nextSelection = new vscode.Selection(currentPosition, nextPosition),
                        previousSelection = new vscode.Selection(previousPosition, currentPosition),
                        nextChar = document.getText(nextSelection),
                        prevChar = document.getText(previousSelection);

                    if (nextChar === '(' || prevChar === '(') {
                        let lastLine = document.lineCount,
                            endPosition = currentPosition.with(lastLine, document.lineAt(Math.max(lastLine - 1, 0)).text.length),
                            startPosition = (nextChar === '(') ? currentPosition : previousPosition,
                            textSelection = new vscode.Selection(startPosition, endPosition);
                        code = helpers.getContentToNextBracket(document.getText(textSelection));
                    } else if (nextChar === ')' || prevChar === ')') {
                        let startPosition = currentPosition.with(0, 0),
                            endPosition = (prevChar === ')') ? currentPosition : nextPosition,
                            textSelection = new vscode.Selection(startPosition, endPosition);
                        code = helpers.getContentToPreviousBracket(document.getText(textSelection));
                    }
                }
                if (code.length > 0) {
                    state.outputChannel.clear();
                    state.outputChannel.appendLine("Evaluating \n" + code);
                    state.outputChannel.appendLine("----------------------------");
                    let evalClient = nreplClient.create({
                        host: state.hostname,
                        port: state.port
                    }).once('connect', function () {
                        let msg = nreplMsg.evaluate(state, helpers.getNamespace(documentText), code);
                        evalClient.send(msg, function (results) {
                            for (var i = 0; i < results.length; i++) {
                                let result = results[i];
                                if (result.hasOwnProperty('out')) {
                                    state.outputChannel.appendLine("side effects:");
                                    state.outputChannel.append(result.out);
                                } else if (result.hasOwnProperty('value')) {
                                    state.outputChannel.appendLine("Evaluation: success");
                                    state.outputChannel.appendLine("=>")
                                    state.outputChannel.appendLine((result.value.length > 0 ? result.value : "no result.."));
                                } else if (result.ex) {
                                    state.outputChannel.appendLine("Evaluation: failure");
                                    state.outputChannel.appendLine("=>");
                                    state.outputChannel.appendLine(result.ex);
                                    helpers.handleException(state, results, true);
                                }
                            }
                            state.outputChannel.appendLine("----------- done -----------\n");
                            state.outputChannel.show(true);
                            evalClient.end();
                        });
                    });
                }
            } else {
                vscode.window.showErrorMessage("Filetype " + filetype + " not supported by current nREPL => " + state.session_type.statusbar);
            }
        }
    }
};

function evaluateFile(state, document = null) {
    if (state.connected) {
        let editor = vscode.window.activeTextEditor;
        document = document === null ? editor.document : document;

        if (editor !== undefined) {
            let filetypeIndex = (document.fileName.lastIndexOf('.') + 1);
            let filetype = document.fileName.substr(filetypeIndex,
                document.fileName.length);
            if (state.session_type.supports.indexOf(filetype) >= 0) {
                let documentText = document.getText();
                let hasText = documentText.length > 0;
                if (hasText) {
                    let fileNameIndex = (document.fileName.lastIndexOf('\\') + 1),
                        fileName = document.fileName.substr(fileNameIndex, document.fileName.length),
                        filePath = document.fileName;

                    state.outputChannel.clear();
                    state.outputChannel.appendLine("Evaluating  " + fileName);
                    state.outputChannel.appendLine("----------------------------");

                    state.diagnosticCollection.clear();
                    let evalClient = nreplClient.create({
                        host: state.hostname,
                        port: state.port
                    }).once('connect', function () {
                        let msg = nreplMsg.loadFile(state, documentText, fileName, filePath);
                        evalClient.send(msg, function (results) {
                            for (var r = 0; r < results.length; r++) {
                                let result = results[r];
                                if (result.hasOwnProperty('out')) {
                                    state.outputChannel.appendLine("side effects:");
                                    state.outputChannel.append(result.out);
                                } else if (result.hasOwnProperty('value')) {
                                    state.outputChannel.appendLine("Evaluation: success");
                                    state.outputChannel.appendLine("=>")
                                    state.outputChannel.appendLine((result.value.length > 0 ? result.value : "no result.."));
                                } else if (result.ex) {
                                    state.outputChannel.appendLine("Evaluation: failure");
                                    state.outputChannel.appendLine("=>");
                                    state.outputChannel.appendLine(result.ex);
                                    helpers.handleException(state, results);
                                }
                            }
                            state.outputChannel.appendLine("----------- done -----------\n");
                            state.outputChannel.show(true);
                            evalClient.end();
                        });
                    });
                }
            } else {
                vscode.window.showErrorMessage("Filetype " + filetype + " not supported by current repl => " + state.session_type.statusbar);
            }
        }
    }
};

module.exports = {
    evaluateFile,
    evaluateExpression
};
