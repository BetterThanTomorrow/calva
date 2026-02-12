import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';
import { EditableDocument, ModelEdit } from './cursor-doc/model';
import * as select from './select';
import * as printer from './printer';
import * as config from './formatter-config';
import { calculateIndentFixes } from './cursor-doc/indent-utils';

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

/**
 * Wraps editor.action.commentLine to fix indentation of commented lines.
 * VS Code's default comment command doesn't use Clojure-aware indentation,
 * so alignment-based indents (e.g., assoc args) end up wrong.
 * This command delegates to the built-in, then fixes indent using Calva's getIndent().
 */
export async function toggleLineCommentCommand() {
  const document = util.tryToGetDocument({});
  if (document && document.languageId === 'clojure') {
    const editor = util.getActiveTextEditor();

    const affectedLines = new Set<number>();
    for (const selection of editor.selections) {
      for (let line = selection.start.line; line <= selection.end.line; line++) {
        affectedLines.add(line);
      }
    }

    await vscode.commands.executeCommand('editor.action.commentLine');

    const doc = docMirror.getDocument(document);
    const formatterConfig = config.getConfigNow(document);

    const lineInfos = Array.from(affectedLines).map((lineNum) => {
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

    if (fixes.length > 0) {
      const edits: vscode.TextEdit[] = fixes.map((fix) => {
        if (fix.delta > 0) {
          return vscode.TextEdit.delete(
            new vscode.Range(
              new vscode.Position(fix.line, 0),
              new vscode.Position(fix.line, fix.delta)
            )
          );
        } else {
          return vscode.TextEdit.insert(new vscode.Position(fix.line, 0), ' '.repeat(-fix.delta));
        }
      });

      await editor.edit(
        (editBuilder) => {
          for (const edit of edits) {
            if (edit.newText === '') {
              editBuilder.delete(edit.range);
            } else {
              editBuilder.replace(edit.range, edit.newText);
            }
          }
        },
        {
          undoStopAfter: false,
          undoStopBefore: false,
        }
      );
    }
  }
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
