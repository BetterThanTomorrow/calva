import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';
import * as model from './cursor-doc/model';
import * as getText from './util/get-text';
import * as printer from './printer';
import * as format from './calva-fmt/src/format';
import * as toggleComment from './toggle-comment';
import { isTextEditor } from './util/editor-utils';
import * as replInput from './repl-input';

// Relies on that `when` claus guards this from being called
// when the cursor is before the comment marker
export function continueCommentCommand() {
  const editor = util.tryToGetActiveTextEditor();
  if (editor?.document.languageId === 'clojure') {
    const document = editor.document;
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

type OffsetRange = toggleComment.OffsetRange;
type ToggleCommentBehavior = toggleComment.ToggleCommentBehavior;

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
 * Reformats the ranges in the editor, ending the undo step also when there are no ranges.
 */
async function reformatRangesEndingUndoStep(editor: vscode.TextEditor, ranges: OffsetRange[]) {
  if (ranges.length === 0) {
    await editor.edit(() => undefined, { undoStopBefore: false, undoStopAfter: true });
    return;
  }
  await reformatRanges(editor, ranges);
}

/**
 * Toggle line comments with Clojure-aware indentation, in the active editor.
 *
 * When the cursor has no selection and is not in a line comment, the behavior
 * is determined by the optional argument (when invoked via a keybinding with args)
 * or the `calva.paredit.toggleCommentBehavior` setting (default `ignoreParentForm`).
 * See `toggleComment.toggleLineComment` for the behaviors.
 */
export async function toggleLineCommentCommand(behaviorArg?: ToggleCommentBehavior) {
  if (behaviorArg !== undefined && !toggleComment.isToggleCommentBehavior(behaviorArg)) {
    throw new Error(`Invalid argument for toggleLineComment: ${behaviorArg}`);
  }
  const behavior =
    behaviorArg ??
    vscode.workspace
      .getConfiguration('calva.paredit')
      .get<ToggleCommentBehavior>('toggleCommentBehavior', 'ignoreParentForm');
  if (replInput.hasFocus()) {
    return replInput.editFocused((doc) =>
      toggleComment.toggleLineComment(doc, behavior, (ranges) =>
        Promise.resolve(replInput.reformatRanges(doc, ranges))
      )
    );
  }

  const editor = util.tryToGetActiveTextEditor();
  if (editor?.document.languageId !== 'clojure') {
    return;
  }

  return toggleComment.toggleLineComment(
    docMirror.getDocument(editor.document),
    behavior,
    (ranges) => reformatRangesEndingUndoStep(editor, ranges)
  );
}

/**
 * Replaces text in a Clojure document within the given range.
 *
 * @param editorOrDocument When a `TextEditor` is provided, uses `TextEditor.edit()`
 *   with undo grouping, formatting, and selection restoration (the interactive editing path).
 *   When a `TextDocument` is provided, uses `WorkspaceEdit` via `vscode.workspace.applyEdit()`,
 *   which requires no visible editor and causes no UI side effects — suitable for
 *   programmatic/API edits. Formatting is automatically skipped since it requires a visible editor.
 * @param range The document range to replace.
 * @param newText The replacement text.
 * @param options Edit options forwarded to `DocumentModel.edit()`.
 */
export function replace(
  editorOrDocument: vscode.TextEditor | vscode.TextDocument,
  range: vscode.Range,
  newText: string,
  options = {}
) {
  const hasEditor = isTextEditor(editorOrDocument);
  const document = hasEditor ? editorOrDocument.document : editorOrDocument;
  const mirrorDoc: model.EditableDocument = docMirror.getDocument(document);
  return mirrorDoc.model.edit(
    [
      new model.ModelEdit('changeRange', [
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
      // Without a TextEditor, formatting and selection restoration can't work,
      // so force skipFormat to route through WorkspaceEdit.
      ...(hasEditor ? { editor: editorOrDocument } : { skipFormat: true }),
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
    ? getText.currentFormText(document, selection.active)[0]
    : selection;
  const text = document.getText(range);
  const result = printer.prettyPrint(text, options);
  if (result.error) {
    void vscode.window.showErrorMessage(`${result.error}`, 'OK');
    return;
  }
  return replace(editor, range, result.value);
}
