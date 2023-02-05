import vscode from 'vscode';
import util from './utilities';
import docMirror from './doc-mirror/index';
import { EditableDocument, ModelEdit } from './cursor-doc/model';
import select from './select';
import printer from './printer';

// Relies on that `when` claus guards this from being called
// when the cursor is before the comment marker
export function continueCommentCommand() {
  const document = util.tryToGetDocument({});
  if (document && document.languageId === 'clojure') {
    const editor = util.getActiveTextEditor();
    const position = editor.selection.active;
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
          editor.selection = new vscode.Selection(newPosition, newPosition);
        }
      });
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

export function prettyPrintReplaceCurrentForm(options = { enabled: true }) {
  const editor = util.getActiveTextEditor();
  const document = editor.document;
  const selection = editor.selection;
  const range = selection.isEmpty
    ? select.getFormSelection(document, selection.active, false)
    : selection;
  const text = document.getText(range);
  const result = printer.prettyPrint(text, { ...options, 'map-commas?': false });
  if (result) {
    return replace(editor, range, result.value);
  }
}
