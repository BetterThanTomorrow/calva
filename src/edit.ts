import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';
import { EditableDocument, ModelEdit } from './cursor-doc/model';
import * as select from './select';
import * as printer from './printer';
import * as paredit from './cursor-doc/paredit';
import * as format from './calva-fmt/src/format';

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
      return lineText.startsWith(';;');
    })
  );
}

/**
 * Applies structural `;; ` insertion line-by-line for a single selection,
 * then reformats enclosing forms for affected lines.
 * Processes lines bottom-up so cursor/offset shifts from one line do not
 * invalidate positions for yet to be processed lines.
 */
async function applyStructuralCommentsToSingleSelectionLines(
  editor: vscode.TextEditor,
  affectedLineNumbers: number[]
) {
  const originalSelections = [...editor.selections];
  const lineToCursorPos = new Map<number, vscode.Position>();
  const descendingLineNumbers = [...new Set(affectedLineNumbers)].sort((a, b) => b - a);

  for (const lineNum of descendingLineNumbers) {
    const currentLine = editor.document.lineAt(lineNum);
    const insertionColumn = currentLine.firstNonWhitespaceCharacterIndex;
    const insertionPos = new vscode.Position(lineNum, insertionColumn);
    editor.selections = [new vscode.Selection(insertionPos, insertionPos)];

    await paredit.insertSemiColon(docMirror.getDocument(editor.document));

    const secondInsertPos = editor.selections[0].active;
    await editor.edit(
      (editBuilder) => {
        editBuilder.insert(secondInsertPos, '; ');
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      }
    );

    const finalCursorPos = editor.selections[0].active;
    lineToCursorPos.set(lineNum, finalCursorPos);
  }

  await reformatEnclosingFormsForLines(editor, affectedLineNumbers);

  editor.selections = originalSelections.map((selection) => {
    const finalCursorPos = lineToCursorPos.get(selection.active.line) ?? selection.active;
    return new vscode.Selection(finalCursorPos, finalCursorPos);
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

async function reformatRanges(editor: vscode.TextEditor, ranges: OffsetRange[]) {
  for (const [start, end] of ranges) {
    const range = new vscode.Range(
      editor.document.positionAt(start),
      editor.document.positionAt(end)
    );
    await format.formatRange(editor.document, range);
  }
}

async function reformatEnclosingFormsForLines(
  editor: vscode.TextEditor,
  affectedLineNumbers: number[]
) {
  const ranges = collectEnclosingFormRanges(editor.document, affectedLineNumbers);
  if (ranges.length === 0) {
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
          if (!remainder.startsWith(';;')) {
            continue;
          }

          let removalEnd = firstNonWhitespace + 2;
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
      undoStopAfter: false,
      undoStopBefore: false,
    }
  );
}

/**
 * Uses VS Code's line-comment toggle, then reformats enclosing forms for
 * affected lines to restore canonical Clojure formatting.
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
