export { getIndent } from '../cursor-doc/indent';
import * as vscode from 'vscode';
import * as utilities from '../utilities';
import * as formatter from '../calva-fmt/src/format';
import * as respacer from '../calva-fmt/src/respacer';
import { LispTokenCursor } from '../cursor-doc/token-cursor';
import {
  ModelEdit,
  EditableDocument,
  EditableModel,
  ModelEditOptions,
  LineInputModel,
  ModelEditRange,
  ModelEditSelection,
  ModelEditFunction,
  selectionsAfterEdits,
} from '../cursor-doc/model';
import { isUndefined, sortedUniq } from 'lodash';

const documents = new Map<vscode.TextDocument, MirroredDocument>();

/** Non-nested ranges (favoring long ranges).
 * The input ranges reflect forms, so they might overlap but only by nesting.
 */
export function nonOverlappingRanges(ranges: ModelEditRange[]): ModelEditRange[] {
  const listRanges: ModelEditRange[] = ranges.sort(
    (a: ModelEditRange, b: ModelEditRange) => b[1] - b[0] - (a[1] - a[0])
  );
  // Discard ranges embedded in other ranges. O(n^2)
  // -Traverse the list once, for 'outer ranges', in order longest range to shortest.
  // -At each step, traverse the remainder of the list once for 'inner ranges',
  //   discarding inner ranges included in the outer range.
  // -Instead of moving array elements, just mark the bad ones using start=-1.
  for (let i = 0; i < listRanges.length; i++) {
    const outerRange = listRanges[i];
    if (outerRange[0] != -1) {
      for (let j = i + 1; j < listRanges.length; j++) {
        const innerRange = listRanges[j];
        if (innerRange[0] != -1) {
          if (innerRange[0] >= outerRange[0] && innerRange[1] <= outerRange[1]) {
            listRanges[j][0] = -1;
          }
        }
      }
    }
  }
  const disjointListRanges = listRanges.filter((r: ModelEditRange) => r[0] != -1);
  return disjointListRanges;
}

/**
 * Ranges-to-reformat in a post-edit document, capturing disjoint lists surrounding the given edits,
 * undefined if the top-level needs reformatting.
 * Positions in edits are relative to the document *before* any of the edits are applied.
 */
const reformatListRangesForEdits = (function () {
  // 'Decoders' of the [start, end] outer bounds of the new content inserted by a ModelEdit
  const pointsChangeRange = function (edit: ModelEdit<'changeRange'>): number[] {
    return [edit.args[0], edit.args[1]];
  };
  const pointsDeleteRange = function (edit: ModelEdit<'deleteRange'>): number[] {
    return [edit.args[0], edit.args[0]];
  };
  const pointsInsertString = function (edit: ModelEdit<'insertString'>): number[] {
    return [edit.args[0], edit.args[0] + edit.args[1].length];
  };
  const pointsModelEdit = function (edit: ModelEdit<ModelEditFunction>): number[] {
    const e: any = edit;
    return edit.editFn == 'deleteRange'
      ? pointsDeleteRange(e)
      : edit.editFn == 'changeRange'
      ? pointsChangeRange(e)
      : pointsInsertString(e);
  };

  return function (model: DocumentModel, edits: ModelEdit<ModelEditFunction>[]): ModelEditRange[] {
    // (The edits' positions are as-of the moment *before* application of the edits.)
    // Translate each edit to a start- and end-point of new content.
    // Translate those points to start- and end-points of sexprs.
    // Compute disjoint ranges.
    const listRanges1: ModelEditRange[] = edits.flatMap(pointsModelEdit).map((n: number) => {
      const cursor = model.getTokenCursor(n);
      let x = cursor.rangeForList(1);
      // Fall back to rangeForCurrentForm if no form encloses the offset:
      if (!x || x[0] == undefined) {
        x = cursor.rangeForCurrentForm(n);
      }
      return x;
    });
    const wholeDoc = listRanges1.filter((x) => x == undefined).length > 0;
    return wholeDoc ? undefined : nonOverlappingRanges(listRanges1);
  };
})();

export class DocumentModel implements EditableModel {
  readonly lineEndingLength: number;
  lineInputModel: LineInputModel;
  documentVersion: number; // model reflects this version
  staleDocumentVersion: number; // this version is outdated by queued edits

  constructor(private document: MirroredDocument) {
    this.lineEndingLength = document.document.eol == vscode.EndOfLine.CRLF ? 2 : 1;
    this.lineInputModel = new LineInputModel(this.lineEndingLength);
    this.documentVersion = document.document.version;
  }

  get lineEnding() {
    return this.lineEndingLength == 2 ? '\r\n' : '\n';
  }

  /** A loggable message if the model is out-of-date with the given document version
   * or has been edited beyond that document version */
  stale(editorVersion: number): string {
    if (this.documentVersion && this.documentVersion != editorVersion) {
      return 'model=' + this.documentVersion + ' vs document=' + editorVersion;
    } else if (this.documentVersion && this.documentVersion == this.staleDocumentVersion) {
      return 'edited since ' + this.documentVersion;
    } else {
      return null;
    }
  }

  private editNowTextOnly(
    modelEdits: ModelEdit<ModelEditFunction>[],
    options: ModelEditOptions
  ): void {
    const builder = options.builder;
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
    this.staleDocumentVersion = this.documentVersion;
  }

  editNow(modelEdits: ModelEdit<ModelEditFunction>[], options: ModelEditOptions): void {
    this.editNowTextOnly(modelEdits, options);
    if (options.selections) {
      this.document.selections = options.selections;
    }
    if (!options.skipFormat) {
      const editor = utilities.getActiveTextEditor();
      void formatter.scheduleFormatAsType(editor, {});
    }
  }

  private postEditReformat(editor: vscode.TextEditor, offsets: number[]): Thenable<boolean> {
    // Now that the document has been edited, calculate the reformatting:
    const reformatChange: respacer.WhitespaceChange[] = sortedUniq(offsets.sort((a, b) => b - a))
      .flatMap((p) => {
        const doc = this.document.document;
        const formattedInfo = formatter.formatDocIndexesInfo(
          doc,
          true,
          p,
          editor.selections.map((s) => s.active).map((p) => doc.offsetAt(p))
        );
        return formattedInfo ? formattedInfo.changes : [];
      })
      .filter(
        (function () {
          // With multiple cursors, the reformat edits might overlap.
          // VS Code rejects an edit transaction if any operations overlap.
          // Remove overlapping edits:
          let monotonicallyDecreasing = -1;
          return function (change: respacer.WhitespaceChange) {
            if (change.end < change.start) {
              console.error('Backwards change!');
              return false;
            }
            if (monotonicallyDecreasing == -1 || change.end <= monotonicallyDecreasing) {
              monotonicallyDecreasing = change.start;
              return true;
            } else {
              return false;
            }
          };
        })()
      );
    const doc = this.document.document;
    // Do an edit transaction, even if insubstantial, just for the undoStopAfter=true.
    return editor.edit(
      (textEditorEdit) => {
        let monotonicallyDecreasing = -1;
        let prior = undefined; // weed out adjacent duplicates
        reformatChange.forEach((change) => {
          // with multiple cursors, especially near each other, the edits may overlap.
          // VS Code rejects overlapping edits. Skip them:
          if (monotonicallyDecreasing == -1 || change.end <= monotonicallyDecreasing) {
            const pos1 = doc.positionAt(change.start);
            const pos2 = doc.positionAt(change.end);
            if (prior == undefined || prior.start != change.start || prior.end != change.end) {
              prior = change;
              const range = new vscode.Range(pos1, pos2);
              textEditorEdit.replace(range, change.text);
              monotonicallyDecreasing = change.start;
            }
          } else {
            console.warn('Reformat is still out-of-order');
          }
        });
      },
      // undoStopBefore, to fall in the same undo unit as the preceding edit.
      { undoStopBefore: false, undoStopAfter: true }
    );
  }

  edit(modelEdits: ModelEdit<ModelEditFunction>[], options: ModelEditOptions): Thenable<boolean> {
    // undoStopBefore===false joins this edit with the prior one in a single undoable unit.
    const undoStopBefore = !(options.undoStopBefore === false);
    // Nothing to do?
    if (!modelEdits || modelEdits.length == 0) {
      return Promise.resolve(true);
    }
    // Reformatting will retouch the spots affected by edits.
    // The edits are stated in terms of the document-as-it-is, before any of the edits.
    // Reformat's offsets must be in post-edit terms (i.e., "a later as-is", before reformatting).
    // Translate pre-edit to post-edit offsets:
    const surgicalRanges: ModelEditRange[] = reformatListRangesForEdits(this, modelEdits);
    const rangesOrWhole: ModelEditRange[] = surgicalRanges
      ? surgicalRanges
      : [[0, this.document.document.getText().length]];
    const postEditPlanDraft = {
      forDocumentVersion: this.document.document.version + 1, // none of this matters if another edit intervenes
      reformatOffsets: options.skipFormat
        ? undefined
        : selectionsAfterEdits(
            modelEdits,
            rangesOrWhole.flatMap((r: ModelEditRange): ModelEditSelection[] => {
              return [
                new ModelEditSelection(r[0], r[0], r[0], r[0]),
                new ModelEditSelection(r[1], r[1], r[1], r[1]),
              ];
            })
          ).flatMap((sel) => [sel.anchor, sel.active]),
      selections: options.selections,
    };
    const postEditPlan =
      postEditPlanDraft.reformatOffsets || postEditPlanDraft.selections
        ? postEditPlanDraft
        : undefined;
    // Do the edits (with undoStopAfter=false if we will reformat,
    // to include the reformatting in the same undo-unit as the edit).
    const editor = utilities.getActiveTextEditor();
    const editCompletion = editor.edit(
      (builder) => {
        this.editNowTextOnly(modelEdits, { builder: builder, ...options });
      },
      { undoStopAfter: options.skipFormat, undoStopBefore }
    );
    if (!postEditPlan) {
      return editCompletion;
    } else {
      return editCompletion.then((isFulfilled) => {
        if (!isFulfilled) {
          console.warn('Edit was not fulfilled');
        } else {
          if (postEditPlan.forDocumentVersion != this.document.document.version) {
            console.warn('Post-edit preempted by another edit');
          } else {
            // 1. Apply selection overrides.
            // 2. Reformat, adjusting the new selections.
            if (postEditPlan.selections) {
              this.document.selections = postEditPlan.selections;
            }
            if (postEditPlan.reformatOffsets) {
              {
                return this.postEditReformat(editor, postEditPlan.reformatOffsets).then(
                  (reformatFulfilled) => {
                    if (!reformatFulfilled) {
                      console.warn('Post-edit reformat was not fulfilled');
                    }
                    return true; // because the main edit was fulfilled
                  }
                );
              }
            }
          }
        }
        return isFulfilled;
      });
    }
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
    const editor = utilities.getActiveTextEditor(),
      selection = editor.selections[0],
      wsEdit = new vscode.WorkspaceEdit(),
      // TODO: prob prefer selection.active or .start
      edit = vscode.TextEdit.insert(this.document.positionAt(this.selections[0].anchor), text);
    wsEdit.set(this.document.uri, [edit]);
    void vscode.workspace.applyEdit(wsEdit).then((_v) => {
      editor.selections = [selection];
    });
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

  public getSelectionText() {
    const editor = utilities.getActiveTextEditor(),
      selection = editor.selections[0];
    return this.document.getText(selection);
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

  model.documentVersion = event.document.version;
  model.staleDocumentVersion = undefined;
}

export function tryToGetDocument(doc: vscode.TextDocument) {
  return documents.get(doc);
}

export function getDocument(doc: vscode.TextDocument) {
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
