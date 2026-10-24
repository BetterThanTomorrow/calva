import { ModelEdit, ModelEditSelection } from './cursor-doc/model';
import type { EditableDocument } from './cursor-doc/model';
import type { LispTokenCursor } from './cursor-doc/token-cursor';
import * as paredit from './cursor-doc/paredit';
import * as commentPrefix from './comment-prefix';
import { lineStartOffsets, rowColAt } from './cursor-doc/utilities';

export const TOGGLE_COMMENT_BEHAVIORS = [
  'ignoreCurrentForm',
  'ignoreParentForm',
  'commentCurrentLine',
] as const;

export type ToggleCommentBehavior = typeof TOGGLE_COMMENT_BEHAVIORS[number];

export function isToggleCommentBehavior(val: any): val is ToggleCommentBehavior {
  return TOGGLE_COMMENT_BEHAVIORS.includes(val);
}

export type OffsetRange = [number, number];

/**
 * Reformats the ranges, given last first, and ends the undo step that the
 * comment edit started, also when there are no ranges.
 */
export type ReformatRanges = (ranges: OffsetRange[]) => PromiseLike<unknown>;

type CandidatesMap = Map<number, number[]>;

type Lines = { texts: string[]; starts: number[] };

type Position = { line: number; character: number };

type LineSelection = {
  start: Position;
  end: Position;
  isEmpty: boolean;
  isReversed: boolean;
};

/** The document, its lines before the toggle, its selections, and the lines they touch */
type Toggle = {
  doc: EditableDocument;
  lines: Lines;
  selections: LineSelection[];
  affectedLineNumbers: number[];
};

/** Where the comment prefixes go, per line, before the selection start is taken into account */
type CommentColumns = {
  firstNonWS: Map<number, number>;
  insertion: Map<number, number>;
  aligned: number;
  partialSelectionStartColumn?: number;
  partialSelectionStartOffset?: number;
};

/** The comment prefixes and structure breaks to insert, and where the prefixes went */
type StructuralComments = {
  inserts: [number, string][];
  breakLines: Set<number>;
  insertionColumns: Map<number, number>;
};

type BreakScope = {
  affectedLineSet: Set<number>;
  partialSelectionStartOffset?: number;
  selectionEndOffset: number;
};

const IGNORE_FORM_BEHAVIORS: ToggleCommentBehavior[] = ['ignoreCurrentForm', 'ignoreParentForm'];

const COMMENT_EDIT_OPTIONS = { skipFormat: true, undoStopBefore: true, undoStopAfter: false };

function linesOf(doc: EditableDocument): Lines {
  const texts = doc.model.getText(0, Infinity).split(doc.model.lineEnding);
  return { texts, starts: lineStartOffsets(texts, doc.model.lineEndingLength) };
}

function positionAt(lines: Lines, offset: number): Position {
  const [line, character] = rowColAt(lines.starts, offset);
  return { line, character };
}

/** The offset of `position`, after clamping it to the text the way VS Code validates positions. */
function offsetAt(lines: Lines, { line, character }: Position): number {
  const validLine = Math.min(Math.max(line, 0), lines.texts.length - 1);
  const validCharacter = Math.min(Math.max(character, 0), lines.texts[validLine].length);
  return lines.starts[validLine] + validCharacter;
}

function firstNonWhitespaceIndex(text: string): number {
  const index = text.search(/\S/);
  return index === -1 ? text.length : index;
}

function isEmptyOrWhitespace(text: string): boolean {
  return firstNonWhitespaceIndex(text) === text.length;
}

function lineSelection(lines: Lines, selection: ModelEditSelection): LineSelection {
  return {
    start: positionAt(lines, selection.start),
    end: positionAt(lines, selection.end),
    isEmpty: selection.isCursor,
    isReversed: selection.isReversed,
  };
}

function getAffectedLineNumbers(selections: LineSelection[], lineCount: number): number[] {
  const affectedLines = new Set<number>();
  for (const selection of selections) {
    for (let line = selection.start.line; line <= selection.end.line; line++) {
      affectedLines.add(line);
    }
  }
  return Array.from(affectedLines)
    .filter((lineNum) => lineNum >= 0 && lineNum < lineCount)
    .sort((a, b) => a - b);
}

function toggleOf(doc: EditableDocument): Toggle {
  const lines = linesOf(doc);
  const selections = doc.selections.map((selection) => lineSelection(lines, selection));
  return {
    doc,
    lines,
    selections,
    affectedLineNumbers: getAffectedLineNumbers(selections, lines.texts.length),
  };
}

/**
 * Builds candidate positions where a comment prefix might start on each affected line:
 * first non-whitespace, then any selection start columns past that point.
 */
function commentCandidates({ lines, selections, affectedLineNumbers }: Toggle): CandidatesMap {
  return new Map(
    affectedLineNumbers.map((lineNum) => {
      const firstNonWhitespace = firstNonWhitespaceIndex(lines.texts[lineNum]);
      const selectionStarts = selections
        .filter((sel) => sel.start.line === lineNum && sel.start.character > firstNonWhitespace)
        .map((sel) => sel.start.character);
      return [lineNum, [firstNonWhitespace, ...selectionStarts]];
    })
  );
}

function areAllNonEmptyTargetLinesCommented(
  { lines, affectedLineNumbers }: Toggle,
  candidatesMap: CandidatesMap
): boolean {
  const nonEmptyLines = affectedLineNumbers.filter(
    (lineNum) => !isEmptyOrWhitespace(lines.texts[lineNum])
  );
  return (
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((lineNum) => {
      const candidates = candidatesMap.get(lineNum) ?? [];
      return commentPrefix.findCommentPrefixStart(lines.texts[lineNum], candidates) !== undefined;
    })
  );
}

/** Inserts at the same offset are merged, in the order given, so that the models agree on the result. */
function insertEdits(inserts: [number, string][]): ModelEdit<'insertString'>[] {
  const merged = new Map<number, string>();
  for (const [offset, text] of inserts) {
    merged.set(offset, (merged.get(offset) ?? '') + text);
  }
  return Array.from(merged.entries())
    .sort(([a], [b]) => b - a)
    .map(([offset, text]) => new ModelEdit('insertString', [offset, text]));
}

/** The selection start column, when the selection starts on `lineNum` past its first non-whitespace */
function partialStartColumn(
  selection: LineSelection,
  lineNum: number,
  firstNonWS: number
): number | undefined {
  if (selection.isEmpty || selection.start.line !== lineNum) {
    return undefined;
  }
  return selection.start.character > firstNonWS ? selection.start.character : undefined;
}

/** The comment column for each line, and the one column all lines align on when several lines are commented */
function commentColumns({ lines, selections: [selection], affectedLineNumbers }: Toggle) {
  const isMultiLine = affectedLineNumbers.length > 1;
  const firstNonWS = new Map(
    affectedLineNumbers.map((lineNum) => [lineNum, firstNonWhitespaceIndex(lines.texts[lineNum])])
  );
  const insertion = new Map(
    affectedLineNumbers.map((lineNum) => [
      lineNum,
      partialStartColumn(selection, lineNum, firstNonWS.get(lineNum)) ?? firstNonWS.get(lineNum),
    ])
  );
  const startsPartially =
    partialStartColumn(selection, selection.start.line, firstNonWS.get(selection.start.line)) !==
    undefined;
  const aligned = affectedLineNumbers
    .filter((lineNum) => !isEmptyOrWhitespace(lines.texts[lineNum]))
    .reduce<number | undefined>(
      (column, lineNum) => Math.min(column ?? Infinity, insertion.get(lineNum)),
      undefined
    );
  const columns: CommentColumns = {
    firstNonWS,
    insertion,
    aligned: aligned ?? 0,
    partialSelectionStartColumn:
      !selection.isEmpty && isMultiLine ? selection.start.character : undefined,
    partialSelectionStartOffset:
      isMultiLine && startsPartially ? offsetAt(lines, selection.start) : undefined,
  };
  return columns;
}

function insertionColumn(
  { lines, selections: [selection], affectedLineNumbers }: Toggle,
  columns: CommentColumns,
  lineNum: number
): number {
  const rawInsertionColumn =
    affectedLineNumbers.length > 1
      ? columns.aligned
      : columns.insertion.get(lineNum) ?? columns.firstNonWS.get(lineNum) ?? 0;
  const isSelectionStartLine =
    columns.partialSelectionStartColumn !== undefined && lineNum === selection.start.line;
  const firstLineInsertionColumn = isSelectionStartLine
    ? Math.max(rawInsertionColumn, columns.partialSelectionStartColumn)
    : rawInsertionColumn;
  return Math.min(firstLineInsertionColumn, lines.texts[lineNum].length);
}

/** Bracket at or beyond the selection end is outside the selection */
function isBeyondPartialSelection(probe: LispTokenCursor, scope: BreakScope): boolean {
  return (
    scope.partialSelectionStartOffset !== undefined && probe.offsetStart >= scope.selectionEndOffset
  );
}

/** Bracket whose matching open is at/before selection start, or on a non-affected line */
function opensOutsideSelection(probe: LispTokenCursor, scope: BreakScope): boolean {
  const finder = probe.clone();
  if (!finder.backwardList() || !scope.affectedLineSet.has(finder.line)) {
    return true;
  }
  return (
    scope.partialSelectionStartOffset !== undefined &&
    finder.offsetStart <= scope.partialSelectionStartOffset
  );
}

/** The first closing bracket from the cursor, on its line, that has to move out of the comment */
function closeToMove(cursor: LispTokenCursor, scope: BreakScope): number | false {
  const startLine = cursor.line;
  const probe = cursor.clone();
  while (!probe.atEnd() && probe.line === startLine) {
    const mustMove =
      probe.getToken().type === 'close' &&
      (isBeyondPartialSelection(probe, scope) || opensOutsideSelection(probe, scope));
    if (mustMove) {
      return probe.offsetStart;
    }
    probe.next();
  }
  return false;
}

/**
 * Resolves where a structural break should be inserted (or if it can be skipped)
 * for multiline commenting.
 *
 * Returns:
 * - an offset where break should be inserted (possibly adjusted), or
 * - `false` when the break can be skipped entirely.
 */
function resolveStructuralBreakOffset(
  doc: EditableDocument,
  wouldBreakWhere: number,
  scope: BreakScope
): number | false {
  const cursor = doc.getTokenCursor(wouldBreakWhere);
  if (cursor.getToken().type === 'close') {
    return closeToMove(cursor, scope);
  }
  const endCursor = cursor.clone();
  if (endCursor.forwardSexp(true, true, true)) {
    return scope.affectedLineSet.has(endCursor.line) ? false : wouldBreakWhere;
  }
  return wouldBreakWhere;
}

/** Where a closing bracket has to move to a new line so that the comment at `offset` keeps the structure */
function structureBreakOffset(
  doc: EditableDocument,
  offset: number,
  multiLineScope?: BreakScope
): number | false {
  const wouldBreakWhere = paredit._semiColonWouldBreakStructureWhere(doc, offset);
  if (wouldBreakWhere === false || !multiLineScope) {
    return wouldBreakWhere;
  }
  return resolveStructuralBreakOffset(doc, wouldBreakWhere, multiLineScope);
}

function structuralComments(toggle: Toggle, columns: CommentColumns): StructuralComments {
  const { doc, lines, selections, affectedLineNumbers } = toggle;
  const multiLineScope: BreakScope | undefined =
    affectedLineNumbers.length > 1
      ? {
          affectedLineSet: new Set(affectedLineNumbers),
          partialSelectionStartOffset: columns.partialSelectionStartOffset,
          selectionEndOffset: offsetAt(lines, selections[0].end),
        }
      : undefined;
  const comments: StructuralComments = {
    inserts: [],
    breakLines: new Set(),
    insertionColumns: new Map(),
  };
  for (const lineNum of [...affectedLineNumbers].sort((a, b) => b - a)) {
    const column = insertionColumn(toggle, columns, lineNum);
    comments.insertionColumns.set(lineNum, column);
    const insertionOffset = offsetAt(lines, { line: lineNum, character: column });
    comments.inserts.push([insertionOffset, ';; ']);
    const breakOffset = structureBreakOffset(doc, insertionOffset, multiLineScope);
    if (breakOffset !== false) {
      comments.breakLines.add(lineNum);
      comments.inserts.push([breakOffset, '\n' + lines.texts[lineNum].match(/^\s*/)[0]]);
    }
  }
  return comments;
}

function insertedLinesBefore(breakLines: Set<number>, line: number): number {
  return Array.from(breakLines).filter((breakLine) => breakLine < line).length;
}

function commentedCharacter(
  lineText: string,
  { character }: Position,
  insertionColumn: number | undefined,
  firstNonWS: number | undefined
): number {
  const newFirstNonWS = firstNonWhitespaceIndex(lineText);
  if (lineText.slice(newFirstNonWS).startsWith(';; ')) {
    const baseColumnForOffset = insertionColumn ?? firstNonWS ?? character;
    return newFirstNonWS + 3 + Math.max(0, character - baseColumnForOffset);
  }
  if (insertionColumn !== undefined && character >= insertionColumn) {
    return character + 3;
  }
  return character;
}

/** Moves a position from before the comment edit to where its text is after it, and after the reformat */
function positionMover(newLines: Lines, comments: StructuralComments, columns: CommentColumns) {
  return (pos: Position, keepAtInsertionColumn: boolean): Position => {
    const line = pos.line + insertedLinesBefore(comments.breakLines, pos.line);
    if (line >= newLines.texts.length) {
      return pos;
    }
    const insertionColumn = comments.insertionColumns.get(pos.line);
    if (keepAtInsertionColumn && pos.character === insertionColumn) {
      return { line, character: insertionColumn };
    }
    const lineText = newLines.texts[line];
    const character = commentedCharacter(
      lineText,
      pos,
      insertionColumn,
      columns.firstNonWS.get(pos.line)
    );
    return { line, character: Math.min(character, lineText.length) };
  };
}

/**
 * Inserts `;; ` comment prefixes for a single selection, using structural
 * analysis to push closing delimiters to new lines when a semicolon would
 * break form balance. Then reformats enclosing forms.
 */
async function applyStructuralCommentsToSingleSelectionLines(
  toggle: Toggle,
  reformatRanges: ReformatRanges
) {
  const {
    doc,
    selections: [selection],
    affectedLineNumbers,
  } = toggle;
  const columns = commentColumns(toggle);
  const comments = structuralComments(toggle, columns);

  await doc.model.edit(insertEdits(comments.inserts), COMMENT_EDIT_OPTIONS);

  if (affectedLineNumbers.length > 1) {
    await reformatRanges([]);
  } else {
    const shiftedLineNumbers = affectedLineNumbers.map(
      (lineNum) => lineNum + insertedLinesBefore(comments.breakLines, lineNum)
    );
    await reformatEnclosingFormsForLines(doc, shiftedLineNumbers, reformatRanges);
  }

  const newLines = linesOf(doc);
  const move = positionMover(newLines, comments, columns);
  const start = offsetAt(newLines, move(selection.start, !selection.isEmpty));
  const end = offsetAt(newLines, move(selection.end, false));
  doc.selections = [
    selection.isReversed ? new ModelEditSelection(end, start) : new ModelEditSelection(start, end),
  ];
}

function enclosingFormRange(doc: EditableDocument, offset: number): OffsetRange | undefined {
  const cursor = doc.getTokenCursor(offset);
  if (!cursor.backwardList()) {
    return undefined;
  }
  cursor.backwardUpList();
  const start = cursor.offsetStart;
  return cursor.forwardSexp() ? [start, cursor.offsetStart] : undefined;
}

function collectEnclosingFormRanges(doc: EditableDocument, lineNumbers: number[]): OffsetRange[] {
  const lines = linesOf(doc);
  const uniqueRanges = new Map<string, OffsetRange>();
  for (const lineNum of lineNumbers) {
    const character = firstNonWhitespaceIndex(lines.texts[lineNum] ?? '');
    const range = enclosingFormRange(doc, offsetAt(lines, { line: lineNum, character }));
    if (range) {
      uniqueRanges.set(`${range[0]}:${range[1]}`, range);
    }
  }
  return Array.from(uniqueRanges.values()).sort((a, b) => b[0] - a[0]);
}

/**
 * Reformats the enclosing forms for the given lines.
 */
function reformatEnclosingFormsForLines(
  doc: EditableDocument,
  affectedLineNumbers: number[],
  reformatRanges: ReformatRanges
) {
  return reformatRanges(collectEnclosingFormRanges(doc, affectedLineNumbers));
}

/** Removes any leading semicolon sequence plus trailing spaces, `undefined` when the line has none. */
function uncommentEdit(lines: Lines, lineNum: number, candidates: number[]) {
  const lineText = lines.texts[lineNum];
  const removalStart = commentPrefix.findCommentPrefixStart(lineText, candidates);
  if (removalStart === undefined) {
    return undefined;
  }
  const removalEnd = commentPrefix.calculateCommentPrefixRemovalEnd(lineText, removalStart);
  if (removalEnd === undefined) {
    return undefined;
  }
  return new ModelEdit('deleteRange', [
    lines.starts[lineNum] + removalStart,
    removalEnd - removalStart,
  ]);
}

/**
 * Adds or removes comment prefixes on the affected lines.
 * When uncommenting, removes any leading semicolon sequence plus trailing spaces.
 * When commenting, inserts `;; `.
 */
function lineCommentEdits(
  { lines, affectedLineNumbers }: Toggle,
  shouldUncomment: boolean,
  candidatesMap: CandidatesMap
): ModelEdit<'deleteRange' | 'insertString'>[] {
  return [...affectedLineNumbers]
    .sort((a, b) => b - a)
    .map((lineNum) =>
      shouldUncomment
        ? uncommentEdit(lines, lineNum, candidatesMap.get(lineNum) ?? [])
        : new ModelEdit('insertString', [
            lines.starts[lineNum] + firstNonWhitespaceIndex(lines.texts[lineNum]),
            ';; ',
          ])
    )
    .filter((edit) => edit !== undefined);
}

/**
 * Returns true if the cursor is currently positioned within a ;; line comment.
 */
function isCursorInLineComment(doc: EditableDocument, offset: number): boolean {
  const cursor = doc.getTokenCursor(offset);
  return cursor.getToken().type === 'comment' || cursor.getPrevToken().type === 'comment';
}

function isLoneCursorOutsideComments(doc: EditableDocument): boolean {
  if (doc.selections.length !== 1) {
    return false;
  }
  const [selection] = doc.selections;
  return selection.isCursor && !isCursorInLineComment(doc, selection.active);
}

/**
 * Toggle line comments with Clojure-aware indentation.
 *
 * - When the cursor has no selection and is not in a line comment, `behavior` decides:
 *   - `ignoreCurrentForm`: Toggle `#_` on the current form
 *   - `ignoreParentForm`: Toggle `#_` on the enclosing/parent form
 *   - `commentCurrentLine`: Use `;;` line comment (classic behavior)
 * - For a single selection (cursor or range), comments are inserted structurally
 *   using paredit structural analysis to preserve delimiter balance, then
 *   enclosing forms are reformatted with `reformatRanges`.
 * - For multiple selections or when uncommenting, adds/removes `;; ` prefixes
 *   and reformats enclosing forms with `reformatRanges`.
 */
export async function toggleLineComment(
  doc: EditableDocument,
  behavior: ToggleCommentBehavior,
  reformatRanges: ReformatRanges
) {
  if (IGNORE_FORM_BEHAVIORS.includes(behavior) && isLoneCursorOutsideComments(doc)) {
    return paredit.toggleIgnoreForm(doc, behavior === 'ignoreParentForm');
  }

  const toggle = toggleOf(doc);
  if (toggle.affectedLineNumbers.length === 0) {
    return;
  }

  const candidatesMap = commentCandidates(toggle);
  const allNonEmptyLinesCommented = areAllNonEmptyTargetLinesCommented(toggle, candidatesMap);
  if (!allNonEmptyLinesCommented && toggle.selections.length === 1) {
    return applyStructuralCommentsToSingleSelectionLines(toggle, reformatRanges);
  }

  await doc.model.edit(
    lineCommentEdits(toggle, allNonEmptyLinesCommented, candidatesMap),
    COMMENT_EDIT_OPTIONS
  );
  return reformatEnclosingFormsForLines(doc, toggle.affectedLineNumbers, reformatRanges);
}
