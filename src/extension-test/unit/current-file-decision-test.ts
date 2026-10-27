import * as assert from 'assert';
import type * as vscode from 'vscode';
import { decideCurrentFileUri } from '../../current-file-decision';

function uri(path: string): vscode.Uri {
  return { path, toString: () => `file://${path}` } as unknown as vscode.Uri;
}

function document(path: string, languageId = 'clojure') {
  return { uri: uri(path), languageId };
}

describe('current file decision', () => {
  it('gives the active editor', () => {
    const active = document('/p/src/a.clj');
    assert.strictEqual(
      decideCurrentFileUri(active, [document('/p/src/b.cljs'), active]),
      active.uri,
      'The active editor is the current file'
    );
  });

  it('gives an active editor of any language', () => {
    const active = document('/p/README.md', 'markdown');
    assert.strictEqual(
      decideCurrentFileUri(active, [active]),
      active.uri,
      'A non-Clojure active editor is the current file'
    );
  });

  it('gives the first visible editor when no text editor is active', () => {
    const first = document('/p/src/b.cljs');
    assert.strictEqual(
      decideCurrentFileUri(undefined, [first, document('/p/src/a.clj')]),
      first.uri,
      'Without an active editor, the first visible editor is the current file'
    );
  });

  it('skips output channels', () => {
    const log = document('extension-output-calva', 'Log');
    const file = document('/p/src/a.clj');
    assert.strictEqual(
      decideCurrentFileUri(log, [log, file]),
      file.uri,
      'An active output channel is skipped for the first visible file'
    );
  });

  it('gives no file without editors', () => {
    assert.strictEqual(decideCurrentFileUri(undefined, []), undefined, 'No editors, no file');
  });
});
