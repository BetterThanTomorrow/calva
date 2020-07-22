import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as state from './state';
import { highlight } from './highlight/src/extension'

const RESULTS_DOC_NAME = 'eval-results.calva-out';
const GREETINGS = '; This is the Calva output window.\n\
; Results from your code evaluations will be printed here.\n\
; Happy coding! ♥️'

function getResultsUri(untitled: boolean): vscode.Uri {
    return vscode.Uri.parse((untitled ? 'untitled:' : '') + path.join(os.tmpdir(), RESULTS_DOC_NAME));
}

export async function openResultsDoc(clear: boolean = false): Promise<vscode.TextDocument> {
    let exists: boolean = false;
    let resultsDoc: vscode.TextDocument;
    try {
        const stat = await vscode.workspace.fs.stat(getResultsUri(false));
        exists = true;
    } catch {
        exists = false;
    }
    await vscode.workspace.openTextDocument(getResultsUri(!exists)).then(async doc => {
        resultsDoc = doc;
        if (clear) {
            var edit = new vscode.WorkspaceEdit();
            edit.replace(getResultsUri(false), new vscode.Range(
                new vscode.Position(0, 0),
                doc.positionAt(doc.getText().length)
            ), `${GREETINGS}\n`);
            const success = await vscode.workspace.applyEdit(edit);
            if (!success) {
                state.deref().outputChannel().appendLine('Error clearing output document.')
            }
        }
        vscode.window.showTextDocument(doc, 1, true);
    });
    return resultsDoc;
}

export function revealResultsDoc() {
    openResultsDoc().then(doc => {
        vscode.window.showTextDocument(doc);
    });
}

let scrollToBottomSub: vscode.Disposable;

export async function appendToResultsDoc(text: string, reveal: boolean = false) {
    const doc = await vscode.workspace.openTextDocument(getResultsUri(false));
    if (doc) {
        const edit = new vscode.WorkspaceEdit();
        edit.insert(getResultsUri(false), doc.positionAt(Infinity), `${text}\n`);
        if (scrollToBottomSub) {
            scrollToBottomSub.dispose();
        }
        let visibleResultsEditor: vscode.TextEditor;
        vscode.window.visibleTextEditors.forEach(editor => {
            if (path.basename(editor.document.fileName) === RESULTS_DOC_NAME) {
                visibleResultsEditor = editor;
            }
        });
        if (!visibleResultsEditor) {
            scrollToBottomSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (path.basename(editor.document.fileName) === RESULTS_DOC_NAME) {
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
