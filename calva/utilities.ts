import * as vscode from 'vscode';
const specialWords = ['-', '+', '/', '*']; //TODO: Add more here
import * as _ from 'lodash';
import * as state from './state';
import * as fs from 'fs';
import * as path from 'path';
import { NReplSession } from './nrepl';
import { activeReplWindow } from './repl-window';
const syntaxQuoteSymbol = "`";
const { parseForms } = require('../cljs-out/cljs-lib');
import * as docMirror from './calva-fmt/ts/docmirror';
import { TokenCursor, LispTokenCursor } from '@calva/repl-interactor/js/token-cursor';
import { Token } from '@calva/repl-interactor/js/clojure-lexer';
import select from './select';


export function stripAnsi(str: string) {
    return str.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g, "")
}

async function quickPickSingle(opts: { values: string[], saveAs?: string, placeHolder: string, autoSelect?: boolean }) {
    if (opts.values.length == 0)
        return;
    let selected: string;
    let saveAs: string = opts.saveAs ? `qps-${opts.saveAs}` : null;
    if (saveAs) {
        selected = state.extensionContext.workspaceState.get(saveAs);
    }

    let result;
    if (opts.autoSelect && opts.values.length == 1)
        result = opts.values[0];
    else
        result = await quickPick(opts.values, selected ? [selected] : [], [], { placeHolder: opts.placeHolder, ignoreFocusOut: true })
    state.extensionContext.workspaceState.update(saveAs, result);
    return result;
}

async function quickPickMulti(opts: { values: string[], saveAs?: string, placeHolder: string }) {
    let selected: string[];
    let saveAs: string = opts.saveAs ? `qps-${opts.saveAs}` : null;
    if (saveAs) {
        selected = state.extensionContext.workspaceState.get(saveAs) || [];
    }
    let result = await quickPick(opts.values, [], selected, { placeHolder: opts.placeHolder, canPickMany: true, ignoreFocusOut: true })
    state.extensionContext.workspaceState.update(saveAs, result);
    return result;
}

function quickPick(itemsToPick: string[], active: string[], selected: string[], options: vscode.QuickPickOptions & { canPickMany: true }): Promise<string[]>;
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
            if (qp.canSelectMany)
                resolve(qp.selectedItems.map(x => x.label))
            else if (qp.selectedItems.length)
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

function getCljsReplStartCode() {
    return vscode.workspace.getConfiguration('calva').startCLJSREPLCommand;
}

function getShadowCljsReplStartCode(build) {
    return '(shadow.cljs.devtools.api/nrepl-select ' + build + ')';
}

function getNamespace(doc: vscode.TextDocument) {
    let ns = "user";
    if (doc && doc.fileName.match(/\.clj[cs]?$/)) {
        try {
            const cursor: LispTokenCursor = docMirror.getDocument(doc).getTokenCursor(0);
            cursor.forwardWhitespace(true);
            let token: Token = null,
                foundNsToken: boolean = false,
                foundNsId: boolean = false;
            do {
                cursor.downList();
                if (token && token.offset == cursor.getToken().offset) {
                    cursor.next();
                }
                token = cursor.getToken();
                foundNsToken = token.type == "id" && token.raw == "ns";
            } while (!foundNsToken && !cursor.atEnd());
            if (foundNsToken) {
                do {
                    cursor.next();
                    token = cursor.getToken();
                    foundNsId = token.type == "id";
                } while (!foundNsId && !cursor.atEnd());
                if (foundNsId) {
                    ns = token.raw;
                } else {
                    console.log("Error getting the ns name from the ns form.");
                }
            } else {
                console.log("No ns form found.");
            }
        } catch (e) {
            console.log("Error getting ns form of this file using docMirror, trying with cljs.reader: " + e);
            try {
                const forms = parseForms(doc.getText());
                if (forms !== undefined) {
                    const nsFormArray = forms.filter(x => x[0] == "ns");
                    if (nsFormArray != undefined && nsFormArray.length > 0) {
                        const nsForm = nsFormArray[0].filter(x => typeof (x) == "string");
                        if (nsForm != undefined) {
                            ns = nsForm[1];
                        }
                    }
                }
            } catch (e) {
                console.log("Error parsing ns form of this file. " + e);
            }
        }
    }
    return ns;
}

function getTestUnderCursor() {
    const doc = getDocument(null);
    if (doc) {
        try {
            const topLevelFormRange = select.getFormSelection(doc, vscode.window.activeTextEditor.selection.active, true),
                topLevelForm = doc.getText(topLevelFormRange);
            const forms = parseForms(topLevelForm);
            if (forms !== undefined) {
                const formArray = forms.filter(x => x[0].startsWith("def"));
                if (formArray != undefined && formArray.length > 0) {
                    const form = formArray[0].filter(x => typeof (x) == "string");
                    if (form != undefined) {
                        return form[1];
                    }
                }
            }
        } catch (e) {
            console.log("Error parsing deftest form under cursor." + e);
        }
    }
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
    let selected = document.getWordRangeAtPosition(position),
        selectedText = selected !== undefined ? document.getText(new vscode.Range(selected.start, selected.end)) : "", 
        text = getActualWord(document, position, selected, selectedText);
    return text;
}

function getDocument(document): vscode.TextDocument {
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

    return getNamespace(doc);
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
    let chan = state.outputChannel();
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
    let chan = state.outputChannel();

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
    let chan = state.outputChannel();
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
        let sessionType: string;

        let repl = activeReplWindow();
        if (repl)
            sessionType = repl.type;
        else if (fileType == 'cljs' && getSession('cljs') !== null)
            sessionType = 'cljs'
        else if (fileType == 'clj' && getSession('clj') !== null)
            sessionType = 'clj'
        else if (fileType == 'cljc' && getSession('cljc') !== null)
            sessionType = getSession('cljc') == getSession('clj') ? 'clj' : 'cljs';
        else
            sessionType = 'clj'

        state.cursor.set('current-session-type', sessionType);
    } else {
        state.cursor.set('current-session-type', null);
    }
}

function getREPLSessionType() {
    let current = state.deref();
    return current.get('current-session-type');
}

export {
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
    quickPickMulti,
    getTestUnderCursor,
};