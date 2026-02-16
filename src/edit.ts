import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';
import { EditableDocument, ModelEdit } from './cursor-doc/model';
import * as select from './select';
import * as printer from './printer';
import { _semiColonWouldBreakStructureWhere } from './cursor-doc/paredit';
import * as format from './calva-fmt/src/format';

/** Matches one or more leading semicolons (`;`, `;;`, `;;;`, etc.) */
const commentPrefixPattern = /^;+/;

// Relies on that `when` claus guards this from being called
// when the cursor is before the comment marker
export function continueCommentCommand() {
  const document = util.tryToGetDocument({});
  if (document && document.languageId === 'clojure') {
    const editor = util.getActiveTextEditor();
    const position = editor.selections[0].active;
    const cursor = docMirror.getDocument(document).getTokenCursor();
    if (cursor.getToken().type !== 'comment') {
      if (cursor.getPrevToken().type === 'comment') {
        cursor.previous();
      } else {
        return;
      }
    }
    const commentOffset = cursor.rowCol[1];
    const commentText = cursor.getToken().raw;
    const [_1, startText, bullet, num] = commentText.match(/^([;\s]+)([*-] +|(\d+)\. +)?/) ?? [];
    const newNum = num ? parseInt(num) + 1 : undefined;
    const bulletText = newNum ? bullet.replace(/\d+/, '' + newNum) : bullet;
    const pad = ' '.repeat(commentOffset);
    const newText = `${pad}${startText}${bullet ? bulletText : ''}`;
    void editor
      .edit((edits) => edits.insert(position, `\n${newText}`), {
        undoStopAfter: false,
        undoStopBefore: true,
      })
      .then((fulfilled) => {
        if (fulfilled) {
          const newPosition = position.with(position.line + 1, newText.length);
          editor.selections = [new vscode.Selection(newPosition, newPosition)];
        }
      });
  }
}

function getAffectedLineNumbers(editor: vscode.TextEditor, lineCount: number): number[] {
  const affectedLines = new Set<number>();
  for (const selection of editor.selections) {
    for (let line = selection.start.line; line <= selection.end.line; line++) {
      affectedLines.add(line);
    }
  }
  return Array.from(affectedLines)
    .filter((lineNum) => lineNum >= 0 && lineNum < lineCount)
    .sort((a, b) => a - b);
}

function areAllNonEmptyTargetLinesCommented(
  document: vscode.TextDocument,
  lineNumbers: number[]
): boolean {
  const nonEmptyLines = lineNumbers.filter(
    (lineNum) => !document.lineAt(lineNum).isEmptyOrWhitespace
  );
  return (
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((lineNum) => {
      const line = document.lineAt(lineNum);
      const lineText = line.text.slice(line.firstNonWhitespaceCharacterIndex);
      return commentPrefixPattern.test(lineText);
    })
  );
}

/**
 * Inserts `;; ` comment prefixes for a single selection, using structural
 * analysis to push closing delimiters to new lines when a semicolon would
 * break form balance. Then reformats enclosing forms.
 */
async function applyStructuralCommentsToSingleSelectionLines(
  editor: vscode.TextEditor,
  affectedLineNumbers: number[]
) {
  const originalSelections = [...editor.selections];
  const descendingLineNumbers = [...new Set(affectedLineNumbers)].sort((a, b) => b - a);
  const mirrorDoc = docMirror.getDocument(editor.document);
  const structureBreakLineNums = new Set<number>();

  // Single atomic edit for all comment insertions
  await editor.edit(
    (editBuilder) => {
      for (const lineNum of descendingLineNumbers) {
        const currentLine = editor.document.lineAt(lineNum);
        const insertionColumn = currentLine.firstNonWhitespaceCharacterIndex;
        const insertionOffset = editor.document.offsetAt(
          new vscode.Position(lineNum, insertionColumn)
        );

        const wouldBreakWhere = _semiColonWouldBreakStructureWhere(mirrorDoc, insertionOffset);

        editBuilder.insert(new vscode.Position(lineNum, insertionColumn), ';; ');

        if (wouldBreakWhere !== false) {
          structureBreakLineNums.add(lineNum);
          const indent = currentLine.text.match(/^\s*/)[0];
          editBuilder.insert(editor.document.positionAt(wouldBreakWhere), '\n' + indent);
        }
      }
    },
    {
      undoStopBefore: true,
      undoStopAfter: false,
    }
  );

  // Compute shifted line numbers (structure breaks insert newlines, pushing later lines down)
  const shiftedLineNumbers = affectedLineNumbers.map((lineNum) => {
    let shift = 0;
    for (const breakLineNum of structureBreakLineNums) {
      if (breakLineNum < lineNum) {
        shift++;
      }
    }
    return lineNum + shift;
  });

  await reformatEnclosingFormsForLines(editor, shiftedLineNumbers);

  // Cursor positions captured after formatting so indentation changes are reflected
  editor.selections = originalSelections.map((selection) => {
    const originalLineNum = selection.active.line;
    let shift = 0;
    for (const breakLineNum of structureBreakLineNums) {
      if (breakLineNum < originalLineNum) {
        shift++;
      }
    }
    const shiftedLine = originalLineNum + shift;

    if (shiftedLine < editor.document.lineCount) {
      const line = editor.document.lineAt(shiftedLine);
      const firstNonWS = line.firstNonWhitespaceCharacterIndex;
      const lineContent = line.text.slice(firstNonWS);
      if (lineContent.startsWith(';; ')) {
        const pos = new vscode.Position(shiftedLine, firstNonWS + 3);
        return new vscode.Selection(pos, pos);
      }
    }

    return selection;
  });
}

type OffsetRange = [number, number];

function collectEnclosingFormRanges(
  document: vscode.TextDocument,
  lineNumbers: number[]
): OffsetRange[] {
  const uniqueRanges = new Map<string, OffsetRange>();

  for (const lineNum of lineNumbers) {
    const line = document.lineAt(lineNum);
    const position = new vscode.Position(lineNum, line.firstNonWhitespaceCharacterIndex);
    const enclosing = select.getEnclosingFormSelection(document, position);
    if (!enclosing) {
      continue;
    }
    const range: OffsetRange = [
      document.offsetAt(enclosing.start),
      document.offsetAt(enclosing.end),
    ];
    uniqueRanges.set(`${range[0]}:${range[1]}`, range);
  }

  return Array.from(uniqueRanges.values()).sort((a, b) => b[0] - a[0]);
}

/**
 * Applies formatting edits for each range sequentially (descending by offset)
 * because formatting one range may shift positions in later ranges.
 */
async function reformatRanges(editor: vscode.TextEditor, ranges: OffsetRange[]) {
  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    const range = new vscode.Range(
      editor.document.positionAt(start),
      editor.document.positionAt(end)
    );
    const edits = format.formatRangeEdits(editor.document, range);
    const isLast = i === ranges.length - 1;

    if (!edits || edits.length === 0) {
      if (isLast) {
        await editor.edit(() => undefined, { undoStopBefore: false, undoStopAfter: true });
      }
      continue;
    }

    await editor.edit(
      (editBuilder) => {
        for (const edit of edits) {
          editBuilder.replace(edit.range, edit.newText);
        }
      },
      {
        undoStopBefore: false,
        undoStopAfter: isLast,
      }
    );
  }
}

/**
 * Reformats the enclosing forms for the given lines.
 */
async function reformatEnclosingFormsForLines(
  editor: vscode.TextEditor,
  affectedLineNumbers: number[]
) {
  const ranges = collectEnclosingFormRanges(editor.document, affectedLineNumbers);
  if (ranges.length === 0) {
    await editor.edit(() => undefined, { undoStopBefore: false, undoStopAfter: true });
    return;
  }

  await reformatRanges(editor, ranges);
}

async function updateLineComments(
  editor: vscode.TextEditor,
  affectedLineNumbers: number[],
  shouldUncomment: boolean
) {
  const descendingLineNumbers = [...new Set(affectedLineNumbers)].sort((a, b) => b - a);

  await editor.edit(
    (editBuilder) => {
      for (const lineNum of descendingLineNumbers) {
        const line = editor.document.lineAt(lineNum);
        const firstNonWhitespace = line.firstNonWhitespaceCharacterIndex;
        const lineText = line.text;
        const remainder = lineText.slice(firstNonWhitespace);

        if (shouldUncomment) {
          const match = remainder.match(commentPrefixPattern);
          if (!match) {
            continue;
          }

          let removalEnd = firstNonWhitespace + match[0].length;
          while (removalEnd < lineText.length && lineText[removalEnd] === ' ') {
            removalEnd++;
          }

          editBuilder.delete(
            new vscode.Range(
              new vscode.Position(lineNum, firstNonWhitespace),
              new vscode.Position(lineNum, removalEnd)
            )
          );
        } else {
          editBuilder.insert(new vscode.Position(lineNum, firstNonWhitespace), ';; ');
        }
      }
    },
    {
      undoStopBefore: true,
      undoStopAfter: false,
    }
  );
}

/**
 * Adds or removes line-comment prefixes, then reformats enclosing forms to
 * restore canonical Clojure indentation. Used for multi-selection commenting
 * and for all uncommenting.
 */
async function toggleCommentsThenReformatEnclosingForms(
  editor: vscode.TextEditor,
  affectedLineNumbers: number[],
  shouldUncomment: boolean
) {
  await updateLineComments(editor, affectedLineNumbers, shouldUncomment);
  await reformatEnclosingFormsForLines(editor, affectedLineNumbers);
}

/**
 * Toggle line comments with Clojure-aware indentation.
 *
 * - For a single selection (cursor or range), comments are inserted structurally
 *   using Paredit semicolon insertion, preserving delimiter structure, and then
 *   enclosing forms are reformatted.
 * - Otherwise, falls back to VS Code's comment toggle and then reformats enclosing
 *   forms for affected lines.
 */
export async function toggleLineCommentCommand() {
  const document = util.tryToGetDocument({});
  if (!document || document.languageId !== 'clojure') {
    return;
  }

  const editor = util.getActiveTextEditor();
  if (!editor) {
    return;
  }

  const affectedLineNumbers = getAffectedLineNumbers(editor, document.lineCount);
  if (affectedLineNumbers.length === 0) {
    return;
  }

  const allNonEmptyLinesCommented = areAllNonEmptyTargetLinesCommented(
    document,
    affectedLineNumbers
  );

  const isSingleSelection = editor.selections.length === 1;
  if (!allNonEmptyLinesCommented && isSingleSelection) {
    await applyStructuralCommentsToSingleSelectionLines(editor, affectedLineNumbers);
    return;
  }

  await toggleCommentsThenReformatEnclosingForms(
    editor,
    affectedLineNumbers,
    allNonEmptyLinesCommented
  );
}

export function replace(
  editor: vscode.TextEditor,
  range: vscode.Range,
  newText: string,
  options = {}
) {
  const document = editor.document;
  const mirrorDoc: EditableDocument = docMirror.getDocument(document);
  return mirrorDoc.model.edit(
    [
      new ModelEdit('changeRange', [
        document.offsetAt(range.start),
        document.offsetAt(range.end),
        newText,
      ]),
    ],
    {
      ...{
        undoStopBefore: true,
      },
      ...options,
    }
  );
}

export function prettyPrintReplaceCurrentForm(
  options = { map: { 'sort?': false, 'comma?': false } }
) {
  const editor = util.getActiveTextEditor();
  const document = editor.document;
  const selection = editor.selections[0];
  const range = selection.isEmpty
    ? select.getFormSelection(document, selection.active, false)
    : selection;
  const text = document.getText(range);
  const result = printer.prettyPrint(text, options);
  if (result.error) {
    void vscode.window.showErrorMessage(`${result.error}`, 'OK');
    return;
  }
  return replace(editor, range, result.value);
}
