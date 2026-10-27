import * as assert from 'assert';
import type * as vscode from 'vscode';
import { decideCurrentFileUri, firstFileUri } from '../../current-file-decision';

function uri(path: string, scheme = 'file'): vscode.Uri {
  return { scheme, path, toString: () => `${scheme}://${path}` } as unknown as vscode.Uri;
}

function document(path: string, languageId = 'clojure', scheme = 'file') {
  return { uri: uri(path, scheme), languageId };
}

describe('current file decision', () => {
  it('gives the active editor', () => {
    const active = document('/p/src/a.clj');
    assert.strictEqual(
      decideCurrentFileUri(active, uri('/p/src/b.cljs'), [document('/p/src/c.clj')]),
      active.uri,
      'The active editor is the current file'
    );
  });

  it('gives an active editor of any language or scheme', () => {
    const markdown = document('/p/README.md', 'markdown');
    assert.strictEqual(
      decideCurrentFileUri(markdown, uri('/p/src/a.clj')),
      markdown.uri,
      'A non-Clojure active editor is the current file'
    );
    const untitled = document('Untitled-1', 'clojure', 'untitled');
    assert.strictEqual(
      decideCurrentFileUri(untitled, uri('/p/src/a.clj')),
      untitled.uri,
      'An untitled active editor is the current file'
    );
  });

  it('gives the last active editor when no text editor is active', () => {
    const lastActive = uri('/p/src/a.clj');
    assert.strictEqual(
      decideCurrentFileUri(undefined, lastActive, [document('/p/src/b.cljs')]),
      lastActive,
      'Without an active editor, the last active editor is the current file, not the first visible'
    );
  });

  it('gives the first visible editor when there is no last active editor', () => {
    const output = document('extension-output-calva', 'markdown', 'output');
    const first = document('/p/src/b.cljs');
    assert.strictEqual(
      decideCurrentFileUri(undefined, undefined, [output, first, document('/p/src/a.clj')]),
      first.uri,
      'Without an active or last active editor, the first visible file is the current file'
    );
  });

  it('skips output channels', () => {
    const lastActive = uri('/p/src/a.clj');
    assert.strictEqual(
      decideCurrentFileUri(document('extension-output-calva', 'Log', 'output'), lastActive),
      lastActive,
      'An active output channel is skipped for the last active editor'
    );
    assert.strictEqual(
      decideCurrentFileUri(
        document('extension-output-calva-says', 'markdown', 'output'),
        lastActive
      ),
      lastActive,
      'An output channel of any language is skipped'
    );
    assert.strictEqual(
      firstFileUri([document('extension-output-git', 'log', 'output')]),
      undefined,
      'An output channel is not a file'
    );
  });

  it('gives no file without editors', () => {
    assert.strictEqual(
      decideCurrentFileUri(undefined, undefined),
      undefined,
      'No editors, no file'
    );
  });
});
