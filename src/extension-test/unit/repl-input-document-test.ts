import * as expectLib from 'expect';
import * as paredit from '../../cursor-doc/paredit';
import * as replInputDocument from '../../repl-input-document';

describe('REPL Input document', () => {
  it('holds the text and the selections the REPL Input posted', () => {
    const doc = replInputDocument.stringDocument('(a b)\n(c)', [
      [1, 1],
      [8, 7],
    ]);
    expectLib.expect(replInputDocument.documentState(doc)).toEqual({
      text: '(a b)\n(c)',
      selections: [
        [1, 1],
        [8, 7],
      ],
      selectionsStack: [],
    });
  });

  it('gives the REPL Input the text and selections a Paredit command made', async () => {
    const doc = replInputDocument.stringDocument('(a b) c', [[4, 4]]);
    await paredit.forwardSlurpSexp(doc);
    expectLib.expect(replInputDocument.documentState(doc)).toEqual({
      text: '(a b c)',
      selections: [[4, 4]],
      selectionsStack: [],
    });
  });

  it('keeps the selection history between commands, so a range contraction follows the expansions', () => {
    const first = replInputDocument.stringDocument('(a (b c))', [[5, 5]]);
    paredit.growSelectionStack(first, [[4, 7]]);
    paredit.growSelectionStack(first, [[3, 8]]);
    const { text, selections, selectionsStack } = replInputDocument.documentState(first);
    const second = replInputDocument.stringDocument(text, selections, selectionsStack);
    paredit.shrinkSelection(second);
    expectLib.expect(replInputDocument.documentState(second).selections).toEqual([[4, 7]]);
  });

  it('inserts at the selection, as a text editor document does', async () => {
    const doc = replInputDocument.stringDocument('(a b)', [[1, 4]]);
    await paredit.stringQuote(doc);
    expectLib.expect(replInputDocument.documentState(doc).text).toBe('("a b)');
    expectLib.expect(doc.getSelectionText()).toBe('"a ');
  });

  describe('new line', () => {
    it('indents the new line the way Calva indents', () => {
      const doc = replInputDocument.stringDocument('(defn f [x]x)', [[11, 11]]);
      replInputDocument.newLine(doc);
      expectLib.expect(replInputDocument.documentState(doc)).toEqual({
        text: '(defn f [x]\n  x)',
        selections: [[14, 14]],
        selectionsStack: [],
      });
    });

    it('replaces the selection, and puts the cursor at the start of an unindented line', () => {
      const doc = replInputDocument.stringDocument('a b', [[1, 2]]);
      replInputDocument.newLine(doc);
      expectLib.expect(replInputDocument.documentState(doc)).toEqual({
        text: 'a\nb',
        selections: [[2, 2]],
        selectionsStack: [],
      });
    });

    it('breaks the line at every cursor', () => {
      const doc = replInputDocument.stringDocument('[a][b]', [
        [4, 4],
        [1, 1],
      ]);
      replInputDocument.newLine(doc);
      expectLib.expect(replInputDocument.documentState(doc)).toEqual({
        text: '[\n a][\n    b]',
        selections: [
          [3, 3],
          [11, 11],
        ],
        selectionsStack: [],
      });
    });
  });

  describe('changes', () => {
    it('applies changes given last first, and the cursor moves with the text', () => {
      const doc = replInputDocument.stringDocument('(a\nb   c)', [[3, 3]]);
      replInputDocument.applyChanges(doc, [
        { start: 4, end: 7, text: ' ' },
        { start: 3, end: 3, text: ' ' },
      ]);
      expectLib.expect(replInputDocument.documentState(doc)).toEqual({
        text: '(a\n b c)',
        selections: [[4, 4]],
        selectionsStack: [],
      });
    });

    it('skips a change that overlaps the change after it', () => {
      const doc = replInputDocument.stringDocument('abcdef', [[0, 0]]);
      replInputDocument.applyChanges(doc, [
        { start: 3, end: 5, text: 'X' },
        { start: 2, end: 4, text: 'Y' },
        { start: 0, end: 1, text: 'Z' },
      ]);
      expectLib.expect(replInputDocument.documentState(doc).text).toBe('ZbcXf');
    });
  });

  describe('brackets', () => {
    const options = { colorCount: 3, cycleBracketColors: true };

    it('gives the colored brackets as offsets with their color index, and the misplaced ones', () => {
      const doc = replInputDocument.stringDocument('(a #{b}) )', [[3, 3]]);
      const brackets = replInputDocument.brackets(doc, options);
      expectLib.expect(brackets.brackets).toEqual([
        [0, 1, 0],
        [3, 5, 1],
        [6, 7, 1],
        [7, 8, 0],
      ]);
      expectLib.expect(brackets.misplaced).toEqual([[9, 10]]);
    });

    it('gives the ignored and the comment forms', () => {
      const brackets = replInputDocument.brackets(
        replInputDocument.stringDocument('#_(a) (comment (b #_c))', [[0, 0]]),
        options
      );
      expectLib.expect(brackets.topLevelIgnoredForms).toEqual([[0, 5]]);
      expectLib.expect(brackets.ignoredForms).toEqual([[18, 21]]);
      expectLib.expect(brackets.commentForms).toEqual([[6, 23]]);
    });

    it('matches the brackets at every cursor', () => {
      const doc = replInputDocument.stringDocument('(a) [b]', [
        [3, 3],
        [4, 4],
      ]);
      expectLib.expect(replInputDocument.brackets(doc, options).matched).toEqual([
        [0, 1],
        [2, 3],
        [4, 5],
        [6, 7],
      ]);
    });
  });

  describe('cursor contexts', () => {
    it('sets every cursor context, true or false', () => {
      const contexts = replInputDocument.cursorContexts(
        replInputDocument.stringDocument('(a ;; b\n c)', [[6, 6]])
      );
      expectLib.expect(contexts['calva:cursorInComment']).toBe(true);
      expectLib.expect(contexts['calva:cursorInString']).toBe(false);
      expectLib.expect(Object.keys(contexts)).toContain('calva:cursorAfterComment');
    });

    it('follows the first cursor', () => {
      const contexts = replInputDocument.cursorContexts(
        replInputDocument.stringDocument('"a" b', [
          [2, 2],
          [5, 5],
        ])
      );
      expectLib.expect(contexts['calva:cursorInString']).toBe(true);
    });
  });
});
