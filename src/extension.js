const vscode = require('vscode');
const nreplClient = require('nrepl-client');
const vsclj = require('./state');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    let statusbar_type = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusbar_type.text = vsclj.session_type;
    statusbar_type.show();

    let connectToREPL = vscode.commands.registerCommand('visualclojure.connectToREPL', function () {
        vscode.window.showInputBox({
                placeHolder: "Enter existing nREPL hostname:port here...",
                prompt: "Add port to nREPL if localhost, otherwise 'hostname:port'",
                value: "localhost:",
                ignoreFocusOut: true
            })
            .then(function (nREPL) {
                    let result = nREPL.split(':');
                    let hostname = result[0];
                    let port = result[1];

                    vsclj.hostname = hostname;
                    vsclj.port = port;


                    let client = nreplClient.connect({
                        host: hostname,
                        port: port
                    }).once('connect', function () {
                        client.lsSessions(function (err, result) {
                            vsclj.connected = true;
                            vsclj.session_type = "ClojureScript Session";
                            vsclj.session_id = result[0].sessions[0];

                            console.log(vsclj);

                            statusbar_type.text = vsclj.session_type;

                            client.end();
                        })
                    });
                },

                function (err) {
                    console.error("Unable to connect to REPL!");
                    console.error(err);
                }
            );
    });

    context.subscriptions.push(connectToREPL);

    vscode.workspace.onDidSaveTextDocument(function (file) {
        console.log("SAVED!");
        console.log(file);
        
        if (vsclj.connected) {
            console.log("USING SESSION => " + vsclj.session_id);

            let client = nreplClient.connect({
                host: vsclj.hostname,
                port: vsclj.port
            }).once('connect', function () {
                var cljs_expr = '(. (js/Date.) toLocaleString)';
                client.eval(cljs_expr, "", vsclj.session_id, function (err, result) {
                    console.log("EVAL!");
                    console.log(result);
                    client.end();
                })
            });
        } else {
            console.log("NOT CONNECTED TO NREPL! PLEASE CONNECT TO EVAL..");
        }
    });
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
