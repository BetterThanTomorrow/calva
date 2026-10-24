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
