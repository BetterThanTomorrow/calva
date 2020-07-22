import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as state from './state';
import { highlight } from './highlight/src/extension'

const RESULTS_DOC_NAME = 'eval-results.calva-out';
const GREETINGS = '; This is the Calva output window.\n\
; Results from your code evaluations will be printed here.\n\
; Happy coding! ♥️'

const CALVA_TMP = path.join(os.tmpdir(), 'calva');
const DOC_URI: vscode.Uri = vscode.Uri.parse(path.join(CALVA_TMP, RESULTS_DOC_NAME));

function isResultsDoc(doc: vscode.TextDocument): boolean {
    return doc && path.basename(doc.fileName) === RESULTS_DOC_NAME;
}

function getViewColumn(): vscode.ViewColumn {
    const column: vscode.ViewColumn = state.extensionContext.workspaceState.get(`outputWindowViewColumn`);
    return column ? column : vscode.ViewColumn.Two;
}

function setViewColumn(column: vscode.ViewColumn) {
    return state.extensionContext.workspaceState.update(`outputWindowViewColumn`, column);
}

function writeTextToFile(uri: vscode.Uri, text: string) {
    const ab = new ArrayBuffer(text.length);
    const ui8a = new Uint8Array(ab);
    for (var i = 0, strLen = text.length; i < strLen; i++) {
        ui8a[i] = text.charCodeAt(i);
    }
    vscode.workspace.fs.writeFile(uri, ui8a);
}

export async function openResultsDoc(init: boolean = false): Promise<vscode.TextDocument> {
    let exists: boolean = false;
    let resultsDoc: vscode.TextDocument;
    if (init) {
        try {
            const stat = await vscode.workspace.fs.stat(DOC_URI);
            exists = true;
        } catch {
            exists = false;
        } finally {
            const disableKondo = "^:replace {:linters {}}";
            const disableKondoAb = new ArrayBuffer(disableKondo.length);
            const disableKondoUi8a = new Uint8Array(disableKondoAb);
            for (var i = 0, strLen = disableKondo.length; i < strLen; i++) {
                disableKondoUi8a[i] = disableKondo.charCodeAt(i);
            }
            writeTextToFile(vscode.Uri.parse(path.join(CALVA_TMP, '.clj-kondo', 'config.edn')), "^:replace {:linters {}}")
        }
        writeTextToFile(DOC_URI, `${GREETINGS}\n`);
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

export async function appendToResultsDoc(text: string, reveal: boolean = false) {
    const doc = await vscode.workspace.openTextDocument(DOC_URI);
    if (doc) {
        const edit = new vscode.WorkspaceEdit();
        edit.insert(DOC_URI, doc.positionAt(Infinity), `${text}\n`);
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
        if (success) {
            if (visibleResultsEditor) {
                scrollToBottom(visibleResultsEditor);
                highlight(visibleResultsEditor);
            }
            return success;
        } else {
            console.log("Sad puppy")
        }
        console.log("Printed?");
    };
}


function scrollToBottom(editor: vscode.TextEditor) {
    const lastPos = editor.document.positionAt(Infinity);
    editor.selection = new vscode.Selection(lastPos, lastPos);
    editor.revealRange(new vscode.Range(lastPos, lastPos));
    console.log("Scrolled to bottom");
}
