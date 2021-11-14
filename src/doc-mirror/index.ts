export { getIndent } from "../cursor-doc/indent"
import * as vscode from "vscode"
import * as utilities from '../utilities';
import * as formatter from '../calva-fmt/src/format';
import { LispTokenCursor } from "../cursor-doc/token-cursor";
import { ModelEdit, EditableDocument, EditableModel, ModelEditOptions, LineInputModel, ModelEditSelection } from "../cursor-doc/model";
import * as parinfer from "../calva-fmt/src/infer";
import * as formatConfig from '../calva-fmt/src/config';
import * as config from '../config';
import statusbar from '../statusbar';
import { string } from "fast-check/*";

let documents = new Map<vscode.TextDocument, MirroredDocument>();
let statusBar: StatusBar;

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
    performFormatForward = formatConfig.getConfig()["format-forward-list-on-same-line"];

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
    const tokenCursor = mirroredDoc.getTokenCursor();
    for (const change of event.contentChanges) {
        // vscode may have a \r\n marker, so it's line offsets are all wrong.
        const myStartOffset = model.getOffsetForLine(change.range.start.line) + change.range.start.character;
        const myEndOffset = model.getOffsetForLine(change.range.end.line) + change.range.end.character;
        //const changedText = model.getText(myStartOffset, myEndOffset);
        let keyMap = vscode.workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
        keyMap = String(keyMap).trim().toLowerCase();
        const parinferOn = formatConfig.getConfig()["infer-parens-as-you-type"];
        const strict = keyMap === 'strict';
        const autoClose = !parinferOn && strict && config.getConfig().strictAutoClosingBrackets && !tokenCursor.withinComment() && event.contentChanges.length === 1 && change.text.match(/^[\(\[\{]$/);
        const preventUnmatchedClosings = !parinferOn && strict && config.getConfig().strictPreventUnmatchedClosingBracket && !tokenCursor.withinComment() && event.contentChanges.length === 1 && change.text.match(/^[)\]\}]$/);
        const formatForwardOn = formatConfig.getConfig()["format-forward-list-on-same-line"];
        const performInferParens = parinferOn && event.reason != vscode.TextDocumentChangeReason.Undo && model.performInferParens || autoClose || preventUnmatchedClosings;
        const performFormatForward = formatForwardOn && event.reason != vscode.TextDocumentChangeReason.Undo && model.performFormatForward;
        model.lineInputModel.edit([
            new ModelEdit('changeRange', [myStartOffset, myEndOffset, change.text.replace(/\r\n/g, '\n')])
        ], {}).then(async _v => {
            if (performFormatForward) {
                await formatter.formatForward(mirroredDoc);
            }
            if (mirroredDoc.model.parinferReadiness.isIndentationHealthy && performInferParens) {
                await parinfer.inferParens(mirroredDoc);
            }
            if (performInferParens) {
                model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
                statusBar.update(mirroredDoc);
            }
        });
    }
    if (event.contentChanges.length > 0) {
        model.performInferParens = formatConfig.getConfig()["infer-parens-as-you-type"];;
        model.performFormatForward = formatConfig.getConfig()["format-forward-list-on-same-line"];;
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
            statusBar.update(document);
            return false;
        } else {
            const document = getDocument(doc);
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
    addDocument(currentDoc);

    context.subscriptions.push(statusBar);

    vscode.workspace.onDidCloseTextDocument(e => {
        if (e.languageId == "clojure") {
            documents.delete(e);
        }
    })

    vscode.window.onDidChangeActiveTextEditor(e => {
        if (e && e.document && e.document.languageId == "clojure") {
            addDocument(e.document);
            const mirroredDoc = getDocument(e.document);
            mirroredDoc.model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
            statusBar.update(mirroredDoc);
        } else {
            statusBar.update();
        }
    });

    vscode.workspace.onDidOpenTextDocument(doc => {
        addDocument(doc);
        const mirroredDoc = getDocument(doc);
        mirroredDoc.model.parinferReadiness = parinfer.getParinferReadiness(mirroredDoc);
        statusBar.update(mirroredDoc);
    });

    vscode.workspace.onDidChangeTextDocument(e => {
        if (addDocument(e.document)) {
            processChanges(e);
        }
    });
}


function alertPareditProblem(doc: MirroredDocument) {
    const DONT_ALERT_BUTTON = "Roger. Don't show again";
    const r = parinfer.inferIndentsResults(doc);
    let message: string = "";
    if (!r.success) {
        message = `The code structure is broken. Can't infer parens on this document: ${r["error-msg"]}, line: ${r.line + 1}, col: ${r.character + 1}`;
    } else {
        message = `Paren inference is disabled because the document indentation needs to be fixed first. _Issue the command **Parinfer: Fix indentation**, from the command palette or click the Parinfer status bar button.`
    }
    vscode.window.showErrorMessage(message, DONT_ALERT_BUTTON, "OK");
}

export class StatusBar {
    private _visible: Boolean;
    private _toggleBarItem: vscode.StatusBarItem;

    constructor() {
        this._toggleBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this._toggleBarItem.text = "() $(check)";
        this._toggleBarItem.tooltip = "";
        this._visible = false;
        this._toggleBarItem.command = 'calva-fmt.chooseParinferEnable';
        this._toggleBarItem.color = statusbar.color.inactive;
    }

    update(doc?: MirroredDocument) {
        const parinferOn = formatConfig.getConfig()["infer-parens-as-you-type"];
        const alertOnProblems = parinferOn && formatConfig.getConfig()["alert-on-paredit-problems"];

        const model = doc?.model;
        if (model) {
            if (!model.parinferReadiness.isStructureHealthy) {
                this.visible = true;
                this._toggleBarItem.text = ")( $(error)";
                this._toggleBarItem.tooltip = "Parinfer disabled, structure broken, you need to fix it.";
                this._toggleBarItem.color = undefined;
                if (alertOnProblems) {
                    alertPareditProblem(doc);
                }
            } else if (!model.parinferReadiness.isIndentationHealthy) {
                this.visible = true;
                this._toggleBarItem.text = "() $(warning)";
                this._toggleBarItem.tooltip = "Parinfer disabled, click to fix indentation.";
                this._toggleBarItem.command = 'calva-fmt.chooseParinferEnable';
                this._toggleBarItem.color = undefined;
                if (alertOnProblems) {
                    alertPareditProblem(doc);
                }
            } else {
                this.visible = true;
                this._toggleBarItem.text = "() $(check)";
                this._toggleBarItem.tooltip = "Parinfer enabled";
                this._toggleBarItem.color = undefined;
            }
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
