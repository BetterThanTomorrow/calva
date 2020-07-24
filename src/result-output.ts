import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as state from './state';
import { highlight } from './highlight/src/extension'
import { NReplSession } from './nrepl';

export const REPL_FILE_EXT = "repl-file"
const RESULTS_DOC_NAME = `eval-results.${REPL_FILE_EXT}`;

const TIPS = [';The keyboard shortcut `ctrl+alt+c o` shows and focuses this window.',
    ';You can edit the contents here. Use it as a REPL if you like.\n\
;  Use `alt+enter` to evaluate the current top level form.\n\
;  (`ctrl+enter` evaluates the current form.)',
    ';File URLs in stacktrace frames are peekable and clickable.',
    ';In ClojureScript projects, use the command *Calva: Toggle REPL connection* to choose which REPL to use (clj or cljs).'];

const GREETINGS = [';This is the Calva output window. Results from your code evaluations will be printed here.',
    ';https://calva.io is your place for Calva documentation. Happy coding!'];

const CALVA_TMP = path.join(os.tmpdir(), 'calva');
const DOC_URI: vscode.Uri = vscode.Uri.parse(path.join(CALVA_TMP, RESULTS_DOC_NAME));

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
    _prompt = `${_sessionType}=${getNs()}=>`;
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

export async function openResultsDoc(init: boolean = false): Promise<vscode.TextDocument> {
    let resultsDoc: vscode.TextDocument;
    if (init) {
        writeTextToFile(vscode.Uri.parse(path.join(CALVA_TMP, '.clj-kondo', 'config.edn')), "^:replace {:linters {}}")
        const greetings = `${GREETINGS[0]}\n${TIPS[Math.floor(Math.random() * TIPS.length)]}\n${GREETINGS[1]}\n`;
        await writeTextToFile(DOC_URI, greetings);
    }
    await vscode.workspace.openTextDocument(DOC_URI).then(async doc => {
        resultsDoc = doc;
        vscode.window.showTextDocument(doc, getViewColumn(), true);
        if (init) {
            vscode.window.visibleTextEditors.forEach(editor => {
                if (isResultsDoc(editor.document)) {
                    const firstPos = editor.document.positionAt(0);
                    editor.revealRange(new vscode.Range(firstPos, firstPos));
                }
            });
            // For some reason onDidChangeTextEditorViewColumn won't fire
            state.extensionContext.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(event => {
                if (isResultsDoc(event.document)) {
                    setViewColumn(event.viewColumn);
                }
            }));
        }
    });
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
        const doc = await vscode.workspace.openTextDocument(DOC_URI);
        if (doc) {
            const edit = new vscode.WorkspaceEdit();
            const currentContent = doc.getText();
            const lastLineEmpty = currentContent.match(/\n$/);
            const appendText = `${lastLineEmpty ? '' : '\n'}${text}\n`;
            edit.insert(DOC_URI, doc.positionAt(Infinity), `${appendText}`);
            if (scrollToBottomSub) {
                scrollToBottomSub.dispose();
            }
            let visibleResultsEditor: vscode.TextEditor;
            vscode.window.visibleTextEditors.forEach(editor => {
                if (isResultsDoc(editor.document)) {
                    visibleResultsEditor = editor;
                }
            });
            if (!visibleResultsEditor) {
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

            if (success) {
                if (visibleResultsEditor) {
                    scrollToBottom(visibleResultsEditor);
                    highlight(visibleResultsEditor);
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

export function printStacktrace(trace: StackTrace) {
    const text = makePrintableStackTrace(trace);
    appendToResultsDoc(text);
}

function scrollToBottom(editor: vscode.TextEditor) {
    const lastPos = editor.document.positionAt(Infinity);
    editor.selection = new vscode.Selection(lastPos, lastPos);
    editor.revealRange(new vscode.Range(lastPos, lastPos));
}
