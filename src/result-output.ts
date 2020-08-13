import * as path from 'path';
import * as vscode from 'vscode';
import * as state from './state';
import { highlight } from './highlight/src/extension'
import { NReplSession } from './nrepl';
import * as util from './utilities';
import select from './select';
import { formatCode } from './calva-fmt/src/format';
import * as namespace from './namespace';
import config from './config';
import type { ReplSessionType } from './config';
import * as replHistory from './repl-history';

const RESULTS_DOC_NAME = `output.${config.REPL_FILE_EXT}`;

const START_GREETINGS = '; This is the Calva evaluation results output window.\n\
; Leave it open, please. Because quirks.\n\
; TIPS: The keyboard shortcut `ctrl+alt+c o` shows and focuses this window\n\
;   when connected to a REPL session.\n\
; Please see https://calva.io/output/ for more info.\n\
; Happy coding! ♥️';

export const CLJ_CONNECT_GREETINGS = '; TIPS: \n\
;   - You can edit the contents here. Use it as a REPL if you like.\n\
;   - `alt+enter` evaluates the current top level form.\n\
;   - `ctrl+enter` evaluates the current form.\n\
;   - `alt+up` and `alt+down` traverse up and down the REPL command history.\n\
;   - File URLs in stacktrace frames are peekable and clickable.';

export const CLJS_CONNECT_GREETINGS = '; TIPS: You can choose which REPL to use (clj or cljs):\n\
;    *Calva: Toggle REPL connection*\n\
;    (There is a button in the status bar for this)';

const OUTPUT_FILE_DIR = () => path.join(state.getProjectRoot(), '.calva', 'output-window');
const DOC_URI = () => vscode.Uri.file(path.join(OUTPUT_FILE_DIR(), RESULTS_DOC_NAME));

let _sessionType: ReplSessionType = "clj";
let _sessionInfo: { [id: string]: { ns?: string, session?: NReplSession } } = {
    clj: {},
    cljs: {}
};
let _prompt: string;

export function getPrompt(): string {
    return _prompt;
}

export function getNs(): string {
    return _sessionInfo[_sessionType].ns;
}

export function getSessionType(): ReplSessionType {
    return _sessionType;
}

export function getSession(): NReplSession {
    return _sessionInfo[_sessionType].session;
}

export function setSession(session: NReplSession, newNs: string, onPromptAdded: OnResultAppendedCallback = null): void {
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
    append(_prompt, onPromptAdded);
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

function setContextForOutputWindowActive(isActive: boolean): void {
    vscode.commands.executeCommand("setContext", "calva:outputWindowActive", isActive);
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
        const isOutputWindow = isResultsDoc(event.document);
        setContextForOutputWindowActive(isOutputWindow);
        if (isOutputWindow) {
            setViewColumn(event.viewColumn);
        }
    }));
    // If the output window is active when initResultsDoc is run, these contexts won't be set properly without the below
    // until the next time it's focused
    if (isResultsDoc(vscode.window.activeTextEditor.document)) {
        setContextForOutputWindowActive(true);
        replHistory.setReplHistoryCommandsActiveContext(vscode.window.activeTextEditor);
    }
    replHistory.resetState();
    return resultsDoc;
}

export async function openResultsDoc(): Promise<vscode.TextDocument> {
    const resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
    return resultsDoc;
}

export function revealResultsDoc(preserveFocus: boolean = true) {
    openResultsDoc().then(doc => {
        vscode.window.showTextDocument(doc, getViewColumn(), preserveFocus);
    });
}

export async function setNamespaceFromCurrentFile() {
    const session = namespace.getSession();
    const ns = namespace.getNamespace(util.getDocument({}));
    if (getNs() !== ns) {
        await session.eval("(in-ns '" + ns + ")", session.client.ns).value;
    }
    setSession(session, ns, _ => {
        revealResultsDoc(false);
        namespace.updateREPLSessionType();
    });
}

async function appendFormGrabbingSessionAndNS(topLevel: boolean) {
    const session = namespace.getSession();
    const ns = namespace.getNamespace(util.getDocument({}));
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const selection = editor.selection;
    let code = "";
    if (selection.isEmpty) {
        const formSelection = select.getFormSelection(doc, selection.active, topLevel);
        code = formatCode(doc.getText(formSelection), doc.eol);
    } else {
        code = formatCode(doc.getText(selection), doc.eol);
    }
    if (code != "") {
        if (getNs() !== ns) {
            await session.eval("(in-ns '" + ns + ")", session.client.ns).value;
        }
        setSession(session, ns, _ => {
            namespace.updateREPLSessionType();
            append(code, _ => {
                revealResultsDoc(false);
            });
        });
    }
}

export function appendCurrentForm() {
    appendFormGrabbingSessionAndNS(false);
}

export function appendCurrentTopLevelForm() {
    appendFormGrabbingSessionAndNS(true);
}

let scrollToBottomSub: vscode.Disposable;
interface OnResultAppendedCallback {
    (insertLocation: vscode.Location): any
}
const editQueue: [string, OnResultAppendedCallback][] = [];
let applyingEdit = false;
/* Because this function can be called several times asynchronously by the handling of incoming nrepl messages and those,
   we should never await it, because that await could possibly not return until way later, after edits that came in from elsewhere 
   are also applied, causing it to wait for several edits after the one awaited. This is due to the recursion and edit queue, which help
   apply edits one after another without issues.
   
   If something must be done after a particular edit, use the onResultAppended callback. */
export function append(text: string, onResultAppended?: OnResultAppendedCallback): void {
    let insertPosition: vscode.Position;
    if (applyingEdit) {
        editQueue.push([text, onResultAppended]);
    } else {
        applyingEdit = true;
        vscode.workspace.openTextDocument(DOC_URI()).then(doc => {
            const ansiStrippedText = util.stripAnsi(text);
            if (doc) {
                const edit = new vscode.WorkspaceEdit();
                const currentContent = doc.getText();
                const lastLineEmpty = currentContent.match(/\n$/) || currentContent === '';
                const appendText = `${lastLineEmpty ? '' : '\n'}${ansiStrippedText}\n`;
                insertPosition = doc.positionAt(Infinity);
                edit.insert(DOC_URI(), insertPosition, `${appendText}`);
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
                            util.scrollToBottom(editor);
                            scrollToBottomSub.dispose();
                        }
                    });
                    state.extensionContext.subscriptions.push(scrollToBottomSub);
                }

                vscode.workspace.applyEdit(edit).then(success => {
                    applyingEdit = false;
                    doc.save();

                    if (success) {
                        if (visibleResultsEditors.length > 0) {
                            visibleResultsEditors.forEach(editor => {
                                util.scrollToBottom(editor);
                                highlight(editor);
                            });
                        }
                    }

                    if (onResultAppended) {
                        onResultAppended(new vscode.Location(DOC_URI(), insertPosition));
                    }

                    if (editQueue.length > 0) {
                        return append.apply(null, editQueue.shift());
                    }
                });
            }
        });
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

export function printStacktrace(trace: StackTrace): void {
    const text = makePrintableStackTrace(trace);
    append(text);
}

export {
    OnResultAppendedCallback,
};
