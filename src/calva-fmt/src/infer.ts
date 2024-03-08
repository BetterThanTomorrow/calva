import * as vscode from 'vscode';
import { inferParens, inferIndents } from '../../../out/cljs-lib/cljs-lib';
import { isUndefined, cloneDeep } from 'lodash';

interface CFEdit {
  edit: string;
  start: { line: number; character: number };
  end: { line: number; character: number };
  text?: string;
}

interface CFError {
  message: string;
}

interface ResultOptions {
  success: boolean;
  edits?: [CFEdit];
  line?: number;
  character?: number;
  error?: CFError;
  'error-msg'?: string;
}

export function inferParensCommand(editor: vscode.TextEditor) {
  const position: vscode.Position = editor.selections[0].active,
    document = editor.document,
    currentText = document.getText(),
    r: ResultOptions = inferParens({
      text: currentText,
      line: position.line,
      character: position.character,
      'previous-line': position.line,
      'previous-character': position.character,
    });
  applyResults(r, editor);
}

export function indentCommand(editor: vscode.TextEditor, spacing: string, forward: boolean = true) {
  const prevPosition: vscode.Position = editor.selections[0].active,
    document = editor.document;
  let deletedText = '',
    doEdit = true;

  void editor
    .edit(
      (editBuilder) => {
        if (forward) {
          editBuilder.insert(
            new vscode.Position(prevPosition.line, prevPosition.character),
            spacing
          );
        } else {
          const startOfLine = new vscode.Position(prevPosition.line, 0),
            headRange = new vscode.Range(startOfLine, prevPosition),
            headText = document.getText(headRange),
            xOfFirstLeadingSpace = headText.search(/ *$/),
            leadingSpaces =
              xOfFirstLeadingSpace >= 0 ? prevPosition.character - xOfFirstLeadingSpace : 0;
          if (leadingSpaces > 0) {
            const spacingSize = Math.max(spacing.length, 1),
              deleteRange = new vscode.Range(prevPosition.translate(0, -spacingSize), prevPosition);
            deletedText = document.getText(deleteRange);
            editBuilder.delete(deleteRange);
          } else {
            doEdit = false;
          }
        }
      },
      { undoStopAfter: false, undoStopBefore: false }
    )
    .then((_onFulfilled: boolean) => {
      if (doEdit) {
        const position: vscode.Position = editor.selections[0].active,
          currentText = document.getText(),
          r: ResultOptions = inferIndents({
            text: currentText,
            line: position.line,
            character: position.character,
            'previous-line': prevPosition.line,
            'previous-character': prevPosition.character,
            changes: [
              {
                line: forward ? prevPosition.line : position.line,
                character: forward ? prevPosition.character : position.character,
                'old-text': forward ? '' : deletedText,
                'new-text': forward ? spacing : '',
              },
            ],
          });
        applyResults(r, editor);
      }
    });
}

function applyResults(r: ResultOptions, editor: vscode.TextEditor) {
  if (r.success) {
    void editor
      .edit(
        (editBuilder) => {
          if (isUndefined(r.edits)) {
            console.error('Edits were undefined!', cloneDeep({ editBuilder, r, editor }));
            return;
          }
          r.edits.forEach((edit: CFEdit) => {
            const start = new vscode.Position(edit.start.line, edit.start.character),
              end = new vscode.Position(edit.end.line, edit.end.character);
            if (isUndefined(edit.text)) {
              console.error(
                'edit.text was undefined!',
                cloneDeep({ edit, editBuilder, r, editor })
              );
              return;
            }
            editBuilder.replace(new vscode.Range(start, end), edit.text);
          });
        },
        { undoStopAfter: true, undoStopBefore: false }
      )
      .then((_onFulfilled: boolean) => {
        // these will never be undefined in practice:
        // https://github.com/BetterThanTomorrow/calva/blob/5d23da5704989e000b1f860fc09f5935d7bac3f5/src/cljs-lib/src/calva/fmt/editor.cljs#L5-L21
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
        const newPosition = new vscode.Position(r.line!, r.character!);
        editor.selections = [new vscode.Selection(newPosition, newPosition)];
      });
  } else {
    void vscode.window.showErrorMessage(
      'Calva Formatter Error: ' + (r.error ? r.error.message : r['error-msg'])
    );
  }
}

export function updateState(editor: vscode.TextEditor) {
  // do nothing
}
