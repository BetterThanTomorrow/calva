import * as model from "../../../webview-src/client/model"
export { getIndent } from "../../../webview-src/client/indent"
import * as vscode from "vscode"
import * as utilities from '../../../utilities';

let documents = new Map<vscode.TextDocument, model.LineInputModel>();

let registered = false;

function processChanges(document: vscode.TextDocument, contentChanges: vscode.TextDocumentContentChangeEvent[]) {
    let model = documents.get(document)
    for(let change of contentChanges) {
        // vscode may have a \r\n marker, so it's line offsets are all wrong.
        let myStartOffset = model.getOffsetForLine(change.range.start.line)+change.range.start.character
        let myEndOffset = model.getOffsetForLine(change.range.end.line)+change.range.end.character
        model.changeRange(myStartOffset, myEndOffset, change.text.replace(/\r\n/g, '\n'))
    }
    model.flushChanges()

    // we must clear out the repaint cache data, since we don't use it.
    model.dirtyLines = []
    model.insertedLines.clear()
    model.deletedLines.clear();

    // FIXME:
    //    this is an important diagnostic check to ensure the models haven't de-synced, but it MUST be removed before release.

    let mtext = model.getText(0, model.maxOffset)
    let dtext = document.getText().replace(/\r\n/g,"\n");
    if(mtext != dtext) {
        vscode.window.showErrorMessage("document hozed")
        console.error(mtext)
        console.error("vs")
        console.error(dtext)
    }
}

export function getDocument(doc: vscode.TextDocument) {
    return documents.get(doc)
}

export function getDocumentOffset(doc: vscode.TextDocument, position: vscode.Position) {
    let model = getDocument(doc);
    return model.getOffsetForLine(position.line)+position.character;
}

function addDocument(doc): boolean {
    if (doc && doc.languageId == "clojure") {
        if (!documents.has(doc)) {
            let mdl = new model.LineInputModel();
            mdl.insertString(0, doc.getText())
            documents.set(doc, mdl);
            return false;
        } else {
            return true;
        }
    }
    return false;
}

export function activate() {
    // the last thing we want is to register twice and receive double events...
    if(registered)
        return;
    registered = true;
    
    addDocument(utilities.getDocument({}));

    vscode.workspace.onDidCloseTextDocument(e => {
        if(e.languageId == "clojure") {
            documents.delete(e);
        }
    })
    
    vscode.window.onDidChangeActiveTextEditor(e => {
        if(e && e.document && e.document.languageId == "clojure") {
            addDocument(e.document);
        }
    });
    
    vscode.workspace.onDidOpenTextDocument(doc => {
        addDocument(doc);
    });

    vscode.workspace.onDidChangeTextDocument(e => {
        if (addDocument(e.document)) {
            processChanges(e.document, e.contentChanges)
        }
    });
}
