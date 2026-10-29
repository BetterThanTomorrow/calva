import * as mocha from 'mocha';
import * as expectLib from 'expect';
import * as path from 'path';
import * as vscode from 'vscode';
import * as replWindow from '../../../repl-window/repl-window-doc';

function clojureDocument(...segments: string[]): vscode.TextDocument {
  const uri = vscode.Uri.file(path.join(path.sep, 'elsewhere', 'project', ...segments));
  return { uri, fileName: uri.fsPath, languageId: 'clojure' } as vscode.TextDocument;
}

mocha.describe('REPL window file', () => {
  mocha.it('knows a REPL window file by its name, also where the REPL window has no URI', () => {
    expectLib
      .expect(replWindow.isReplWindowFile(clojureDocument('.calva', 'repl.calva-repl')))
      .toBe(true);
    expectLib
      .expect(
        replWindow.isReplWindowFile(clojureDocument('.calva', 'output-window', 'output.calva-repl'))
      )
      .toBe(true);
  });

  mocha.it('leaves other Clojure files alone', () => {
    expectLib.expect(replWindow.isReplWindowFile(clojureDocument('src', 'core.clj'))).toBe(false);
    expectLib.expect(replWindow.isReplWindowFile(clojureDocument('repl.calva-repl'))).toBe(false);
    expectLib.expect(replWindow.isReplWindowFile(undefined)).toBe(false);
  });
});
