const vscode = require('vscode');
const nreplClient = require('./nrepl/client');
const SESSION_TYPE = require('./nrepl/session_type');

var state = require('./state'); //initial state
var statusbar_connection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
var statusbar_type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

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
            statusbar_type.color = "rgb(88,129,216)";
            break;
        case SESSION_TYPE.CLJS.id:
            statusbar_type.color = "rgb(99,177,50)";
            break;
        default:
            statusbar_type.color = "rgb(192,192,192)";
            break;
    }

    statusbar_connection.show();
    statusbar_type.show();
};

function findSession(state, current, sessions) {
    let tmpClient = nreplClient.connect({host: state.hostname, port: state.port})
        .once('connect', function() {
            tmpClient.evaluate('(js/parseFloat "3.14")', "user", sessions[current], function(err, results) {
                for(var r = 0; r < results.length; r++) {
                    let result = results[r];
                    if(result.value && result.value === "3.14") {
                        state.session = sessions[current];
                        state.session_type = SESSION_TYPE.CLJS;
                    } else if (result.ex) {
                        console.log("EXCEPTION!! HANDLE IT");
                        console.log(JSON.stringify(result));
                    } else if (result.status && result.status[0] === "done") {
                        tmpClient.end();
                    }
                }
            });
        })
        .once('end', function() {
            //If last session, check if found
            if(current === (sessions.length - 1) && state.session === null ) {
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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
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
                    let lsSessionClient = nreplClient.connect({host : state.hostname, port: state.port}).once('connect', function() {
                        state.connected = true;
                        lsSessionClient.lsSessions(function (err, results) {
                            findSession(state, 0, results[0].sessions);
                            lsSessionClient.end();
                        });
                    });
            });
    });
    context.subscriptions.push(connectToREPL);

    let evaluateExpression = vscode.commands.registerCommand('visualclojure.evaluateExpression', function () {
        if(state.connected) {
            let editor = vscode.window.activeTextEditor;
            if (editor !== undefined) {
                let filetypeIndex = (editor.document.fileName.lastIndexOf('.') + 1);
                let filetype = editor.document.fileName.substr(filetypeIndex,
                                                               editor.document.fileName.length);
                if(state.session_type.supports.indexOf(filetype) >= 0) {
                    let documentText = editor.document.getText();
                    let selection = editor.selection;
                    let isSelection = !selection.isEmpty;
                    if (isSelection) {
                        let code = editor.document.getText(selection);
                        let evalClient = nreplClient.connect({host: state.hostname, port: state.port}).once('connect', function() {
                            evalClient.evaluate(code, getNamespace(documentText), state.session, function (err, results) {
                                for(var r = 0; r < results.length; r++) {
                                    let result = results[r];
                                    console.log(JSON.stringify(result));
                                    if(result.hasOwnProperty('value')) {
                                        vscode.window.showInformationMessage("=> " + (result.value.length > 0 ? result.value : "no result.."));
                                    } else if (result.ex) {
                                        console.log("EXCEPTION!! HANDLE IT");
                                        console.log(JSON.stringify(result));
                                    } else if (result.status && result.status[0] === "done") {
                                        evalClient.end();
                                    }
                                }
                            });
                        });
                    }
                }
            }
        }
    });
    context.subscriptions.push(evaluateExpression);    
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
