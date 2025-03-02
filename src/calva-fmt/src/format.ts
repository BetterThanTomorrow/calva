import * as vscode from 'vscode';
import * as config from '../../formatter-config';
import * as outputWindow from '../../repl-window/repl-doc';
import {
  getIndent,
  getDocumentOffset,
  getDocument,
  nonOverlappingRanges,
} from '../../doc-mirror/index';
import { formatTextAtRange, formatText, jsify } from '../../../out/cljs-lib/cljs-lib';
import * as util from '../../utilities';
import * as cursorDocUtils from '../../cursor-doc/utilities';
import { isUndefined, cloneDeep } from 'lodash';
import { LispTokenCursor } from '../../cursor-doc/token-cursor';
import { formatIndex } from './format-index';
import * as state from '../../state';

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

function rangeReformatChanges(
  document: vscode.TextDocument,
  originalRange: vscode.Range
): ReformatChange[] | undefined {
  const mirrorDoc = getDocument(document);
  const startIndex = document.offsetAt(originalRange.start);
  const cursor = mirrorDoc.getTokenCursor(startIndex);
  if (!cursor.withinString() && !cursor.withinComment()) {
    const eol = _convertEolNumToStringNotation(document.eol);
    const originalText = document.getText(originalRange);
    const leadingWs = originalText.match(/^\s*/)[0];
    const trailingWs = originalText.match(/\s*$/)[0];
    const missingTexts = cursorDocUtils.getMissingBrackets(originalText);
    const healedText = `${missingTexts.prepend}${originalText.trim()}${missingTexts.append}`;
    const formattedHealedText = formatCode(healedText, document.eol);
    const leadingEolPos = leadingWs.lastIndexOf(eol);
    const startIndent =
      leadingEolPos === -1
        ? originalRange.start.character
        : leadingWs.length - leadingEolPos - eol.length;
    const formattedText = formattedHealedText
      .substring(
        missingTexts.prepend.length,
        missingTexts.prepend.length + formattedHealedText.length - missingTexts.append.length
      )
      .split(eol)
      .map((line: string, i: number) => (i === 0 ? line : `${' '.repeat(startIndent)}${line}`))
      .join(eol);
    const newText = `${formattedText.startsWith(leadingWs) ? '' : leadingWs}${formattedText}${
      formattedText.endsWith(trailingWs) ? '' : trailingWs
    }`;
    const whitespaceEdits =
      originalText == newText ? [] : reformatChanges(startIndex, originalText, newText);
    return whitespaceEdits;
  }
}

export function formatRangeEdits(
  document: vscode.TextDocument,
  originalRange: vscode.Range
): vscode.TextEdit[] | undefined {
  return rangeReformatChanges(document, originalRange).map((chg) =>
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

/** [start,end] of range to reformat with attention to offset 'index' */
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
  const formatRange: [number, number] = formatRangeSmall
    ? formatRangeSmall
    : [0, doc.getText().length];

  return formatRange;
}

export function formatDocIndexInfo(
  doc: vscode.TextDocument,
  onType: boolean,
  index: number,
  extraConfig: CljFmtConfig = {}
) {
  const mDoc = getDocument(doc);
  const cursor = mDoc.getTokenCursor(index);
  const formatRange = formatDocIndexRange(doc, index, extraConfig);
  if (!formatRange) {
    return;
  }
  const formatted: {
    'range-text': string;
    range: number[];
    'new-index': number;
  } = formatIndex(
    doc.getText(),
    formatRange,
    index,
    _convertEolNumToStringNotation(doc.eol),
    onType,
    {
      ...config.getConfigNow(),
      ...extraConfig,
      'comment-form?': cursor.getFunctionName() === 'comment',
    }
  );
  const range: vscode.Range = new vscode.Range(
    doc.positionAt(formatted.range[0]),
    doc.positionAt(formatted.range[1])
  );
  const newIndex: number = doc.offsetAt(range.start) + formatted['new-index'];
  const previousText: string = doc.getText(range);
  const formattedText = formatted['range-text'];
  const changes =
    previousText == formattedText
      ? []
      : reformatChanges(doc.offsetAt(range.start), previousText, formattedText);
  return {
    formattedText: formattedText,
    range: range,
    previousText: previousText,
    previousIndex: index,
    newIndex: newIndex,
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

//----------

export type ReformatChange = {
  start: number;
  end: number;
  text: string;
};

/** whitespace and substance. Pre-format and re-formatted text can be expressed
 * as a series of SpacedUnit. The substance parts can be aligned and then
 * changes in size can be translated to TextEdits.
 */
type SpacedUnit = [spaces: string, stuff: string];

/** Array of [spaces, nonspaces] which if concatenated would equal s.
 * Treats comma and JS regex \s as spaces.
 */
function spacedUnits(s: string): SpacedUnit[] {
  const frags = s.match(/[\s,]+|[^\s,]+/g);
  // Ensure 1st item is of whitespace:
  if (frags[0].match(/[^\s,]/)) {
    frags.unshift('');
  }
  // Ensure last item is of non-whitespace stuff:
  if (frags.length % 2) {
    frags.push('');
  }
  // Partition items into [space, stuff] pairs:
  const units = [];
  for (let i = 0; i < frags.length; i += 2) {
    units.push([frags[i], frags[i + 1]]);
  }
  return units;
}

/* A single word in a or b may have been split into multiple words in the other (eg at punctuation).
   Adjust a and b to the finest granularity of words in either of them.
*/
function alignSpacedUnits(a: SpacedUnit[], b: SpacedUnit[]): [SpacedUnit[], SpacedUnit[]] {
  const a2 = [],
    b2 = [];
  while (a.length && b.length) {
    if (a[0][1] == b[0][1]) {
      a2.push(a[0]);
      b2.push(b[0]);
      a.shift();
      b.shift();
    } else if (a[0][1].length < b[0][1].length) {
      const aWhole = a[0][1];
      const bPart = b[0][1].slice(0, a[0][1].length);
      if (aWhole == bPart) {
        a2.push(a[0]);
        a.shift();
        b2.push([b[0][0], bPart]);
        b[0] = ['', b[0][1].slice(aWhole.length)];
      } else {
        console.error('alignSpacedUnits: a/b mismatch wherein a is shorter');
        return [undefined, undefined];
      }
    } else {
      const bWhole = b[0][1];
      const aPart = a[0][1].slice(0, b[0][1].length);
      if (bWhole == aPart) {
        b2.push(b[0]);
        b.shift();
        a2.push([a[0][0], aPart]);
        a[0] = ['', a[0][1].slice(bWhole.length)];
      } else {
        console.error('alignSpacedUnits: a/b mismatch wherein b is shorter');
        return [undefined, undefined];
      }
    }
  }
  return [a2, b2];
}

/** Edits to accomplish the reformatting at one point in the document.
 * Edits are ordered from end- to start-of-document.
 */
// - For VS Code to move all cursors meaningfully when reformatting,
// - there should be one replacement operation per insertion/removal of whitespace
// - (and none for non-whitespace)
export function reformatChanges(
  offset: number,
  previousText: string,
  formattedText: string
): ReformatChange[] {
  const a = spacedUnits(previousText);
  const b = spacedUnits(formattedText);
  // A single word in a or b may have been split into multiple words in the other (eg at punctuation).
  // Adjust a and b to the finest granularity of words in either of them.
  const [a2, b2] = alignSpacedUnits(a, b);
  // The result should be an equal number of words in a and b:
  if (a2.length != b2.length) {
    console.error('Uneven words in a and b', 'a2', a2, 'b2', b2);
    return [];
  }
  const ret: ReformatChange[] = [];
  let aPos = offset;
  for (let i = 0; i < a2.length; i++) {
    const aSpaces = a2[i][0];
    const bSpaces = b2[i][0];
    if (aSpaces != bSpaces) {
      const start: number = aPos;
      const end: number = aPos + aSpaces.length;
      const text: string = bSpaces;
      ret.unshift({ start, end, text });
    }
    aPos += a2[i][0].length + a2[i][1].length;
  }
  return ret;
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
  const dedupedRanges = nonOverlappingRanges(ranges);
  const wholeDocRange: [number, number] = [0, doc.getText().length];
  const wholeDoc =
    dedupedRanges.filter((r) => r[0] == wholeDocRange[0] && r[1] == wholeDocRange[1]).length > 0;
  const orderedChanges: ReformatChange[] = wholeDoc
    ? rangeReformatChanges(
        doc,
        new vscode.Range(doc.positionAt(wholeDocRange[0]), doc.positionAt(wholeDocRange[1]))
      )
    : dedupedRanges
        .map((rng) => rng[0])
        .flatMap((index) => {
          const formattedInfo = formatDocIndexInfo(doc, onType, index, extraConfig);
          return formattedInfo ? formattedInfo.changes : [];
        })
        .sort((a, b) => b.start - a.start);

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
let scheduledFormatCircumstances = undefined;
const scheduledFormatDelayMs = 250;

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
