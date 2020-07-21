import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as state from './state';

const RESULTS_DOC_NAME = 'eval-results.calva-out';

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
            edit.delete(getResultsUri(false), new vscode.Range(
                new vscode.Position(0, 0),
                doc.positionAt(doc.getText().length)
            ));
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

export function appendToResultsDoc(text: string, reveal: boolean = false) {
    const edit = new vscode.WorkspaceEdit();
    vscode.workspace.openTextDocument(getResultsUri(false)).then(doc => {
        edit.insert(getResultsUri(false), doc.positionAt(Infinity), `${text}\n`);
        if (scrollToBottomSub) {
            scrollToBottomSub.dispose();
        }
        scrollToBottomSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (path.basename(editor.document.fileName) === RESULTS_DOC_NAME) {
                const lastPos = editor.document.positionAt(Infinity);
                editor.selection = new vscode.Selection(lastPos, lastPos);
                editor.revealRange(new vscode.Range(lastPos, lastPos));
                console.log("Scrolled to bottom")
                scrollToBottomSub.dispose();
            }
        });
        state.extensionContext.subscriptions.push(scrollToBottomSub);
        vscode.workspace.applyEdit(edit).then(
            success => {
                if (!success) {
                    console.log("Sad puppy")
                }
            },
            reason => {
                console.error(`Error appending output to: ${getResultsUri(false).path}`);
                console.error(reason)
            }
        );
    })
}

// function createFileWithContent(filename, content) {
//     var newFile = vscode.Uri.parse('untitled:' + path.join(os.homedir(), filename));
//     vscode.workspace.openTextDocument(newFile).then(function (document) {
//         var edit = new vscode.WorkspaceEdit();
//         edit.delete(newFile, new vscode.Range(
//             document.positionAt(0),
//             document.positionAt(document.getText().length - 1)
//         ));
//         return vscode.workspace.applyEdit(edit).then(function (success) {
//             var edit = new vscode.WorkspaceEdit();
//             edit.insert(newFile, new vscode.Position(0, 0), content);
//             return vscode.workspace.applyEdit(edit).then(function (success) {
//                 if (success) {
//                     vscode.window.showTextDocument(document);
//                 }
//             });
//         });
//     });
// }
