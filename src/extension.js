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
    statusbar_type.text = state.session_type;
    switch (state.session_type) {
        case SESSION_TYPE.CLJ:
            statusbar_type.color = "rgb(88,129,216)";
            break;
        case SESSION_TYPE.CLJS:
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
                if(results[0].hasOwnProperty('value') && results[0].value === "3.14") {
                    state.session = sessions[current];
                    state.session_type = SESSION_TYPE.CLJS;
                }
                tmpClient.end();
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
            } else {
                findSession(state, (current - 1), sessions);
            }
            //Update statusbar accordingly
            updateStatusbar(state);
        });
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
                    state.connection = nreplClient.connect({host : state.hostname, port: state.port}).once('connect', function() {
                        state.connection.lsSessions(function (err, results) {
                            findSession(state, 0, results[0].sessions);
                        });
                    });
            });
    });
    context.subscriptions.push(connectToREPL);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
