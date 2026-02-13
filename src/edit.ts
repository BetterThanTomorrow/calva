import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';
import { EditableDocument, ModelEdit } from './cursor-doc/model';
import * as select from './select';
import * as printer from './printer';
import * as config from './formatter-config';
import { calculateIndentFixes } from './cursor-doc/indent-utils';
import * as paredit from './cursor-doc/paredit';

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

async function normalizeLineIndent(
  editor: vscode.TextEditor,
  lineNum: number,
  expectedIndent: number,
  currentIndent: number
) {
  if (currentIndent === expectedIndent) {
    return;
  }
  await editor.edit(
    (editBuilder) => {
      if (currentIndent > expectedIndent) {
        editBuilder.delete(
          new vscode.Range(
            new vscode.Position(lineNum, 0),
            new vscode.Position(lineNum, currentIndent - expectedIndent)
          )
        );
      } else {
        editBuilder.insert(
          new vscode.Position(lineNum, 0),
          ' '.repeat(expectedIndent - currentIndent)
        );
      }
    },
    {
      undoStopAfter: false,
      undoStopBefore: false,
    }
  );
}

/**
 * Applies structural `;; ` insertion line-by-line for a single selection.
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
    const currentDocument = editor.document;
    const currentLine = currentDocument.lineAt(lineNum);
    const lineStartOffset = currentDocument.offsetAt(new vscode.Position(lineNum, 0));
    const mirrorDoc = docMirror.getDocument(currentDocument);
    const formatterConfig = config.getConfigNow(currentDocument);
    const expectedIndent = docMirror.getIndent(
      mirrorDoc.model.lineInputModel,
      lineStartOffset,
      formatterConfig
    );

    await normalizeLineIndent(
      editor,
      lineNum,
      expectedIndent,
      currentLine.firstNonWhitespaceCharacterIndex
    );

    const lineAfterIndent = editor.document.lineAt(lineNum);
    const insertionColumn = lineAfterIndent.firstNonWhitespaceCharacterIndex;
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

  editor.selections = originalSelections.map((selection) => {
    const finalCursorPos = lineToCursorPos.get(selection.active.line) ?? selection.active;
    return new vscode.Selection(finalCursorPos, finalCursorPos);
  });
}

/**
 * Uses VS Code's line-comment toggle, then restores Clojure-aware indentation
 * for affected lines to avoid alignment drift in forms such as `assoc`.
 */
async function toggleCommentsThenApplyIndentCorrections(
  editor: vscode.TextEditor,
  document: vscode.TextDocument,
  affectedLineNumbers: number[]
) {
  await vscode.commands.executeCommand('editor.action.commentLine');

  const doc = docMirror.getDocument(document);
  const formatterConfig = config.getConfigNow(document);
  const lineInfos = affectedLineNumbers.map((lineNum) => {
    const line = document.lineAt(lineNum);
    return {
      lineNum,
      currentIndent: line.firstNonWhitespaceCharacterIndex,
      isEmpty: line.isEmptyOrWhitespace,
    };
  });

  const fixes = calculateIndentFixes(lineInfos, (lineNum) => {
    const lineStart = document.offsetAt(new vscode.Position(lineNum, 0));
    return docMirror.getIndent(doc.model.lineInputModel, lineStart, formatterConfig);
  });

  if (fixes.length === 0) {
    return;
  }

  await editor.edit(
    (editBuilder) => {
      for (const fix of fixes) {
        if (fix.delta > 0) {
          editBuilder.delete(
            new vscode.Range(
              new vscode.Position(fix.line, 0),
              new vscode.Position(fix.line, fix.delta)
            )
          );
        } else if (fix.delta < 0) {
          editBuilder.insert(new vscode.Position(fix.line, 0), ' '.repeat(-fix.delta));
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
 * Toggle line comments with Clojure-aware indentation.
 *
 * - For a single selection (cursor or range), comments are inserted structurally
 *   using Paredit semicolon insertion, preserving delimiter structure.
 * - Otherwise, falls back to VS Code's comment toggle and then reapplies Clojure-aware
 *   indentation fixes for affected lines.
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

  await toggleCommentsThenApplyIndentCorrections(editor, document, affectedLineNumbers);
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
