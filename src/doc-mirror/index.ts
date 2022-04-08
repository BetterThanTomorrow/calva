export { getIndent } from '../cursor-doc/indent';
import { isUndefined } from 'lodash';
import * as vscode from 'vscode';
import * as formatter from '../calva-fmt/src/format';
import {
  EditableDocument,
  EditableModel,
  LineInputModel,
  ModelEdit,
  ModelEditOptions,
  ModelEditSelection,
  ModelEditResult,
} from '../cursor-doc/model';
import { LispTokenCursor } from '../cursor-doc/token-cursor';
import * as utilities from '../utilities';

const documents = new Map<vscode.TextDocument, MirroredDocument>();

export class DocumentModel implements EditableModel {
  readonly lineEndingLength: number;
  lineInputModel: LineInputModel;

  constructor(private document: MirroredDocument) {
    this.lineEndingLength = document.document.eol == vscode.EndOfLine.CRLF ? 2 : 1;
    this.lineInputModel = new LineInputModel(this.lineEndingLength);
  }

  edit(modelEdits: ModelEdit[], options: ModelEditOptions): Thenable<ModelEditResult> {
    const editor = utilities.getActiveTextEditor(),
      undoStopBefore = !!options.undoStopBefore;
    return editor
      .edit(
        (builder) => {
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
        },
        { undoStopBefore, undoStopAfter: false }
      )
      .then(async (success) => {
        if (success) {
          if (options.selections) {
            this.document.selections = options.selections;
          }
          if (!options.skipFormat) {
            return {
              edits: modelEdits,
              selections: options.selections,
              success: await formatter.formatPosition(editor, false, {
                'format-depth': options.formatDepth ? options.formatDepth : 1,
              }),
            };
          }
        }
        return { edits: modelEdits, selections: options.selections, success };
      });
  }

  private insertEdit(
    builder: vscode.TextEditorEdit,
    offset: number,
    text: string,
    oldSelection?: [number, number],
    newSelection?: [number, number]
  ) {
    const editor = utilities.getActiveTextEditor(),
      document = editor.document;
    builder.insert(document.positionAt(offset), text);
  }

  private replaceEdit(
    builder: vscode.TextEditorEdit,
    start: number,
    end: number,
    text: string,
    oldSelection?: [number, number],
    newSelection?: [number, number]
  ) {
    const editor = utilities.getActiveTextEditor(),
      document = editor.document,
      range = new vscode.Range(document.positionAt(start), document.positionAt(end));
    builder.replace(range, text);
  }

  private deleteEdit(
    builder: vscode.TextEditorEdit,
    offset: number,
    count: number,
    oldSelection?: [number, number],
    newSelection?: [number, number]
  ) {
    const editor = utilities.getActiveTextEditor(),
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

  public getTokenCursor(offset: number, previous?: boolean) {
    return this.lineInputModel.getTokenCursor(offset, previous);
  }
}

export class MirroredDocument implements EditableDocument {
  constructor(public document: vscode.TextDocument) {}

  model = new DocumentModel(this);

  selectionsStack: ModelEditSelection[][] = [];

  public getTokenCursor(
    offset: number = this.selections[0].active,
    previous: boolean = false
  ): LispTokenCursor {
    return this.model.getTokenCursor(offset, previous);
  }

  public insertString(text: string) {
    const editor = utilities.tryToGetActiveTextEditor(),
      selections = editor.selections,
      wsEdit = new vscode.WorkspaceEdit(),
      // TODO: prob prefer selection.active or .start
      edits = this.selections.map(({ anchor: left }) =>
        vscode.TextEdit.insert(this.document.positionAt(left), text)
      );
    wsEdit.set(this.document.uri, edits);
    void vscode.workspace.applyEdit(wsEdit).then((_v) => {
      editor.selections = selections;
    });
  }

  get selection() {
    return this.selections[0];
  }

  set selection(sel: ModelEditSelection) {
    this.selections = [sel];
  }

  get selections(): ModelEditSelection[] {
    const editor = utilities.getActiveTextEditor(),
      document = editor.document;
    return editor.selections.map((sel) => {
      const anchor = document.offsetAt(sel.anchor),
        active = document.offsetAt(sel.active);
      return new ModelEditSelection(anchor, active);
    });
  }

  set selections(selections: ModelEditSelection[]) {
    const editor = utilities.getActiveTextEditor(),
      document = editor.document;
    editor.selections = selections.map((selection) => {
      const anchor = document.positionAt(selection.anchor),
        active = document.positionAt(selection.active);
      return new vscode.Selection(anchor, active);
    });

    const primarySelection = selections[0];
    const active = document.positionAt(primarySelection.active);
    editor.revealRange(new vscode.Range(active, active));
  }

  public getSelectionTexts() {
    const editor = utilities.getActiveTextEditor(),
      selections = editor.selections;
    return selections.map((selection) => this.document.getText(selection));
  }

  public getSelectionText(index: number = 0) {
    const editor = utilities.getActiveTextEditor(),
      selection = editor.selections[index];
    return this.document.getText(selection);
  }

  public delete(): Thenable<ModelEditResult> {
    return vscode.commands.executeCommand('deleteRight');
  }

  public backspace(): Thenable<ModelEditResult> {
    return vscode.commands.executeCommand('deleteLeft');
  }
}

let registered = false;

function processChanges(event: vscode.TextDocumentChangeEvent) {
  const model = documents.get(event.document).model;
  for (const change of event.contentChanges) {
    // vscode may have a \r\n marker, so it's line offsets are all wrong.
    const myStartOffset =
        model.getOffsetForLine(change.range.start.line) + change.range.start.character,
      myEndOffset = model.getOffsetForLine(change.range.end.line) + change.range.end.character;
    void model.lineInputModel.edit(
      [
        new ModelEdit('changeRange', [
          myStartOffset,
          myEndOffset,
          change.text.replace(/\r\n/g, '\n'),
        ]),
      ],
      {}
    );
  }
  model.lineInputModel.flushChanges();

  // we must clear out the repaint cache data, since we don't use it.
  model.lineInputModel.dirtyLines = [];
  model.lineInputModel.insertedLines.clear();
  model.lineInputModel.deletedLines.clear();
}

export function tryToGetDocument(doc: vscode.TextDocument) {
  return documents.get(doc);
}

export function getDocument(doc: vscode.TextDocument): MirroredDocument {
  const mirrorDoc = tryToGetDocument(doc);

  if (isUndefined(mirrorDoc)) {
    throw new Error('Missing mirror document!');
  }

  return mirrorDoc;
}

export function getDocumentOffset(doc: vscode.TextDocument, position: vscode.Position) {
  const model = getDocument(doc).model;
  return model.getOffsetForLine(position.line) + position.character;
}

function addDocument(doc?: vscode.TextDocument): boolean {
  if (doc && doc.languageId == 'clojure') {
    if (!documents.has(doc)) {
      const document = new MirroredDocument(doc);
      document.model.lineInputModel.insertString(0, doc.getText());
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
  if (registered) {
    return;
  }
  registered = true;

  addDocument(utilities.tryToGetDocument({}));

  vscode.workspace.onDidCloseTextDocument((e) => {
    if (e.languageId == 'clojure') {
      documents.delete(e);
    }
  });

  vscode.window.onDidChangeActiveTextEditor((e) => {
    if (e && e.document && e.document.languageId == 'clojure') {
      addDocument(e.document);
    }
  });

  vscode.workspace.onDidOpenTextDocument((doc) => {
    addDocument(doc);
  });

  vscode.workspace.onDidChangeTextDocument((e) => {
    if (addDocument(e.document)) {
      processChanges(e);
    }
  });
}
