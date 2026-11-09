import * as assert from 'assert';
import * as Mocha from 'mocha';
import * as vscode from 'vscode';
import {
  breakpointLocationsForRange,
  breakpointPositionIsInComment,
  breakpointTargetPosition,
} from '../../../debugger/gui-breakpoints';

const { describe, it } = Mocha;

async function createBreakpointDocument() {
  await vscode.extensions.getExtension('betterthantomorrow.calva')?.activate();
  const document = await vscode.workspace.openTextDocument({
    language: 'clojure',
    content: '(first) (second)\n(outer (nested))',
  });
  await vscode.window.showTextDocument(document);
  return document;
}

describe('GUI breakpoint target resolution', () => {
  it('resolves a line breakpoint to the last form on its line', async () => {
    const document = await createBreakpointDocument();
    const breakpoint = new vscode.SourceBreakpoint(
      new vscode.Location(document.uri, new vscode.Position(0, 0)),
      true
    );

    assert.deepStrictEqual(
      breakpointTargetPosition(document, breakpoint),
      new vscode.Position(0, 8)
    );
  });

  it('resolves a positioned breakpoint to its nested form and reports form ranges', async () => {
    const document = await createBreakpointDocument();
    const breakpoint = new vscode.SourceBreakpoint(
      new vscode.Location(document.uri, new vscode.Position(1, 8)),
      true
    );

    assert.deepStrictEqual(
      breakpointTargetPosition(document, breakpoint),
      new vscode.Position(1, 7)
    );
    const ranges = breakpointLocationsForRange(
      document,
      new vscode.Range(1, 0, 1, document.lineAt(1).range.end.character)
    );
    assert.deepStrictEqual(
      ranges.map((location) => location.range.start),
      [new vscode.Position(1, 0), new vscode.Position(1, 7)]
    );
  });

  it('identifies commented-out code as an invalid breakpoint location', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'clojure',
      content: ';; (defn fact-rec [n]\n;;   (if (= n 1) n))\n(defn active [] 1)',
    });

    assert.strictEqual(breakpointPositionIsInComment(document, new vscode.Position(0, 3)), true);
    assert.strictEqual(breakpointPositionIsInComment(document, new vscode.Position(2, 1)), false);
  });
});
