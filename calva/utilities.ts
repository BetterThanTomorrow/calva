import * as vscode from 'vscode';
const specialWords = ['-', '+', '/', '*']; //TODO: Add more here
import * as _ from 'lodash';
import * as state from './state';
import * as fs from 'fs';
import { NReplSession } from './nrepl';
const syntaxQuoteSymbol = "`";

export function stripAnsi(str: string) {
    return str.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g, "")
}

async function quickPickSingle(opts: { values: string[], saveAs?: string, placeHolder: string, autoSelect?: boolean }) {
    if(opts.values.length == 0)
        return;
    let selected: string;
    if(opts.saveAs)
        selected = state.extensionContext.workspaceState.get(opts.saveAs);

    let result;
    if(opts.autoSelect && opts.values.length == 1)
        result = opts.values[0];
    else
        result = await quickPick(opts.values, selected ? [selected] : [], [], {placeHolder: opts.placeHolder, ignoreFocusOut: true})
    state.extensionContext.workspaceState.update(opts.saveAs, result);
    return result;
}

async function quickPickMulti(opts: { values: string[], saveAs?: string, placeHolder: string }) {
    let selected: string[];
    if(opts.saveAs)
        selected = state.extensionContext.workspaceState.get(opts.saveAs) || [];
    let result = await quickPick(opts.values, [], selected, {placeHolder: opts.placeHolder, canPickMany: true, ignoreFocusOut: true})
    state.extensionContext.workspaceState.update(opts.saveAs, result);
    return result;
}

function quickPick(itemsToPick: string[], active: string[], selected: string[], options: vscode.QuickPickOptions & { canPickMany: true}): Promise<string[]>;
function quickPick(itemsToPick: string[], active: string[], selected: string[], options: vscode.QuickPickOptions): Promise<string>;

async function quickPick(itemsToPick: string[], active: string[], selected: string[], options: vscode.QuickPickOptions): Promise<string | string[]> {
    let items = itemsToPick.map(x => ({ label: x }));

    let qp = vscode.window.createQuickPick();
    qp.canSelectMany = options.canPickMany;
    qp.placeholder = options.placeHolder;
    qp.ignoreFocusOut = options.ignoreFocusOut;
    qp.matchOnDescription = options.matchOnDescription
    qp.matchOnDetail = options.matchOnDetail
    qp.items = items;
    qp.activeItems = items.filter(x => active.indexOf(x.label) != -1);
    qp.selectedItems = items.filter(x => selected.indexOf(x.label) != -1);
    return new Promise<string[] | string>((resolve, reject) => {
        qp.show();
        qp.onDidAccept(() => {
            if(qp.canSelectMany)
                resolve(qp.selectedItems.map(x => x.label))
            else if(qp.selectedItems.length)
                resolve(qp.selectedItems[0].label)
            else
                resolve(undefined);
                qp.hide();
            })
        qp.onDidHide(() => {
            resolve([]);
            qp.hide();
        })
    })
}

function getProjectDir() {
    let path = vscode.workspace.rootPath + "/" + state.config().projectRootDirectory;

    if (fs.existsSync(path)) {
        return path;
    } else {
        return vscode.workspace.rootPath;
    }
}

function getCljsReplStartCode() {
    return vscode.workspace.getConfiguration('calva').startCLJSREPLCommand;
}

function getShadowCljsReplStartCode(build) {
    return '(shadow.cljs.devtools.api/nrepl-select ' + build + ')';
}

function getNamespace(text) {
    let match = text.match(/^[\s\t]*(?:;.*\s)*[\s\t]*\((?:[\s\t\n]*(?:in-){0,1}ns)[\s\t\n]+'?([\w.\-\/]+)[\s\S]*\)[\s\S]*/);
    return match ? match[1] : 'user';
}

function getStartExpression(text) {
    let match = text.match(/^\(([^\)]+)[\)]+/g);
    return match ? match[0] : "(ns user)";
}

function getActualWord(document, position, selected, word) {
    if (selected === undefined) {
        let selectedChar = document.lineAt(position.line).text.slice(position.character, position.character + 1),
            isFn = document.lineAt(position.line).text.slice(position.character - 1, position.character) === "(";
        if (selectedChar !== undefined &&
            specialWords.indexOf(selectedChar) !== -1 &&
            isFn) {
            return selectedChar;
        } else {
            return "";
        }
    } else {
        return (word && word.startsWith(syntaxQuoteSymbol)) ? word.substr(1) : word;
    }
}

function getWordAtPosition(document, position) {
    let selected = document.getWordRangeAtPosition(position), selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "", text = getActualWord(document, position, selected, selectedText);
    return text;
}

function getDocument(document) {
    if (document && document.hasOwnProperty('fileName')) {
        return document;
    } else if (vscode.window.activeTextEditor) {
        return vscode.window.activeTextEditor.document;
    } else if (vscode.window.visibleTextEditors.length > 0) {
        return vscode.window.visibleTextEditors[0].document;
    } else {
        return null;
    }
}

function getFileType(document) {
    let doc = getDocument(document);

    if (doc) {
        return doc.fileName.substr((doc.fileName.lastIndexOf('.') + 1), doc.fileName.length);
    }
    else {
        return 'clj';
    }
}

function getFileName(document) {
    let fileNameIndex = (document.fileName.lastIndexOf('\\') + 1);
    return document.fileName.substr(fileNameIndex, document.fileName.length)
}

function getDocumentNamespace(document = {}) {
    let doc = getDocument(document);

    return getNamespace(doc.getText());
}

function getSession(fileType = undefined): NReplSession {
    let doc = getDocument({}),
        current = state.deref();

    if (fileType === undefined) {
        fileType = getFileType(doc);
    }
    if (fileType.match(/^clj[sc]?/)) {
        return current.get(fileType);
    } else {
        return current.get('clj');
    }
}

// ERROR HELPERS
const ERROR_TYPE = {
    WARNING: "warning",
    ERROR: "error"
};

function logSuccess(results) {
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
}

function logError(error) {
    let chan = state.deref().get('outputChannel');

    chan.appendLine(error.reason);
    if (error.line !== undefined && error.line !== null &&
        error.column !== undefined && error.column !== null) {
        chan.appendLine("at line: " + error.line + " and column: " + error.column)
    }
}

function markError(error) {
    if (error.line === null) {
        error.line = 0;
    }
    if (error.column === null) {
        error.column = 0;
    }

    let diagnostic = state.deref().get('diagnosticCollection'),
        editor = vscode.window.activeTextEditor;

    //editor.selection = new vscode.Selection(position, position);
    let line = error.line - 1,
        column = error.column,
        lineLength = editor.document.lineAt(line).text.length,
        lineText = editor.document.lineAt(line).text.substring(column, lineLength),
        firstWordStart = column + lineText.indexOf(" "),
        existing = diagnostic.get(editor.document.uri),
        err = new vscode.Diagnostic(new vscode.Range(line, column, line, firstWordStart),
            error.reason,
            vscode.DiagnosticSeverity.Error);

    let errors = (existing !== undefined && existing.length > 0) ? [...existing, err] :
        [err];
    diagnostic.set(editor.document.uri, errors);
}

function logWarning(warning) {
    let chan = state.deref().get('outputChannel');
    chan.appendLine(warning.reason);
    if (warning.line !== null) {
        if (warning.column !== null) {
            chan.appendLine("at line: " + warning.line + " and column: " + warning.column)
        } else {
            chan.appendLine("at line: " + warning.line)
        }
    }
}

function markWarning(warning) {
    if (warning.line === null) {
        warning.line = 0;
    }
    if (warning.column === null) {
        warning.column = 0;
    }

    let diagnostic = state.deref().get('diagnosticCollection'),
        editor = vscode.window.activeTextEditor;

    //editor.selection = new vscode.Selection(position, position);
    let line = Math.max(0, (warning.line - 1)),
        column = warning.column,
        lineLength = editor.document.lineAt(line).text.length,
        existing = diagnostic.get(editor.document.uri),
        warn = new vscode.Diagnostic(new vscode.Range(line, column, line, lineLength),
            warning.reason,
            vscode.DiagnosticSeverity.Warning);

    let warnings = (existing !== undefined && existing.length > 0) ? [...existing, warn] :
        [warn];
    diagnostic.set(editor.document.uri, warnings);
}


function updateREPLSessionType() {
    let current = state.deref(),
        doc = getDocument({}),
        fileType = getFileType(doc);

    if (current.get('connected')) {
        if (fileType == 'cljs' && getSession('cljs') !== null) {
            state.cursor.set('current-session-type', 'cljs');
        } else if (fileType == 'clj' && getSession('clj') !== null) {
            state.cursor.set('current-session-type', 'clj');
        } else if (fileType == 'cljc' && getSession('cljc') !== null) {
            state.cursor.set('current-session-type', getSession('cljc') == getSession('clj') ? 'clj' : 'cljs');
        } else {
            state.cursor.set('current-session-type', 'clj');
        }
    } else {
        state.cursor.set('current-session-type', null);
    }
}

function getREPLSessionType() {
    let current = state.deref();
    return current.get('current-session-type');
}

export {
    getProjectDir,
    getNamespace,
    getStartExpression,
    getWordAtPosition,
    getDocument,
    getDocumentNamespace,
    getFileType,
    getFileName,
    getSession,
    specialWords,
    ERROR_TYPE,
    logError,
    markError,
    logWarning,
    markWarning,
    logSuccess,
    updateREPLSessionType,
    getREPLSessionType,
    getCljsReplStartCode,
    getShadowCljsReplStartCode,
    quickPick,
    quickPickSingle,
    quickPickMulti
};