import * as vscode from 'vscode';
import * as cljsLib from '../../../out/cljs-lib/cljs-lib';
import _ = require('lodash');
import * as docMirror from '../../doc-mirror/index';
import { indent } from './indent';

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
    r: ResultOptions = cljsLib.inferParens({
      text: currentText,
      line: position.line,
      character: position.character,
      'previous-line': position.line,
      'previous-character': position.character,
    });
  applyResults(r, editor);
}

export function indentCommand(editor: vscode.TextEditor, spacing: string, forward: boolean = true) {
  indent(docMirror.getDocument(editor.document), spacing, forward).catch((e: Error) => {
    void vscode.window.showErrorMessage('Calva Formatter Error: ' + e.message);
  });
}

function applyResults(r: ResultOptions, editor: vscode.TextEditor) {
  if (r.success) {
    void editor
      .edit(
        (editBuilder) => {
          if (_.isUndefined(r.edits)) {
            console.error('Edits were undefined!', _.cloneDeep({ editBuilder, r, editor }));
            return;
          }
          r.edits.forEach((edit: CFEdit) => {
            const start = new vscode.Position(edit.start.line, edit.start.character),
              end = new vscode.Position(edit.end.line, edit.end.character);
            if (_.isUndefined(edit.text)) {
              console.error(
                'edit.text was undefined!',
                _.cloneDeep({ edit, editBuilder, r, editor })
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
