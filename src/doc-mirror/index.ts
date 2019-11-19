export { getIndent } from "../cursor-doc/indent"
import * as vscode from "vscode"
import * as utilities from '../utilities';
import * as formatter from '../calva-fmt/src/format';
import { LispTokenCursor } from "../cursor-doc/token-cursor";
import { ModelEdit, EditableDocument, EditableModel, LineInputModel } from "../cursor-doc/model";

let documents = new Map<vscode.TextDocument, MirroredDocument>();

export class DocumentModel implements EditableModel {
    constructor(private document: vscode.TextDocument) { }

    lineInputModel = new LineInputModel(this.document.eol == vscode.EndOfLine.CRLF ? 2 : 1);

    edit(modelEdits: ModelEdit[], undoStopBefore = true): Thenable<void> {
        const editor = vscode.window.activeTextEditor;
        return editor.edit(builder => {
            for (const modelEdit of modelEdits) {
                switch (modelEdit.editFn) {
                    case 'insertString':
                        this.insertEdit.apply(this, [builder, ...modelEdit.args]);
                        break;
                    case 'changeRange':
                        this.replaceEdit.apply(this, [builder, ...modelEdit.args]);
                        break;
                    case 'deleteRange':
                        this.deleteEdit.apply(this, [builder, ...modelEdit.args]);
                        break;
                    default:
                        break;
                }
            }
        }, { undoStopBefore: undoStopBefore, undoStopAfter: false }).then(isFulfilled => {
            if (isFulfilled) {
                formatter.formatPosition(editor);
            }
        });
    }

    private insertEdit(builder: vscode.TextEditorEdit, offset: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document;
        builder.insert(document.positionAt(offset), text);
    }

    private replaceEdit(builder: vscode.TextEditorEdit, start: number, end: number, text: string, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(start), document.positionAt(end));
        builder.replace(range, text);

    }

    private deleteEdit(builder: vscode.TextEditorEdit, offset: number, count: number, oldSelection?: [number, number], newSelection?: [number, number]) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            range = new vscode.Range(document.positionAt(offset), document.positionAt(offset + count));
        builder.delete(range);
    }

    getText(start: number, end: number, mustBeWithin = false) {
        return this.lineInputModel.getText(start, end, mustBeWithin);
    }

    getOffsetForLine(line: number) {
        return this.lineInputModel.getOffsetForLine(line);
    }

    public getTokenCursor(offset: number, previous: boolean = false) {
        return this.lineInputModel.getTokenCursor(offset, previous);
    }
}
class MirroredDocument implements EditableDocument {
    constructor(private document: vscode.TextDocument) { }

    get selectionStart(): number {
        return this.document.offsetAt(vscode.window.activeTextEditor.selection.start);
    }

    set selectionStart(offset: number) {
        const editor = vscode.window.activeTextEditor,
            docEnd = this.document.offsetAt(editor.selection.end),
            position = this.document.positionAt(offset);
        editor.selection = new vscode.Selection(position, docEnd >= offset ? editor.selection.end : position);
    }

    get selectionEnd(): number {
        return this.document.offsetAt(vscode.window.activeTextEditor.selection.end);
    }

    set selectionEnd(offset: number) {
        const editor = vscode.window.activeTextEditor,
            docStart = this.document.offsetAt(editor.selection.start),
            position = this.document.positionAt(offset);
        editor.selection = new vscode.Selection(docStart <= offset ? editor.selection.start : position, position);
    }

    model = new DocumentModel(this.document);

    growSelectionStack: [number, number][] = [];

    public getTokenCursor(offset: number = this.selectionEnd, previous: boolean = false): LispTokenCursor {
        return this.model.getTokenCursor(offset, previous);
    }

    public insertString(text: string) {
        const editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            wsEdit = new vscode.WorkspaceEdit(),
            edit = vscode.TextEdit.insert(this.document.positionAt(this.selectionStart), text);
        wsEdit.set(this.document.uri, [edit]);
        vscode.workspace.applyEdit(wsEdit).then((_v) => {
            editor.selection = selection;
        });
    }

    public getSelection() {
        const editor = vscode.window.activeTextEditor,
            selection = editor.selection;
        return this.document.getText(selection);
    }

    public delete() {
        vscode.commands.executeCommand('deleteRight');
    }

    public backspace() {
        vscode.commands.executeCommand('deleteLeft');
    }
}

let registered = false;

function processChanges(event: vscode.TextDocumentChangeEvent) {
    const model = documents.get(event.document).model;
    for (let change of event.contentChanges) {
        // vscode may have a \r\n marker, so it's line offsets are all wrong.
        const myStartOffset = model.getOffsetForLine(change.range.start.line) + change.range.start.character,
            myEndOffset = model.getOffsetForLine(change.range.end.line) + change.range.end.character;
        model.lineInputModel.edit([new ModelEdit('changeRange', [myStartOffset, myEndOffset, change.text.replace(/\r\n/g, '\n')])]);
    }
    model.lineInputModel.flushChanges()

    // we must clear out the repaint cache data, since we don't use it.
    model.lineInputModel.dirtyLines = []
    model.lineInputModel.insertedLines.clear()
    model.lineInputModel.deletedLines.clear();
}

export function getDocument(doc: vscode.TextDocument) {
    return documents.get(doc)
}

export function getDocumentOffset(doc: vscode.TextDocument, position: vscode.Position) {
    let model = getDocument(doc).model;
    return model.getOffsetForLine(position.line) + position.character;
}

function addDocument(doc: vscode.TextDocument): boolean {
    if (doc && doc.languageId == "clojure") {
        if (!documents.has(doc)) {
            const document = new MirroredDocument(doc);
            document.model.lineInputModel.insertString(0, doc.getText())
            documents.set(doc, document);
            return false;
        } else {
            return true;
        }
    }
    return false;
}

export function activate() {
    // the last thing we want is to register twice and receive double events...
    if (registered)
        return;
    registered = true;

    addDocument(utilities.getDocument({}));

    vscode.workspace.onDidCloseTextDocument(e => {
        if (e.languageId == "clojure") {
            documents.delete(e);
        }
    })

    vscode.window.onDidChangeActiveTextEditor(e => {
        if (e && e.document && e.document.languageId == "clojure") {
            addDocument(e.document);
        }
    });

    vscode.workspace.onDidOpenTextDocument(doc => {
        addDocument(doc);
    });

    vscode.workspace.onDidChangeTextDocument(e => {
        if (addDocument(e.document)) {
            processChanges(e);
        }
    });
}
