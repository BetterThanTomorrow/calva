const vscode = require('vscode');
const SESSION_TYPE = require('./nrepl/session_type');

module.exports = {
    hostname : null,
    port: null,
    session : {},
    session_type: SESSION_TYPE.NONE,
    connected: false,
    
    statusbar_connection: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left),
    statusbar_type: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left),
    outputChannel: vscode.window.createOutputChannel("VisualClojure"),
    diagnosticCollection: vscode.languages.createDiagnosticCollection('VisualClojure: Evaluation errors'),
    CLOJURE_MODE: { language: 'clojure', scheme: 'file'}
};
