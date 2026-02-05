import * as vscode from 'vscode';
import * as config from '../../formatter-config';
import * as outputWindow from '../../repl-window/repl-window-doc';
import {
  getIndent,
  getDocumentOffset,
  getDocument,
  nonOverlappingRanges,
} from '../../doc-mirror/index';
import { formatTextAtRange, formatText, jsify } from '../../../out/cljs-lib/cljs-lib';
import * as util from '../../utilities';
import * as respacer from './respacer';
import * as cursorDocUtils from '../../cursor-doc/utilities';
import { isUndefined, cloneDeep } from 'lodash';
import { LispTokenCursor } from '../../cursor-doc/token-cursor';
import { formatIndexes } from './format-index';
import * as state from '../../state';
import * as healer from './healer';
import { nsRangeFromText } from '../../util/ns-form';

/**
 * Calculates the indent edit needed for a position without performing it.
 * Returns a TextEdit array suitable for returning from a formatting provider.
 * Allows VS Code to handle cursor positioning.
 */
export function calculateIndentEdit(
  position: vscode.Position,
  document: vscode.TextDocument
): vscode.TextEdit[] {
  const indent = getIndent(
    getDocument(document).model.lineInputModel,
    getDocumentOffset(document, position),
    config.getConfigNow(document)
  );
  const currentIndent = document.lineAt(position.line).firstNonWhitespaceCharacterIndex;
  const delta = currentIndent - indent;
  const pos = new vscode.Position(position.line, 0);

  if (delta > 0) {
    // Need to remove whitespace
    return [vscode.TextEdit.delete(new vscode.Range(pos, new vscode.Position(pos.line, delta)))];
  } else if (delta < 0) {
    // Need to add whitespace
    const str = ' '.repeat(-delta);
    return [vscode.TextEdit.insert(pos, str)];
  }

  // No change needed
  return [];
}

/**
 * @deprecated This function performs edits directly and causes cursor jumping (issue #2071).
 * Use calculateIndentEdit() instead for new code.
 */
export async function indentPosition(position: vscode.Position, document: vscode.TextDocument) {
  const editor = util.getActiveTextEditor();
  const pos = new vscode.Position(position.line, 0);
  const indent = getIndent(
    getDocument(document).model.lineInputModel,
    getDocumentOffset(document, position),
    await config.getConfig(document)
  );
  const newPosition = new vscode.Position(position.line, indent);
  const delta = document.lineAt(position.line).firstNonWhitespaceCharacterIndex - indent;
  if (delta > 0) {
    return editor
      .edit((edits) => edits.delete(new vscode.Range(pos, new vscode.Position(pos.line, delta))), {
        undoStopAfter: false,
        undoStopBefore: false,
      })
      .then((onFulfilled) => {
        editor.selections = [new vscode.Selection(newPosition, newPosition)];
        return onFulfilled;
      });
  } else if (delta < 0) {
    const str = ' '.repeat(-delta);
    return editor
      .edit((edits) => edits.insert(pos, str), {
        undoStopAfter: false,
        undoStopBefore: false,
      })
      .then((onFulfilled) => {
        editor.selections = [new vscode.Selection(newPosition, newPosition)];
        return onFulfilled;
      });
  }
}

/** Micro-edits to change previousText to formattedText.
 * The formatter usually changes only whitespace.
 * However, its :sort-ns-references? may change text too.
 * Computation of micro-edits is more efficient for whitespace-only changes.
 * Therefore, if a ns form is found,
 * we compute one set of edits for the ns form
 * (which is 1 large, degenerate edit if more than whitespace changed)
 * plus another set of edits for the rest of the document.
 * In the worst case, there are multiple ns forms
 * and the "rest-of-document" changes also degenerate
 * to a single large edit.
 * Micro-edits are preferable because they nudge all cursors
 * and they seem to avoid re-syntax-highlighting,
 * compared with replacing swaths of substantive text.
 */
function whitespaceAndNsEdits(
  eol: string,
  startIndex: number,
  previousText: string,
  formattedText: string
): respacer.WhitespaceChange[] {
  if (previousText == formattedText) {
    return [];
  } else {
    const previousNsInfo = nsRangeFromText(previousText);
    const formattedNsInfo = nsRangeFromText(formattedText);
    if (previousNsInfo && formattedNsInfo) {
      const [previousNsName, previousNsRange] = previousNsInfo;
      const [formattedNsName, formattedNsRange] = formattedNsInfo;
      const nsEdits = respacer.whitespaceEdits(
        eol,
        startIndex,
        previousText.substring(0, previousNsRange[1]),
        formattedText.substring(0, formattedNsRange[1])
      );
      const otherEdits = respacer.whitespaceEdits(
        eol,
        startIndex + previousNsRange[1],
        previousText.substring(previousNsRange[1]),
        formattedText.substring(formattedNsRange[1])
      );
      return [...otherEdits, ...nsEdits];
    } else {
      return respacer.whitespaceEdits(eol, startIndex, previousText, formattedText);
    }
  }
}

/** undefined if range starts in a string or comment */
function rangeReformatChanges(
  document: vscode.TextDocument,
  originalRange: vscode.Range,
  onType: boolean
): respacer.WhitespaceChange[] | undefined {
  const mirrorDoc = getDocument(document);
  const startIndex = document.offsetAt(originalRange.start);
  const cursor = mirrorDoc.getTokenCursor(startIndex);
  // Do not format comments as individual ranges.
  // But do not evade formatting the whole doc if it happens to begin with a comment.
  if (startIndex == 0 || (!cursor.withinString() && !cursor.withinComment())) {
    const eol = _convertEolNumToStringNotation(document.eol);
    const originalText = document.getText(originalRange);
    const healing = healer.bandage(originalText, originalRange.start.character, eol);
    const formattedHealedText = formatCode(healing.healedText, document.eol);
    const newTextDraft = healer.unbandage(healing, formattedHealedText);
    // unbandage aligned top-level forms flush-left, except the first one.
    return whitespaceAndNsEdits(eol, startIndex, originalText, newTextDraft);
  } else {
    console.warn('Range starting in comment or string is not being formatted');
    return [];
  }
}

export function formatRangeEdits(
  document: vscode.TextDocument,
  originalRange: vscode.Range
): vscode.TextEdit[] | undefined {
  // Output/REPL window holds prompts etc. The formatter cannot format it. Do not try.
  if (outputWindow.isReplWindowDoc(document)) {
    return [];
  }
  return rangeReformatChanges(document, originalRange, false).map((chg) =>
    vscode.TextEdit.replace(
      new vscode.Range(document.positionAt(chg.start), document.positionAt(chg.end)),
      chg.text
    )
  );
}

export async function formatRange(document: vscode.TextDocument, range: vscode.Range) {
  const wsEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
  const edits = formatRangeEdits(document, range);

  if (isUndefined(edits)) {
    console.error('formatRangeEdits returned undefined!', cloneDeep({ document, range }));
    return false;
  }

  wsEdit.set(document.uri, edits);
  return vscode.workspace.applyEdit(wsEdit);
}

/** [start,end] of range to reformat with attention to offset 'index', or [-1,-1] to reformat the whole document */
export function formatDocIndexRange(
  doc: vscode.TextDocument,
  index: number,
  extraConfig: CljFmtConfig
): [number, number] {
  const mDoc = getDocument(doc);
  if (mDoc.model.documentVersion != doc.version) {
    console.warn('Model is stale; skipping reformatting');
    return;
  }
  const cursor = mDoc.getTokenCursor(index);

  // If a top-level form "needs" formatting and is indented, reformat the whole document:
  const formatRangeSmall = _calculateFormatRange(extraConfig, cursor, index);
  return formatRangeSmall ? formatRangeSmall : [-1, -1];
}

export function formatDocIndexesInfo(
  doc: vscode.TextDocument,
  onType: boolean,
  indexOfRange: number,
  cursorIndexes: number[],
  extraConfig: CljFmtConfig = {}
) {
  const mDoc = getDocument(doc);
  const formatRange = formatDocIndexRange(doc, indexOfRange, extraConfig);
  if (!formatRange || (formatRange[0] == -1 && formatRange[1] == -1)) {
    return;
  }
  const eol = _convertEolNumToStringNotation(doc.eol);

  const cursor = mDoc.getTokenCursor(1 + formatRange[0]);
  const formatted: {
    'range-text': string;
    range: number[];
  } = formatIndexes(doc.getText(), formatRange, cursorIndexes, eol, onType, {
    ...config.getConfigNow(),
    ...extraConfig,
    'comment-form?': cursor.getFunctionName() === 'comment',
  });
  const range: vscode.Range = new vscode.Range(
    doc.positionAt(formatted.range[0]),
    doc.positionAt(formatted.range[1])
  );
  const previousText: string = doc.getText(
    new vscode.Range(doc.positionAt(formatRange[0]), doc.positionAt(formatRange[1]))
  );
  const formattedText = formatted['range-text'];
  const changes = whitespaceAndNsEdits(eol, doc.offsetAt(range.start), previousText, formattedText);
  return {
    formattedText: formattedText,
    range: range,
    previousText: previousText,
    changes: changes,
  };
}

interface CljFmtConfig {
  'format-depth'?: number;
  'align-associative?'?: boolean;
  'remove-multiple-non-indenting-spaces?'?: boolean;
}

/** [Start,end] of the range to reformat around the cursor, with special cases:
 * - Undefined if not within a top-level form.
 * - Undefined if the form to reformat would be a top-level form that is indented.
 */
function _calculateFormatRange(
  config: CljFmtConfig,
  cursor: LispTokenCursor,
  index: number
): [number, number] {
  const rangeForTopLevelForm = cursor.rangeForDefun(index, false);
  if (!rangeForTopLevelForm) {
    return;
  }
  const topLevelStartCursor = cursor.doc.getTokenCursor(rangeForTopLevelForm[0]);
  const rangeForList = cursor.rangeForList(1);
  if (rangeForList) {
    if (rangeForList[0] === rangeForTopLevelForm[0]) {
      if (topLevelStartCursor.rowCol[1] !== 0) {
        const STOP_INFORMING = 'calvaFormat:stopInformingAboutTopLevelAlignment';
        if (!state.extensionContext.globalState.get(STOP_INFORMING)) {
          void vscode.window
            .showInformationMessage(
              'You are formatting a top level form that is not aligned with the left margin. Calva will not align it for you, because it promises to only format the content of the form. Please align the opening bracket of the form with the left margin and format again. You can also format the whole document by placing the cursor outside of the form and format.',
              'OK',
              "Don't show again"
            )
            .then((selection) => {
              if (selection === "Don't show again") {
                void state.extensionContext.globalState.update(STOP_INFORMING, true);
              }
            });
        }
      }
    }
    return rangeForList;
  }

  const rangeForCurrentForm = cursor.rangeForCurrentForm(index);
  if (!isUndefined(rangeForCurrentForm)) {
    if (rangeForCurrentForm[0] === rangeForTopLevelForm[0]) {
      if (topLevelStartCursor.rowCol[1] !== 0) {
        return;
      }
    }
    if (rangeForCurrentForm.includes(index)) {
      return rangeForCurrentForm;
    }
  }
}

export async function formatPosition(
  editor: vscode.TextEditor,
  onType: boolean = false,
  extraConfig: CljFmtConfig = {}
): Promise<boolean> {
  const doc: vscode.TextDocument = editor.document;
  const ranges = editor.selections
    .map((sel) => doc.offsetAt(sel.active))
    .map((index) => formatDocIndexRange(doc, index, extraConfig))
    .filter((rng) => rng != undefined);
  const isWholeDoc = ranges.filter((r) => r[0] == -1 && r[1] == -1).length > 0;
  let orderedChanges = undefined;
  if (isWholeDoc) {
    // Output/REPL window holds prompts etc. The formatter cannot format it. Do not try.
    if (outputWindow.isReplWindowDoc(editor.document)) {
      return Promise.resolve(false);
    }
    orderedChanges = rangeReformatChanges(
      doc,
      new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)),
      onType
    );
  } else {
    const dedupedRanges = nonOverlappingRanges(ranges);
    const cursorOffsets = editor.selections.map((sel) => doc.offsetAt(sel.active));
    orderedChanges = dedupedRanges
      .map((rng) => rng[0])
      .flatMap((index) => {
        const formattedInfo = formatDocIndexesInfo(doc, onType, index, cursorOffsets, extraConfig);
        return formattedInfo ? formattedInfo.changes : [];
      })
      .sort((a, b) => b.start - a.start);
  }
  return editor.edit((textEditorEdit) => {
    let monotonicallyDecreasing = -1;
    orderedChanges.forEach((change) => {
      const pos1 = doc.positionAt(change.start);
      const pos2 = doc.positionAt(change.end);
      // with multiple cursors, especially near each other, the edits may overlap.
      // VS Code rejects overlapping edits. Skip them:
      if (monotonicallyDecreasing == -1 || change.end < monotonicallyDecreasing) {
        const range = new vscode.Range(pos1, pos2);
        textEditorEdit.replace(range, change.text);
        monotonicallyDecreasing = change.start;
      }
    });
  });
}

// Debounce format-as-you-type and toss it aside if User seems still to be working
// Increased from 250ms to 400ms to reduce cursor jumping issues
let scheduledFormatCircumstances = undefined;
const scheduledFormatDelayMs = 400;

function formatPositionCallback(extraConfig: CljFmtConfig) {
  if (
    scheduledFormatCircumstances &&
    vscode.window.activeTextEditor === scheduledFormatCircumstances['editor'] &&
    vscode.window.activeTextEditor.document.version ==
      scheduledFormatCircumstances['documentVersion']
  ) {
    formatPosition(scheduledFormatCircumstances['editor'], true, extraConfig).finally(() => {
      scheduledFormatCircumstances = undefined;
    });
  }
  // do not anull scheduledFormatCircumstances. Another callback might have been scheduled
}

export function scheduleFormatAsType(editor: vscode.TextEditor, extraConfig: CljFmtConfig = {}) {
  const expectedDocumentVersionUponCallback = 1 + editor.document.version;
  if (
    !scheduledFormatCircumstances ||
    expectedDocumentVersionUponCallback != scheduledFormatCircumstances['documentVersion']
  ) {
    // Unschedule (if scheduled) & reschedule: best effort to reformat at a quiet time
    if (scheduledFormatCircumstances?.timeoutId) {
      clearTimeout(scheduledFormatCircumstances?.timeoutId);
    }
    scheduledFormatCircumstances = {
      editor: editor,
      documentVersion: expectedDocumentVersionUponCallback,
      timeoutId: setTimeout(function () {
        formatPositionCallback(extraConfig);
      }, scheduledFormatDelayMs),
    };
  }
}

export function formatPositionCommand(editor: vscode.TextEditor) {
  void formatPosition(editor);
}

export function alignPositionCommand(editor: vscode.TextEditor) {
  void formatPosition(editor, true, { 'align-associative?': true });
}

export function trimWhiteSpacePositionCommand(editor: vscode.TextEditor) {
  void formatPosition(editor, false, { 'remove-multiple-non-indenting-spaces?': true });
}

export function formatCode(code: string, eol: number) {
  const d = {
    'range-text': code,
    eol: _convertEolNumToStringNotation(eol),
    config: config.getConfigNow(),
  };
  const result = jsify(formatText(d));
  if (!result['error']) {
    return result['range-text'];
  } else {
    console.error('Error in `formatCode`:', result['error']);
    return code;
  }
}

async function _formatRange(
  rangeText: string,
  allText: string,
  range: number[],
  eol: string
): Promise<string | undefined> {
  const d = {
    'range-text': rangeText,
    'all-text': allText,
    range: range,
    eol: eol,
    config: await config.getConfig(),
  };
  const result = jsify(formatTextAtRange(d));
  if (!result['error']) {
    return result['range-text'];
  }
}

function _convertEolNumToStringNotation(eol: vscode.EndOfLine) {
  return eol == 2 ? '\r\n' : '\n';
}
