export { getIndent } from "../cursor-doc/indent"
import * as vscode from "vscode"
import * as utilities from '../utilities';
import * as formatter from '../calva-fmt/src/format';
import { LispTokenCursor } from "../cursor-doc/token-cursor";
import { ModelEdit, EditableDocument, EditableModel, ModelEditOptions, LineInputModel, ModelEditSelection } from "../cursor-doc/model";
import * as parinfer from "../calva-fmt/src/infer";
import * as formatConfig from '../calva-fmt/src/config';
import statusbar from '../statusbar';
import * as outputWindow from '../results-output/results-doc';

let documents = new Map<vscode.TextDocument, MirroredDocument>();
export let statusBar: StatusBar;

export class DocumentModel implements EditableModel {
    readonly lineEndingLength: number;
    lineInputModel: LineInputModel;

    private _parinferReadiness: parinfer.ParinferReadiness = {
        isStructureHealthy: false,
        isIndentationHealthy: false
    }

    get parinferReadiness(): parinfer.ParinferReadiness {
        return this._parinferReadiness;
    }

    set parinferReadiness(readiness: parinfer.ParinferReadiness) {
        this._parinferReadiness = readiness;
    }

    performInferParens = formatConfig.getConfig()["infer-parens-as-you-type"];
    performFormatForward = formatConfig.getConfig()["format-as-you-type"];

    isWritable = false;

    constructor(private document: MirroredDocument) {
        this.lineEndingLength = document.document.eol == vscode.EndOfLine.CRLF ? 2 : 1;
        this.lineInputModel = new LineInputModel(this.lineEndingLength);
    }

    edit(modelEdits: ModelEdit[], options: ModelEditOptions): Thenable<boolean> {
        const editor = vscode.window.activeTextEditor;
        const undoStopBefore = !!options.undoStopBefore;
        return editor.edit(builder => {
            for (const modelEdit of modelEdits) {
                if (!options.performInferParens) {
                    this.document.model.performInferParens = false;
                }
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
        }, { undoStopBefore, undoStopAfter: false }).then(isFulfilled => {
            if (isFulfilled) {
                if (options.selection) {
                    this.document.selection = options.selection;
                }
                if (!options.skipFormat) {
                    return formatter.formatPosition(editor, true, {
                        "format-depth": options.formatDepth ? options.formatDepth : 1
                    });
                }
            }
            return isFulfilled;
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

    public getText(start: number, end: number, mustBeWithin = false) {
        return this.lineInputModel.getText(start, end, mustBeWithin);
    }

    public getLineText(line: number) {
        return this.lineInputModel.getLineText(line);
    }

    getOffsetForLine(line: number) {
        return this.lineInputModel.getOffsetForLine(line);
    }

    public getTokenCursor(offset: number, previous: boolean = false) {
        return this.lineInputModel.getTokenCursor(offset, previous);
    }
}

export class MirroredDocument implements EditableDocument {
    constructor(public document: vscode.TextDocument) { }

    get selectionLeft(): number {
        return this.document.offsetAt(vscode.window.activeTextEditor.selection.anchor);
    }

    get selectionRight(): number {
        return this.document.offsetAt(vscode.window.activeTextEditor.selection.active);
    }

    model = new DocumentModel(this);

    selectionStack: ModelEditSelection[] = [];

    public getTokenCursor(offset: number = this.selectionRight, previous: boolean = false): LispTokenCursor {
        return this.model.getTokenCursor(offset, previous);
    }

    public insertString(text: string) {
        const editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            wsEdit = new vscode.WorkspaceEdit(),
            edit = vscode.TextEdit.insert(this.document.positionAt(this.selectionLeft), text);
        wsEdit.set(this.document.uri, [edit]);
        vscode.workspace.applyEdit(wsEdit).then((_v) => {
            editor.selection = selection;
        });
    }

    set selection(selection: ModelEditSelection) {
        const editor = vscode.window.activeTextEditor,
            document = editor.document,
            anchor = document.positionAt(selection.anchor),
            active = document.positionAt(selection.active);
        editor.selection = new vscode.Selection(anchor, active);
        editor.revealRange(new vscode.Range(active, active));
    }

    get selection(): ModelEditSelection {
        return new ModelEditSelection(this.selectionLeft, this.selectionRight);
    }

    public getSelectionText() {
        const editor = vscode.window.activeTextEditor,
            selection = editor.selection;
        return this.document.getText(selection);
    }

    public delete(): Thenable<boolean> {
        return vscode.commands.executeCommand('deleteRight');
    }

    public backspace(): Thenable<boolean> {
        return vscode.commands.executeCommand('deleteLeft');
    }
}

let registered = false;

function processChanges(event: vscode.TextDocumentChangeEvent) {
    const mirroredDoc = documents.get(event.document);
    const model = mirroredDoc.model;
    const parinferOn = formatConfig.getConfig()["infer-parens-as-you-type"];
    const formatForwardOn = formatConfig.getConfig()["format-as-you-type"];
    const performInferParens = parinferOn && event.reason != vscode.TextDocumentChangeReason.Undo && model.performInferParens;
    const performFormatForward = formatForwardOn && event.reason != vscode.TextDocumentChangeReason.Undo && model.performFormatForward;
    const edits: ModelEdit[] = event.contentChanges.map(change => {
        // vscode may have a \r\n marker, so it's line offsets are all wrong.
        const myStartOffset = model.getOffsetForLine(change.range.start.line) + change.range.start.character;
        const myEndOffset = model.getOffsetForLine(change.range.end.line) + change.range.end.character;
        return new ModelEdit('changeRange', [myStartOffset, myEndOffset, change.text.replace(/\r\n/g, '\n')]);
    });
    model.lineInputModel.edit(edits, {}).then(async _v => {
        if (event.document === vscode.window.activeTextEditor?.document) {
            if (performFormatForward) {
                await formatter.formatForward(mirroredDoc);
            }
            if (mirroredDoc.model.parinferReadiness.isIndentationHealthy && performInferParens) {
                await parinfer.inferParens(mirroredDoc);
            }
            if (!performFormatForward && (event.reason === vscode.TextDocumentChangeReason.Undo || performInferParens)) {
                model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
            }
            statusBar.update(vscode.window.activeTextEditor?.document);
        }
    });
    if (event.contentChanges.length > 0) {
        model.performInferParens = formatConfig.getConfig()["infer-parens-as-you-type"];;
        model.performFormatForward = formatConfig.getConfig()["format-as-you-type"];;
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

export function getDocuments() {
    return documents;
}

export function getDocumentOffset(doc: vscode.TextDocument, position: vscode.Position) {
    let model = getDocument(doc).model;
    return model.getOffsetForLine(position.line) + position.character;
}

function addDocument(doc: vscode.TextDocument): boolean {
    if (doc && doc.languageId == "clojure") {
        if (!documents.has(doc)) {
            const document = new MirroredDocument(doc);
            document.model.lineInputModel.insertString(0, doc.getText());
            documents.set(doc, document);
            document.model.parinferReadiness = parinfer.getParinferReadiness(document);
            utilities.isDocumentWritable(doc).then(r => {
                document.model.isWritable = r
                statusBar.update(vscode.window.activeTextEditor?.document);
            }).catch(e => {
                console.error("Writable check failed:", e)
            });
            return false;
        } else {
            return true;
        }
    }
    return false;
}

export function activate(context: vscode.ExtensionContext) {
    // the last thing we want is to register twice and receive double events...
    if (registered)
        return;
    registered = true;

    const currentDoc = utilities.getDocument({});
    statusBar = new StatusBar();

    context.subscriptions.push(vscode.commands.registerCommand('calva-fmt.enableParinfer', () => {
        vscode.workspace.getConfiguration("calva.fmt").update("experimental.inferParensAsYouType", true, true).then(() => {
            const mirroredDoc = getDocument(currentDoc);
            if (mirroredDoc) {
                mirroredDoc.model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
            }
            statusBar.update(vscode.window.activeTextEditor?.document);
        })
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva-fmt.disableParinfer', () => {
        vscode.workspace.getConfiguration("calva.fmt").update("experimental.inferParensAsYouType", false, true);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('calva-fmt.fixDocumentIndentation', () => {
        const currentDoc = vscode.window.activeTextEditor.document;
        const mirroredDoc = getDocument(currentDoc);
        parinfer.inferIndents(mirroredDoc).then(() => {
            mirroredDoc.model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
            statusBar.update(vscode.window.activeTextEditor?.document);
        }).catch();
    }));

    addDocument(currentDoc);

    vscode.workspace.onDidCloseTextDocument(e => {
        if (e.languageId == "clojure") {
            documents.delete(e);
        }
        statusBar.update(vscode.window.activeTextEditor?.document);
    })

    vscode.window.onDidChangeActiveTextEditor(e => {
        if (e && e.document && e.document.languageId == "clojure") {
            addDocument(e.document);
            const mirroredDoc = getDocument(e.document);
            mirroredDoc.model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
        }
        if (e) {
            statusBar.update(e.document);
        }
    });

    vscode.workspace.onDidOpenTextDocument(doc => {
        addDocument(doc);
        const mirroredDoc = getDocument(doc);
        mirroredDoc.model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
        statusBar.update(doc);
    });

    vscode.workspace.onDidChangeTextDocument(e => {
        if (addDocument(e.document)) {
            processChanges(e);
        }
    });
}


function alertParinferProblem(doc: MirroredDocument, vsCodeDoc: vscode.TextDocument) {
    if (vsCodeDoc?.fileName && vsCodeDoc?.languageId === 'clojure' && utilities.isDocumentWritable(vsCodeDoc)) {
        const DONT_ALERT_BUTTON = "Roger. Don't show again";
        const r = parinfer.inferIndentsResults(doc);
        let message: string = "";
        if (!r.success) {
            message = `The code structure is broken. Can't infer parens on this document: ${r["error-msg"]}, line: ${r.line + 1}, col: ${r.character + 1}. (Note: The structure status is indicated in the status bar as '() <status>'.)`;
        } else if (r.edits && r.edits.length > 0) {
            message = `Paren inference is disabled because the document indentation needs to be fixed first. Issue the command ”Parinfer: Fix Document Indentation”, from the command palette or click the Parinfer status bar button.`
        }
        vscode.window.showErrorMessage(message, DONT_ALERT_BUTTON, "OK").then(button => {
            if (button === DONT_ALERT_BUTTON) {
                vscode.workspace.getConfiguration("calva.fmt").update("experimental.alertOnParinferProblems", false, true);
            }
        });
    }
}

export class StatusBar {
    private _visible: Boolean;
    private _toggleBarItem: vscode.StatusBarItem;

    constructor() {
        this._toggleBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this._toggleBarItem.text = "()";
        this._toggleBarItem.tooltip = "";
        this._toggleBarItem.command = undefined;
        this._toggleBarItem.color = statusbar.color.inactive;
        this._visible = true;
        this._toggleBarItem.show()
    }

    update(vsCodeDoc: vscode.TextDocument) {
        this.visible = true;
        const doc: MirroredDocument = getDocument(vsCodeDoc);

        const model = doc?.model;
        if (model) {
            const parinferOn = formatConfig.getConfig()["infer-parens-as-you-type"];
            const alertOnProblems = parinferOn && formatConfig.getConfig()["alert-on-parinfer-problems"];
            if (!model.parinferReadiness.isStructureHealthy) {
                this._toggleBarItem.text = "() $(error)";
                this._toggleBarItem.tooltip = `Parinfer disabled, structure broken. Please fix!${parinferOn ? ' (Parinfer disabled while structure is broken)' : ''}`;
                this._toggleBarItem.color = parinferOn && model.isWritable ? statusbar.color.active : statusbar.color.inactive;
                if (alertOnProblems) {
                    alertParinferProblem(doc, vsCodeDoc);
                }
            } else if (!model.parinferReadiness.isIndentationHealthy) {
                vscode.commands.executeCommand('setContext', 'parinfer:isIndentationHealthy', false);
                this._toggleBarItem.text = "() $(warning)";
                this._toggleBarItem.tooltip = `Indentation broken${model.isWritable ? ', click to fix it.' : ''}${parinferOn && model.isWritable ? ' (Parinfer disabled while indentation is broken)' : ''}`;
                this._toggleBarItem.command = model.isWritable ? 'calva-fmt.fixDocumentIndentation' : undefined;
                this._toggleBarItem.color = parinferOn && model.isWritable ? statusbar.color.active : statusbar.color.inactive;
                if (alertOnProblems) {
                    alertParinferProblem(doc, vsCodeDoc);
                }
            } else {
                vscode.commands.executeCommand('setContext', 'parinfer:isIndentationHealthy', true);
                this._toggleBarItem.text = "() $(check)";
                this._toggleBarItem.tooltip = `Parinfer ${parinferOn && model.isWritable ? 'enabled' : 'disabled'}. ${model.isWritable ? 'Click to toggle.' : 'Document is read-only'}`;
                this._toggleBarItem.command = parinferOn ? 'calva-fmt.disableParinfer' : 'calva-fmt.enableParinfer';
                this._toggleBarItem.color = parinferOn && model.isWritable ? statusbar.color.active : statusbar.color.inactive;
            }
        } else {
            this._toggleBarItem.text = "()";
            this._toggleBarItem.tooltip = "No structure check performed when in non-Clojure documents";
            this._toggleBarItem.command = undefined;
            this._toggleBarItem.color = statusbar.color.inactive;
        }
    }

    get visible(): Boolean {
        return this._visible;
    }

    set visible(value: Boolean) {
        if (value) {
            this._toggleBarItem.show();
        } else {
            this._toggleBarItem.hide();
        }
    }

    dispose() {
        this._toggleBarItem.dispose();
    }
}
