const vscode = require('vscode');
const nreplClient = require('./nrepl/client');
const SESSION_TYPE = require('./nrepl/session_type');
const nreplMsg = require('./nrepl/message');

var state = require('./state'); //initial state
var statusbar_connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
var statusbar_type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

var outputChannel = vscode.window.createOutputChannel("visualclojure:output");

function updateStatusbar(state) {
    console.log("updating statusbar!");
    if (state.hostname) {
        statusbar_connection.text = "nrepl://" + state.hostname + ":" + state.port;
    } else {
        statusbar_connection.text = "nrepl - no connection";
    }
    statusbar_type.text = state.session_type.statusbar;
    switch (state.session_type.id) {
        case SESSION_TYPE.CLJ.id:
            statusbar_type.color = "rgb(144,180,254)";
            break;
        case SESSION_TYPE.CLJS.id:
            statusbar_type.color = "rgb(145,220,71)";
            break;
        default:
            statusbar_type.color = "rgb(192,192,192)";
            break;
    }

    statusbar_connection.show();
    statusbar_type.show();
};

function findSession(state, current, sessions) {
    let tmpClient = nreplClient.create({
            host: state.hostname,
            port: state.port
        })
        .once('connect', function () {
            let msg = nreplMsg.testSession(sessions[current]); 
            tmpClient.send(msg, function (results) {
                for(var i = 0; i < results.length; i++) {
                    let result = results[i];
                    if (result.value && result.value === "3.14") {
                        state.session = sessions[current];
                        state.session_type = SESSION_TYPE.CLJS;
                    } else if (result.ex) {
                        console.log("EXCEPTION!! HANDLE IT");
                        console.log(JSON.stringify(result));
                    }
                }
                tmpClient.end();
            });
        })
        .once('end', function () {
            //If last session, check if found
            if (current === (sessions.length - 1) && state.session === null) {
                //Default to first session if no cljs-session is found, and treat it as a clj-session
                if (sessions.length > 0) {
                    state.session = sessions[0];
                    state.session_type = SESSION_TYPE.CLJ;
                }
            } else if (state.session === null) {
                findSession(state, (current + 1), sessions);
            }
            updateStatusbar(state);
        });
};

function getNamespace(text) {
    let match = text.match(/^[\s\t]*\((?:[\s\t\n]*(?:in-){0,1}ns)[\s\t\n]+'?([\w.\-\/]+)[\s\S]*\)[\s\S]*/);
    return match ? match[1] : 'user';
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
    return block.substr(0, currPos);
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
    return block.substr(currPos + 1, block.length);
};

function activate(context) {
    updateStatusbar(state);

    let connectToREPL = vscode.commands.registerCommand('visualclojure.connectToREPL', function () {
        vscode.window.showInputBox({
                placeHolder: "Enter existing nREPL hostname:port here...",
                prompt: "Add port to nREPL if localhost, otherwise 'hostname:port'",
                value: "localhost:",
                ignoreFocusOut: true
            })
            .then(function (url) {
                let [hostname, port] = url.split(':');
                state.hostname = hostname;
                state.port = port;
                let lsSessionClient = nreplClient.create({
                    host: state.hostname,
                    port: state.port
                }).once('connect', function () {
                    state.connected = true;
                    let msg = nreplMsg.listSessions();
                    lsSessionClient.send(msg, function (results) {
                        findSession(state, 0, results[0].sessions);
                        lsSessionClient.end();
                    });
                });
            });
    });
    context.subscriptions.push(connectToREPL);

    let evaluateExpression = vscode.commands.registerCommand('visualclojure.evaluateExpression', function () {
        if (state.connected) {
            let editor = vscode.window.activeTextEditor;
            if (editor !== undefined) {
                let filetypeIndex = (editor.document.fileName.lastIndexOf('.') + 1),
                    filetype = editor.document.fileName.substr(filetypeIndex,
                        editor.document.fileName.length);
                if (state.session_type.supports.indexOf(filetype) >= 0) {
                    let documentText = editor.document.getText(),
                        selection = editor.selection,
                        isSelection = !selection.isEmpty,
                        code = '';
                    if (isSelection) { //text selected by user, try to evaluate it
                        code = editor.document.getText(selection);
                        //If a '(' or ')' is selected, evaluate the expression within
                        if(code === '(') {
                            let currentPosition = selection.active,
                                previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
                                lastLine = editor.document.lineCount,
                                endPosition = currentPosition.with(lastLine, editor.document.lineAt(Math.max(lastLine - 1, 0)).text.length), 
                                textSelection = new vscode.Selection(previousPosition, endPosition);
                            code = getContentToNextBracket(editor.document.getText(textSelection));
                        } else if (code === ')') {
                            let currentPosition = selection.active,
                                startPosition = currentPosition.with(0, 0),
                                textSelection = new vscode.Selection(startPosition, currentPosition);
                            code = getContentToPreviousBracket(editor.document.getText(textSelection));
                        }
                    } else { //no text selected, check if cursor at a start '(' or end ')' and evaluate the expression within
                        let currentPosition = selection.active,
                            nextPosition = currentPosition.with(currentPosition.line, (currentPosition.character + 1)),
                            previousPosition = currentPosition.with(currentPosition.line, Math.max((currentPosition.character - 1), 0)),
                            nextSelection = new vscode.Selection(currentPosition, nextPosition),
                            previousSelection = new vscode.Selection(previousPosition, currentPosition),
                            nextChar = editor.document.getText(nextSelection),
                            prevChar = editor.document.getText(previousSelection);

                        if (nextChar === '(' || prevChar === '(') {
                            let lastLine = editor.document.lineCount,
                                endPosition = currentPosition.with(lastLine, editor.document.lineAt(Math.max(lastLine - 1, 0)).text.length),
                                startPosition = (nextChar === '(') ? currentPosition : previousPosition, 
                                textSelection = new vscode.Selection(startPosition, endPosition);
                            code = getContentToNextBracket(editor.document.getText(textSelection));
                        } else if (nextChar === ')' || prevChar === ')') {
                            let startPosition = currentPosition.with(0, 0),
                                endPosition = (prevChar === ')') ? currentPosition : nextPosition, 
                                textSelection = new vscode.Selection(startPosition, endPosition);
                            code = getContentToPreviousBracket(editor.document.getText(textSelection));
                        }
                    }
                    if (code.length > 0) {
                        outputChannel.clear();
                        outputChannel.appendLine("Evaluating \n" + code);
                        outputChannel.appendLine("----------------------------");
                        let evalClient = nreplClient.create({
                            host: state.hostname,
                            port: state.port
                        }).once('connect', function () {
                            let msg = nreplMsg.evaluate(state, getNamespace(documentText), code);
                            evalClient.send(msg, function (results) {
                                for(var i = 0; i < results.length; i++) {
                                    let result = results[i];
                                    if (result.hasOwnProperty('out')) {
                                        outputChannel.appendLine("side effects:");
                                        outputChannel.append(result.out);
                                    }
                                    else if (result.hasOwnProperty('value')) {
                                        outputChannel.appendLine("=>")
                                        outputChannel.appendLine((result.value.length > 0 ?  result.value : "no result.."));
                                    } else if (result.ex) {
                                        vscode.window.showErrorMessage("Error evaluating the selected expressions");
                                        console.log("EXCEPTION!! HANDLE IT");
                                        console.log(JSON.stringify(result));
                                    }
                                }
                                outputChannel.appendLine("----------- done -----------\n");
                                outputChannel.show(true);
                                evalClient.end();
                            });
                        });
                    }
                } else {
                    vscode.window.showErrorMessage("Filetype " + filetype + " not supported by current nREPL => " + state.session_type.statusbar);
                }
            }
        }
    });
    context.subscriptions.push(evaluateExpression);

    let evaluateFile = vscode.commands.registerCommand('visualclojure.evaluateFile', function () {
        if (state.connected) {
            let editor = vscode.window.activeTextEditor;
            if (editor !== undefined) {
                let filetypeIndex = (editor.document.fileName.lastIndexOf('.') + 1);
                let filetype = editor.document.fileName.substr(filetypeIndex,
                    editor.document.fileName.length);
                if (state.session_type.supports.indexOf(filetype) >= 0) {
                    let documentText = editor.document.getText();
                    let hasText = documentText.length > 0;
                    if (hasText) {
                        let fileNameIndex = (editor.document.fileName.lastIndexOf('\\') + 1),
                            fileName = editor.document.fileName.substr(fileNameIndex, editor.document.fileName.length),
                            filePath = editor.document.fileName,
                            evalClient = nreplClient.connect({
                                host: state.hostname,
                                port: state.port
                            }).once('connect', function () {
                                let msg = nreplMsg.loadFile(state, documentText, fileName, filePath);
                                evalClient.send(msg, function (results) {
                                    for (var r = 0; r < results.length; r++) {
                                        let result = results[r];
                                        if (result.hasOwnProperty('value')) {
                                            vscode.window.showInformationMessage("=> " + (result.value.length > 0 ? result.value : "no result.."));
                                        } else if (result.ex) {
                                            vscode.window.showErrorMessage("Error evaluating " + fileName);
                                            console.log("EXCEPTION!! HANDLE IT");
                                            console.log(JSON.stringify(result));
                                        }
                                    }
                                    evalClient.end();
                                });
                            });
                    }
                } else {
                    vscode.window.showErrorMessage("Filetype " + filetype + " not supported by current repl => " + state.session_type.statusbar);
                }
            }
        }
    });
    context.subscriptions.push(evaluateFile);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
