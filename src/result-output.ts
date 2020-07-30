import * as path from 'path';
import * as vscode from 'vscode';
import * as state from './state';
import { highlight } from './highlight/src/extension'
import { NReplSession } from './nrepl';
import * as util from './utilities';

export const REPL_FILE_EXT = "repl-file"
const RESULTS_DOC_NAME = `output.${REPL_FILE_EXT}`;

const START_GREETINGS = '; This is the Calva evaluation results output window.\n\
; Leave it open, please. Because quirks.\n\
; The keyboard shortcut `ctrl+alt+c o` shows and focuses this window.\n\
; Please see https://calva.io/output/ for more info.\n\
; Happy coding! ♥️';

export const CLJ_CONNECT_GREETINGS = '; You can edit the contents here. Use it as a REPL if you like.\n\
;   Use `alt+enter` to evaluate the current top level form.\n\
;   (`ctrl+enter` evaluates the current form.)\n\
;   File URLs in stacktrace frames are peekable and clickable.';

export const CLJS_CONNECT_GREETINGS = '; You can choose which REPL to use (clj or cljs):\n\
;    *Calva: Toggle REPL connection*\n\
;    (There is a button in the status bar for this)';

const OUTPUT_FILE_DIR = () => path.join(state.getProjectRoot(), '.calva', 'output-window');
const DOC_URI = () => vscode.Uri.file(path.join(OUTPUT_FILE_DIR(), RESULTS_DOC_NAME));

let _sessionType = "clj";
let _sessionInfo: { [id: string]: { ns?: string, session?: NReplSession } } = {
    clj: {},
    cljs: {}
};
let _prompt: string;

export function getNs(): string {
    return _sessionInfo[_sessionType].ns;
}

export function getSessionType(): string {
    return _sessionType;
}

export function getSession(): NReplSession {
    return _sessionInfo[_sessionType].session;
}

export function setSession(session: NReplSession, newNs: string) {
    if (session) {
        if (session.replType) {
            _sessionType = session.replType;
        }
        _sessionInfo[_sessionType].session = session;
    }
    if (newNs) {
        _sessionInfo[_sessionType].ns = newNs;
    }
    _prompt = `${_sessionType}::${getNs()}=> `;
    appendToResultsDoc(_prompt);
}

export function isResultsDoc(doc: vscode.TextDocument): boolean {
    return doc && path.basename(doc.fileName) === RESULTS_DOC_NAME;
}

function getViewColumn(): vscode.ViewColumn {
    const column: vscode.ViewColumn = state.extensionContext.workspaceState.get(`outputWindowViewColumn`);
    return column ? column : vscode.ViewColumn.Two;
}

function setViewColumn(column: vscode.ViewColumn) {
    return state.extensionContext.workspaceState.update(`outputWindowViewColumn`, column);
}

function writeTextToFile(uri: vscode.Uri, text: string): Thenable<void> {
    const ab = new ArrayBuffer(text.length);
    const ui8a = new Uint8Array(ab);
    for (var i = 0, strLen = text.length; i < strLen; i++) {
        ui8a[i] = text.charCodeAt(i);
    }
    return vscode.workspace.fs.writeFile(uri, ui8a);
}

export async function initResultsDoc(): Promise<vscode.TextDocument> {
    // await state.initProjectDir();
    const kondoPath = path.join(OUTPUT_FILE_DIR(), '.clj-kondo')
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(kondoPath));
    await writeTextToFile(vscode.Uri.file(path.join(kondoPath, 'config.edn')), "^:replace {:linters {}}");

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(OUTPUT_FILE_DIR()));
    let resultsDoc: vscode.TextDocument;
    try {
        resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
    } catch (e) {
        await writeTextToFile(DOC_URI(), '');
        resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
    }
    const greetings = `${START_GREETINGS}\n\n`;
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(resultsDoc.positionAt(0), resultsDoc.positionAt(Infinity));
    edit.replace(DOC_URI(), fullRange, greetings);
    const success = await vscode.workspace.applyEdit(edit);
    resultsDoc.save();

    const resultsEditor = await vscode.window.showTextDocument(resultsDoc, getViewColumn(), true);
    const firstPos = resultsEditor.document.positionAt(0);
    const lastPos = resultsDoc.positionAt(Infinity);
    resultsEditor.selection = new vscode.Selection(lastPos, lastPos);
    resultsEditor.revealRange(new vscode.Range(firstPos, firstPos));
    // For some reason onDidChangeTextEditorViewColumn won't fire
    state.extensionContext.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(event => {
        if (isResultsDoc(event.document)) {
            setViewColumn(event.viewColumn);
        }
    }));
    return resultsDoc;
}

export async function openResultsDoc(): Promise<vscode.TextDocument> {
    const resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
    const resultsEditor = await vscode.window.showTextDocument(resultsDoc, getViewColumn(), false);
    return resultsDoc;
}

export function revealResultsDoc(preserveFocus: boolean = true) {
    openResultsDoc().then(doc => {
        vscode.window.showTextDocument(doc, getViewColumn(), preserveFocus);
    });
}

let scrollToBottomSub: vscode.Disposable;
const editQueue: string[] = [];
let applyingEdit = false;
export async function appendToResultsDoc(text: string): Promise<void> {
    if (applyingEdit) {
        editQueue.push(text);
    } else {
        applyingEdit = true;
        const doc = await vscode.workspace.openTextDocument(DOC_URI());
        const ansiStrippedText = util.stripAnsi(text);
        if (doc) {
            const edit = new vscode.WorkspaceEdit();
            const currentContent = doc.getText();
            const lastLineEmpty = currentContent.match(/\n$/);
            const appendText = `${lastLineEmpty ? '' : '\n'}${ansiStrippedText}\n`;
            edit.insert(DOC_URI(), doc.positionAt(Infinity), `${appendText}`);
            if (scrollToBottomSub) {
                scrollToBottomSub.dispose();
            }
            let visibleResultsEditors: vscode.TextEditor[] = [];
            vscode.window.visibleTextEditors.forEach(editor => {
                if (isResultsDoc(editor.document)) {
                    visibleResultsEditors.push(editor);
                }
            });
            if (visibleResultsEditors.length == 0) {
                scrollToBottomSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
                    if (isResultsDoc(editor.document)) {
                        scrollToBottom(editor);
                        scrollToBottomSub.dispose();
                    }
                });
                state.extensionContext.subscriptions.push(scrollToBottomSub);
            }

            const success = await vscode.workspace.applyEdit(edit);
            applyingEdit = false;
            doc.save();

            if (success) {
                if (visibleResultsEditors.length > 0) {
                    visibleResultsEditors.forEach(editor => {
                        scrollToBottom(editor);
                        highlight(editor);
                    });
                }
            }
        }

        if (editQueue.length > 0) {
            appendToResultsDoc(editQueue.shift());
        }
    };
}

type StackTrace = {
    stacktrace: any;
};

function makePrintableStackTrace(trace: StackTrace): string {
    const stack = [];
    for (let x of trace.stacktrace) {
        const file = x["file-url"] && x["file-url"].length ? `:file "${x["file-url"]}:${x.line}"` : `:file "${x.file}" :line ${x.line}`;
        const fn = x.fn ? ` :fn "${x.fn}" ` : '';
        const method = x.method ? ` :method "${x.method}" ` : '';
        const line = `{${file}${fn}${method}:flags [${x.flags.map((f: string) => `:${f}`).join(' ')}]}`;
        stack.push(line);
    }
    return `[${stack.join('\n ')}]`;
}

export async function printStacktrace(trace: StackTrace) {
    const text = makePrintableStackTrace(trace);
    return appendToResultsDoc(text);
}

function scrollToBottom(editor: vscode.TextEditor) {
    const lastPos = editor.document.positionAt(Infinity);
    editor.selection = new vscode.Selection(lastPos, lastPos);
    editor.revealRange(new vscode.Range(lastPos, lastPos));
}
