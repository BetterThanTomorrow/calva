const vscode = require('vscode');
const nreplClient = require('./nrepl/client');
const SESSION_TYPE = require('./nrepl/session_type');
const nreplMsg = require('./nrepl/message');

var state = require('./state'); //initial state
var statusbar_connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
var statusbar_type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

var outputChannel = vscode.window.createOutputChannel("VisualClojure");
let diagnosticCollection = vscode.languages.createDiagnosticCollection('VisualClojure: Evaluation errors');

const CLOJURE_MODE = { language: 'clojure', scheme: 'file'};
let evaluateFile;

function updateStatusbar(state) {
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
                for (var i = 0; i < results.length; i++) {
                    let result = results[i];
                    if (result.value && result.value === "3.14") {
                        state.session = sessions[current];
                        state.session_type = SESSION_TYPE.CLJS;

                        state.cljs_session = sessions[current];
                        state.clj_session = sessions[current + 1];

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
            } else {
                evaluateFile();
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

function handleException(exceptions, isSelection = false) {
    let errorHasBeenMarked = false;
    diagnosticCollection.clear();
    let exClient = nreplClient.create({
        host: state.hostname,
        port: state.port
    }).once('connect', function () {
        let msg = nreplMsg.stacktrace(state),
            editor = vscode.window.activeTextEditor,
            errLine = null,
            errChar = null,
            errFileUri = editor.document.uri;

        exClient.send(msg, (results) => {
            if (results.length === 2 && results[0].status[0] === "no-error" && results[1].status[0] === "done") {
                let errorMsg = "Error when evaluating this expression..";
                for(let r = 0; r < exceptions.length; r++) {
                    let result = exceptions[r];
                    if(result.hasOwnProperty('err')
                      && result.err.indexOf("line") !== -1 
                      && result.err.indexOf("column") !== -1) {
                        errorHasBeenMarked = true;  
                        let errorParts = result.err;
                        if (errorParts.indexOf("starting at line") !== -1 && errorParts.indexOf("and column") !== -1) {
                            errorParts = result.err.split(' ');
                            errorMsg = result.err.substring(result.err.indexOf("clojure.lang.ExceptionInfo:") + 27, result.err.indexOf("starting"));
                        } else if (errorParts.indexOf("at line") !== -1 && errorParts.indexOf("and column") === -1) {
                            errorParts = result.err.substring(result.err.indexOf('{'), result.err.indexOf('}')).replace(/:/g, '').replace(/,/g, '').replace(/\r\n/, '').replace(/}/, '').split(' ');
                            errorMsg = result.err.substring(result.err.indexOf("clojure.lang.ExceptionInfo:") + 27, result.err.indexOf("at line"));
                        } else if (errorParts.indexOf(":line") !== -1 && errorParts.indexOf(":column") !== -1) {
                            errorParts = result.err.substring(result.err.indexOf('{'), result.err.indexOf('}')).replace(/:/g, '').replace(/,/g, '').replace(/\r\n/, '').replace(/}/, '').split(' ');
                            errorMsg = result.err.substring(result.err.indexOf("clojure.lang.ExceptionInfo:") + 27, result.err.indexOf("{"));
                        }
                        errLine = parseInt(errorParts[errorParts.indexOf("line") + 1], 10) - 1;
                        errChar = parseInt(errorParts[errorParts.indexOf("column") + 1], 10) - 1;
                    }
                    if (result.hasOwnProperty('err') && result.err.indexOf("WARNING:") !== -1) {
                        errorMsg += "\n" + result.err.substring(result.err.indexOf("WARNING:"), result.err.indexOf("at line"));
                    }
                    if (result.hasOwnProperty('err') && result.err.indexOf("TypeError:") !== -1) {
                        errorMsg += "\n" + result.err;
                    }

                }
                if(!errorHasBeenMarked) {
                    diagnosticCollection.set(editor.document.uri, 
                                                [new vscode.Diagnostic(new vscode.Range(editor.selection.start.line, 
                                                editor.selection.start.character, 
                                                editor.selection.start.line, 
                                                editor.document.lineAt(editor.selection.start.line).text.length),
                                errorMsg, vscode.DiagnosticSeverity.Error)]);
                } else if(errLine >= 0  && errChar >= 0) {
                    if(isSelection) {
                        errLine = errLine + editor.selection.start.line;
                        errChar = errChar + editor.selection.start.character;
                    }
                    let errPos = new vscode.Position(errLine, errChar),
                        errLineLength = editor.document.lineAt(errLine).text.length;
                    
                    editor.selection = new vscode.Selection(errPos, errPos);
                    diagnosticCollection.set(errFileUri, [new vscode.Diagnostic(new vscode.Range(errLine, errChar, errLine, errLineLength),
                        errorMsg, vscode.DiagnosticSeverity.Error)]);
                }
            } else {
                for(let r = 0; r < results.length; r++) {
                    let result = results[r],
                        errLine = result.line - 1,
                        errChar = result.column - 1,
                        errFile = result.file,
                        errFileUri = null,
                        errMsg = result.message,
                        editor = vscode.window.activeTextEditor;

                    if (errFile) {
                        errFileUri = vscode.Uri.file(errFile);
                    } else {
                        errFileUri = editor.document.uri;
                    }

                    if(errLine >= 0  && errChar >= 0) {
                        if(!editor.selection.isEmpty) {
                            errLine = errLine + editor.selection.start.line;
                            errChar = errChar + editor.selection.start.character;
                        }

                        let errPos = new vscode.Position(errLine, errChar);
                        editor.selection = new vscode.Selection(errPos, errPos);
                        let errLineLength = editor.document.lineAt(errLine).text.length;

                        diagnosticCollection.set(errFileUri, [new vscode.Diagnostic(new vscode.Range(errLine, errChar, errLine, errLineLength),
                            errMsg, vscode.DiagnosticSeverity.Error)]);
                    }
                }
            }
            exClient.end();
        });
    });
};

function activate(context) {
    context.subscriptions.push(vscode.languages.setLanguageConfiguration('clojure', {}));
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
                        if (code === '(') {
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
                                for (var i = 0; i < results.length; i++) {
                                    let result = results[i];
                                    if (result.hasOwnProperty('out')) {
                                        outputChannel.appendLine("side effects:");
                                        outputChannel.append(result.out);
                                    } else if (result.hasOwnProperty('value')) {
                                        outputChannel.appendLine("Evaluation: success");
                                        outputChannel.appendLine("=>")
                                        outputChannel.appendLine((result.value.length > 0 ? result.value : "no result.."));
                                    } else if (result.ex) {
                                        outputChannel.appendLine("Evaluation: failure");
                                        outputChannel.appendLine("=>");
                                        outputChannel.appendLine(result.ex);
                                        handleException(results, true);
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

    evaluateFile = function (document = null) {
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

                        outputChannel.clear();
                        outputChannel.appendLine("Evaluating  " + fileName);
                        outputChannel.appendLine("----------------------------");

                        diagnosticCollection.clear();
                        let evalClient = nreplClient.create({
                            host: state.hostname,
                            port: state.port
                        }).once('connect', function () {
                            let msg = nreplMsg.loadFile(state, documentText, fileName, filePath);
                            evalClient.send(msg, function (results) {
                                for (var r = 0; r < results.length; r++) {
                                    let result = results[r];
                                    if (result.hasOwnProperty('out')) {
                                        outputChannel.appendLine("side effects:");
                                        outputChannel.append(result.out);
                                    } else if (result.hasOwnProperty('value')) {
                                        outputChannel.appendLine("Evaluation: success");
                                        outputChannel.appendLine("=>")
                                        outputChannel.appendLine((result.value.length > 0 ? result.value : "no result.."));
                                    } else if (result.ex) {
                                        outputChannel.appendLine("Evaluation: failure");
                                        outputChannel.appendLine("=>");
                                        outputChannel.appendLine(result.ex);
                                        handleException(results);
                                    }
                                }
                                outputChannel.appendLine("----------- done -----------\n");
                                outputChannel.show(true);
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
    context.subscriptions.push(vscode.commands.registerCommand('visualclojure.evaluateFile', evaluateFile));

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        evaluateFile(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        evaluateFile(document);
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        evaluateFile(document);
    }));

    class HoverProvider {
        constructor() {
            this.wordBinders = ['/', '-'];
            this.specialWords = ['-', '+', '/', '*']; //TODO: Add more here
        }

        formatDocString (arglist, doc) {
            let result = '';
            if(arglist !== 'undefined'){
                result += '**signature:**\n\n'
                result += arglist.substring(1, arglist.length - 1)
                                .replace(/\]\ \[/g, ']\n\n[');
            }
            if(doc !== 'undefined'){
                result += '\n\n**description:**\n\n'
                result += '```clojure\n' + doc.replace(/\s\s+/g, ' ') + '\n```';
            }
            result += '';
            return result.length > 0 ? result : "";
         }

        getActualWord(document, position, selected, word) {
            if(selected !== undefined) { 
                let preChar = document.lineAt(position.line).text.slice(selected.start.character - 1, selected.start.character),
                postChar = document.lineAt(position.line).text.slice(selected.end.character, selected.end.character + 1);

                if (this.wordBinders.indexOf(preChar) !== -1) {
                    let prePosition = new vscode.Position(selected.start.line, selected.start.character - 1),
                        preSelected = document.getWordRangeAtPosition(prePosition),
                        preText = document.getText(new vscode.Range(preSelected.start, preSelected.end));

                    return this.getActualWord(document, prePosition, new vscode.Range(preSelected.start, selected.end), preText + preChar + word);
                } else if (this.wordBinders.indexOf(postChar) !== -1) {
                    let postPosition = new vscode.Position(selected.end.line, selected.end.character + 1),
                        postSelected = document.getWordRangeAtPosition(postPosition),
                        postText = document.getText(new vscode.Range(postSelected.start, postSelected.end));

                    return this.getActualWord(document, postPosition, new vscode.Range(selected.start, postSelected.end), word + postChar + postText);
                } else {
                    return word
                }

            } else {
                let selectedChar = document.lineAt(position.line).text.slice(position.character, position.character + 1),
                    isFn = document.lineAt(position.line).text.slice(position.character - 1, position.character) === "(";
                if(this.specialWords.indexOf(selectedChar) !== -1 && isFn) {
                    return selectedChar;
                } else {
                    console.error("Unsupported selectedChar '" + selectedChar + "'");
                    return word;
                }
            } 
        }

        provideHover (document, position, token) {
            let selected = document.getWordRangeAtPosition(position),
                selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "",
                text = this.getActualWord(document, position, selected, selectedText),
                arglist = "",
                docstring = "",
                scope = this;
            if(state.connected) {
                return new Promise((resolve, reject) => {
                    let infoClient = nreplClient.create({
                        host: state.hostname,
                        port: state.port
                    }).once('connect', () => {
                        let msg = nreplMsg.info(state, getNamespace(document.getText()), text);
                        infoClient.send(msg, function (results) {
                            for (var r = 0; r < results.length; r++) {
                                let result = results[r];
                                
                                arglist += result['arglists-str'];
                                docstring += result.doc;
                            }
                            infoClient.end();
                            if (docstring.length === 0) {
                                reject("Docstring not found for " + text);
                            } else {
                                let result = scope.formatDocString(arglist, docstring);
                                if(result.length === 0) {
                                    reject("Docstring not found for " + text);
                                } else {
                                    resolve(new vscode.Hover(result));
                                }
                            }
                        });
                    });
                });
            } else {
                return new vscode.Hover("Not connected to nREPL..");
            }
        }
    }
    context.subscriptions.push(vscode.languages.registerHoverProvider(CLOJURE_MODE, new HoverProvider()));

    class CompletionItemProvider {
        constructor () {
            this.wordBinders = ['/', '-'];
            this.specialWords = ['-', '+', '/', '*']; //TODO: Add more here
            this.mappings = {
                            'nil': vscode.CompletionItemKind.Value,
                            'macro': vscode.CompletionItemKind.Value,
                            'class': vscode.CompletionItemKind.Class,
                            'keyword': vscode.CompletionItemKind.Keyword,
                            'namespace': vscode.CompletionItemKind.Module,
                            'function': vscode.CompletionItemKind.Function,
                            'special-form': vscode.CompletionItemKind.Keyword,
                            'var': vscode.CompletionItemKind.Variable,
                            'method': vscode.CompletionItemKind.Method
                            };
        }

        getActualWord(document, position, selected, word) {
            if(selected !== undefined) { 
                let preChar = document.lineAt(position.line).text.slice(selected.start.character - 1, selected.start.character),
                postChar = document.lineAt(position.line).text.slice(selected.end.character, selected.end.character + 1);

                if (this.wordBinders.indexOf(preChar) !== -1) {
                    let prePosition = new vscode.Position(selected.start.line, selected.start.character - 1),
                        preSelected = document.getWordRangeAtPosition(prePosition),
                        preText = document.getText(new vscode.Range(preSelected.start, preSelected.end));

                    return this.getActualWord(document, prePosition, new vscode.Range(preSelected.start, selected.end), preText + preChar + word);
                } else if (this.wordBinders.indexOf(postChar) !== -1) {
                    let postPosition = new vscode.Position(selected.end.line, selected.end.character + 1),
                        postSelected = document.getWordRangeAtPosition(postPosition),
                        postText = document.getText(new vscode.Range(postSelected.start, postSelected.end));

                    return this.getActualWord(document, postPosition, new vscode.Range(selected.start, postSelected.end), word + postChar + postText);
                } else {
                    return word
                }

            } else {
                let selectedChar = document.lineAt(position.line).text.slice(position.character, position.character + 1),
                    isFn = document.lineAt(position.line).text.slice(position.character - 1, position.character) === "(";
                if(this.specialWords.indexOf(selectedChar) !== -1 && isFn) {
                    return selectedChar;
                } else {
                    console.error("Unsupported selectedChar '" + selectedChar + "'");
                    return word;
                }
            } 
        }

        provideCompletionItems (document, position, token) {
             let selected = document.getWordRangeAtPosition(position),
                selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "",
                text = this.getActualWord(document, position, selected, selectedText),
                scope = this;
            if(state.connected) {
                return new Promise((resolve, reject) => {
                    let completionClient = nreplClient.create({
                        host: state.hostname,
                        port: state.port
                    }).once('connect', () => {
                        let msg = nreplMsg.complete(state, getNamespace(document.getText()), text),
                        completions = [];
                        completionClient.send(msg, function (results) {
                            for (var r = 0; r < results.length; r++) {
                                let result = results[r];
                                if(result.hasOwnProperty('completions')) {
                                    for(let c = 0; c < result.completions.length; c++) {
                                        let item = result.completions[c];
                                        completions.push({
                                            label: item.candidate,
                                            kind: scope.mappings[item.type] || vscode.CompletionItemKind.Text,
                                            insertText: item[0] === '.' ? item.slice(1) : item
                                        });
                                    }
                                }
                            }
                            if(completions.length > 0) {
                                resolve(new vscode.CompletionList(completions, false));
                            } else {
                                reject("No completions found");
                            }
                            completionClient.end();
                        });
                    });
                });
            } else {
                return new vscode.Hover("Not connected to nREPL..");
            }
        }

        resolveCompletionItem (item, token) {
            return new Promise((resolve, reject) => {
                if(state.connected) {
                    let completionClient = nreplClient.create({
                        host: state.hostname,
                        port: state.port
                    }).once('connect', () => {
                        let document = vscode.window.activeTextEditor.document,
                        msg = nreplMsg.info(state, getNamespace(document.getText()), item.label);
                        completionClient.send(msg, function (results) {
                            for (var r = 0; r < results.length; r++) {
                                let result = results[r];
                                if (result.hasOwnProperty('doc')) {
                                    item.documentation = result.doc;
                                }
                            }
                            resolve(item);
                            completionClient.end();
                        })
                    })
                }  else {
                    reject("Not connected to nREPL");
                }
            });
        }
    }
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(CLOJURE_MODE, new CompletionItemProvider()));
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
