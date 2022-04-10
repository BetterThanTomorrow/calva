import * as expect from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as model from '../../../cursor-doc/model';
import {
  docFromTextNotation,
  textAndSelection,
  getText,
  textNotationFromDoc,
} from '../common/text-notation';
import { ModelEditSelection } from '../../../cursor-doc/model';
import { last, method } from 'lodash';

model.initScanner(20000);

/**
 * TODO: Use text-notation for these tests
 */

describe('paredit', () => {
  const docText = '(def foo [:foo :bar :baz])';
  let doc: model.StringDocument;
  const startSelections = [new ModelEditSelection(0, 0)];

  beforeEach(() => {
    doc = new model.StringDocument(docText);
    doc.selections = startSelections.map((s) => s.clone());
  });

  describe('movement', () => {
    describe('rangeToSexprForward', () => {
      it('Finds the list in front', () => {
        const a = docFromTextNotation('|(a b [c])');
        const b = docFromTextNotation('|(a b [c])|');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors find the list in front', () => {
        const a = docFromTextNotation('|(a b [c])§|1(a b [c])');
        const b = docFromTextNotation('|(a b [c])|§|1(a b [c])|1');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through metadata', () => {
        const a = docFromTextNotation('|^:a (b c [d])');
        const b = docFromTextNotation('|^:a (b c [d])|');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors find the list in front through metadata', () => {
        const a = docFromTextNotation('|^:a (b c [d])§|1^:a (b c [d])');
        const b = docFromTextNotation('|^:a (b c [d])|§|1^:a (b c [d])|1');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (c d [e])');
        const b = docFromTextNotation('|^:f #a #b (c d [e])|');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors find the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (c d [e])§|1^:f #a #b (c d [e])');
        const b = docFromTextNotation('|^:f #a #b (c d [e])|§|1^:f #a #b (c d [e])|1');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors find the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (c d [e])§|1^:f #a #b (c d [e])');
        const b = docFromTextNotation('|^:f #a #b (c d [e])|§|1^:f #a #b (c d [e])|1');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through reader metadata reader', () => {
        const a = docFromTextNotation('|#c ^:f #a #b (def foo [vec])');
        const b = docFromTextNotation('|#c ^:f #a #b (def foo [vec])|');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the symbol in front', () => {
        const a = docFromTextNotation('(|def foo [vec])');
        const b = docFromTextNotation('(|def| foo [vec])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the rest of the symbol', () => {
        const a = docFromTextNotation('(d|ef foo [vec])');
        const b = docFromTextNotation('(d|ef| foo [vec])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the rest of the keyword', () => {
        const a = docFromTextNotation('(def foo [:foo :bar :ba|z])');
        const b = docFromTextNotation('(def foo [:foo :bar :ba|z|])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Includes space between the cursor and the symbol', () => {
        const a = docFromTextNotation('(def| foo [vec])');
        const b = docFromTextNotation('(def| foo| [vec])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the vector in front', () => {
        const a = docFromTextNotation('(def foo |[vec])');
        const b = docFromTextNotation('(def foo |[vec]|)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the keyword in front', () => {
        const a = docFromTextNotation('(def foo [:foo :bar |:baz])');
        const b = docFromTextNotation('(def foo [:foo :bar |:baz|])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Does not find anything at end of list', () => {
        const a = docFromTextNotation('(|)');
        const b = docFromTextNotation('(|)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors do not find anything at end of list', () => {
        const a = docFromTextNotation('(|)§(|1)');
        const b = docFromTextNotation('(|)§(|1)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Cursor 1 finds fwd sexp, cursor 2 does not, cursor 3 does', () => {
        const a = docFromTextNotation('(|a)§(|1)§|2(b)');
        const b = docFromTextNotation('(|a|)§(|1)§|2(b)|2');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds next symbol, including leading space', () => {
        const a = docFromTextNotation('(|def| foo [vec])');
        const b = docFromTextNotation('(def| foo| [vec])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds following vector including leading space', () => {
        const a = docFromTextNotation('(|def foo| [vec])');
        const b = docFromTextNotation('(def foo| [vec]|)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Reverses direction of selection and finds next sexp', () => {
        const a = docFromTextNotation('(|<|def foo|<| [vec])');
        const b = docFromTextNotation('(def foo| [vec]|)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('rangeToSexprBackward', () => {
      it('Finds the list preceding', () => {
        const a = docFromTextNotation('(def foo [vec])|');
        const b = docFromTextNotation('|(def foo [vec])|');
        expect(paredit.backwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list preceding through metadata', () => {
        const a = docFromTextNotation('^:foo (def foo [vec])|');
        const b = docFromTextNotation('|^:foo (def foo [vec])|');
        expect(paredit.backwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list preceding through metadata and readers', () => {
        const a = docFromTextNotation('^:f #a #b (def foo [vec])|');
        const b = docFromTextNotation('|^:f #a #b (def foo [vec])|');
        expect(paredit.backwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list preceding through reader metadata reader', () => {
        const a = docFromTextNotation('#c ^:f #a #b (def foo [vec])|');
        const b = docFromTextNotation('|#c ^:f #a #b (def foo [vec])|');
        expect(paredit.backwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds previous form, including space, and reverses direction', () => {
        // TODO: Should we really be reversing the direction here?
        const a = docFromTextNotation('(def |<|foo [vec]|<|)');
        const b = docFromTextNotation('(|def |foo [vec])');
        expect(paredit.backwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('forwardHybridSexpRange', () => {
      it('Finds end of string', () => {
        const a = docFromTextNotation('"This |needs to find the end of the string."');
        const b = docFromTextNotation('"This |needs to find the end of the string.|"');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });
      it('Multi-cursors find end of string', () => {
        const a = docFromTextNotation('"a |b c"§"c |1d e"');
        const b = docFromTextNotation('"a |b c|"§"c |1d e|1"');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds newline in multi line string', () => {
        const a = docFromTextNotation('"This |needs to find the end\n of the string."');
        const b = docFromTextNotation('"This |needs to find the end|\n of the string."');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });
      it('Multi-cursors find newline in multi line string', () => {
        const a = docFromTextNotation('"a |b §c"§"c |1d §e"');
        const b = docFromTextNotation('"a |b |cc"§"c |1d |1§e"');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds newline in multi line string (Windows)', () => {
        const a = docFromTextNotation('"This |needs to find the end\r\n of the string."');
        const b = docFromTextNotation('"This |needs to find the end|\r\n of the string."');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of comment', () => {
        const a = docFromTextNotation('(a |;; foo§ e)');
        const b = docFromTextNotation('(a |;; foo|§ e)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });
      it('Multi-cursors find end of comment', () => {
        const a = docFromTextNotation('(a |; b§ c)§(c |1; d§ e)');
        const b = docFromTextNotation('(a |; b|§ c)§(c |1; d|1§ e)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of comment (Windows)', () => {
        const a = docFromTextNotation('(a |;; foo\r\n e)');
        const b = docFromTextNotation('(a |;; foo|\r\n e)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 1', () => {
        const a = docFromTextNotation('(a| b (c§ d) e)');
        const b = docFromTextNotation('(a| b (c§ d)| e)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });
      it('Multi-cursors maintain balanced delimiters 1', () => {
        const a = docFromTextNotation('(a| b (c§ d) e)§(f|1 g (h§ i) j)');
        const b = docFromTextNotation('(a| b (c§ d)| e)§(f|1 g (h§ i)|1 j)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 1 (Windows)', () => {
        const a = docFromTextNotation('(a| b (c\r\n d) e)');
        const b = docFromTextNotation('(a| b (c\r\n d)| e)');
        const [start, end] = textAndSelection(b)[1][0];
        const actual = paredit.forwardHybridSexpRange(a)[0];
        // off by 1 because \r\n is treated as 1 char?
        expect(actual).toEqual([start, end - 1]);
      });

      it('Maintains balanced delimiters 2', () => {
        const a = docFromTextNotation('(aa| (c d(e§f)) g)');
        const b = docFromTextNotation('(aa| (c d(e§f))|g)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });
      it('Multi-cursors maintain balanced delimiters 2', () => {
        const a = docFromTextNotation('(a| (c d (e§f)) g)§(h|1 (i j (k§l)) m)');
        // TODO: This behaves in VS Code, but the test fails
        const b = docFromTextNotation('(a| (c d (e§f))|g)§(h|1 (i j (k§l))|1m)');
        //       the result matches this (the second cursor is where it differes)
        //const b = docFromTextNotation('(a| (c d (e§f))|g)§(h |1(i j (k§l)) |1m)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 2 (Windows)', () => {
        const a = docFromTextNotation('(aa| (c (e\r\nf)) g)');
        const b = docFromTextNotation('(aa| (c (e\r\nf))|g)');
        const [start, end] = textAndSelection(b)[1][0];
        const actual = paredit.forwardHybridSexpRange(a)[0];
        // off by 1 because \r\n is treated as 1 char?
        expect(actual).toEqual([start, end - 1]);
      });

      it('Maintains balanced delimiters 3', () => {
        const a = docFromTextNotation('(aa| (  c (e\nf)) g)');
        const b = docFromTextNotation('(aa| (  c (e\nf))|g)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Advances past newline when invoked on newline', () => {
        const a = docFromTextNotation('(a|\n e) g)');
        const b = docFromTextNotation('(a|\n| e)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of vectors', () => {
        const a = docFromTextNotation('[a [b |c d e f] g h]');
        const b = docFromTextNotation('[a [b |c d e f|] g h]');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of lists', () => {
        const a = docFromTextNotation('(foo |bar)\n');
        const b = docFromTextNotation('(foo |bar|)\n');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of maps', () => {
        const a = docFromTextNotation('{:a 1 |:b 2 :c 3}');
        const b = docFromTextNotation('{:a 1 |:b 2 :c 3|}');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of line in multiline maps', () => {
        const a = docFromTextNotation('{:a 1 |:b 2\n:c 3}');
        const b = docFromTextNotation('{:a 1 |:b 2|:c 3}');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of expr in multiline maps', () => {
        const a = docFromTextNotation('{:a 1 |:b (+\n 0\n 2\n) :c 3}');
        const b = docFromTextNotation('{:a 1 |:b (+\n 0\n 2\n)| :c 3}');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of line in bindings', () => {
        const a = docFromTextNotation('(let [|a (+ 1 2)\n b (+ 2 3)] (+ a b))');
        const b = docFromTextNotation('(let [|a (+ 1 2)|\n b (+ 2 3)] (+ a b))');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of expr in multiline bindings', () => {
        const a = docFromTextNotation('(let [|a (+\n 1 \n 2)\n b (+ 2 3)] (+ a b))');
        const b = docFromTextNotation('(let [|a (+\n 1 \n 2)|\n b (+ 2 3)] (+ a b))');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds range in line of tokens', () => {
        const a = docFromTextNotation(' | 2 "hello" :hello/world\nbye');
        const b = docFromTextNotation(' | 2 "hello" :hello/world|\nbye');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds range in token with form over multiple lines', () => {
        const a = docFromTextNotation(' | 2 [\n 1 \n]');
        const b = docFromTextNotation(' | 2 [\n 1 \n]|');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments start of line', () => {
        const a = docFromTextNotation('|;;  hi\n');
        const b = docFromTextNotation('|;;  hi|\n');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments middle of line', () => {
        const a = docFromTextNotation(';; |hi\n');
        const b = docFromTextNotation(';; |hi|\n');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with empty lines', () => {
        const a = docFromTextNotation('|\n');
        const b = docFromTextNotation('|\n|');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments with empty line', () => {
        const a = docFromTextNotation(';; |\n');
        const b = docFromTextNotation(';; |\n|');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Does not advance when on closing token type ', () => {
        const a = docFromTextNotation('(a e|)\n');
        const b = docFromTextNotation('(a e||)\n');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds the full form after an ignore marker', () => {
        // https://github.com/BetterThanTomorrow/calva/pull/1293#issuecomment-927123696
        const a = docFromTextNotation(
          '(comment§  #_|[a b (c d§              e§              f) g]§  :a§)'
        );
        const b = docFromTextNotation(
          '(comment§  #_|[a b (c d§              e§              f) g]|§ :a§)'
        );
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });
    });

    describe('forwardSexpOrUpRange', () => {
      it('Finds the list in front', () => {
        const a = docFromTextNotation('|(def foo [vec])');
        const b = docFromTextNotation('|(def foo [vec])|');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through metadata', () => {
        const a = docFromTextNotation('|^:foo (def foo [vec])');
        const b = docFromTextNotation('|^:foo (def foo [vec])|');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (def foo [vec])');
        const b = docFromTextNotation('|^:f #a #b (def foo [vec])|');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through reader metadata reader', () => {
        const a = docFromTextNotation('|#c ^:f #a #b (def foo [vec])');
        const b = docFromTextNotation('|#c ^:f #a #b (def foo [vec])|');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the symbol in front', () => {
        const a = docFromTextNotation('(|def foo [vec])');
        const b = docFromTextNotation('(|def| foo [vec])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the rest of the symbol', () => {
        const a = docFromTextNotation('(d|ef foo [vec])');
        const b = docFromTextNotation('(d|ef| foo [vec])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the rest of the keyword', () => {
        const a = docFromTextNotation('(def foo [:foo :bar :ba|z])');
        const b = docFromTextNotation('(def foo [:foo :bar :ba|z|])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Includes space between the cursor and the symbol', () => {
        const a = docFromTextNotation('(def| foo [vec])');
        const b = docFromTextNotation('(def| foo| [vec])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the vector in front', () => {
        const a = docFromTextNotation('(def foo |[vec])');
        const b = docFromTextNotation('(def foo |[vec]|)');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the keyword in front', () => {
        const a = docFromTextNotation('(def foo [:foo :bar |:baz])');
        const b = docFromTextNotation('(def foo [:foo :bar |:baz|])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Leaves a sexp if at the end', () => {
        const a = docFromTextNotation('(def foo [:foo :bar :baz|])');
        const b = docFromTextNotation('(def foo [:foo :bar :baz|]|)');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors leave sexp if at the end', () => {
        const a = docFromTextNotation('(a|)§(b|1)');
        const b = docFromTextNotation('(a|)|§(b|1)|1');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors one goes fwd a sexp, one leaves sexp b/c at the end', () => {
        const a = docFromTextNotation('(|a)§(b|1)');
        const b = docFromTextNotation('(|a|)§(b|1)|1');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds next symbol, including leading space', () => {
        const a = docFromTextNotation('(|def| foo [vec])');
        const b = docFromTextNotation('(def| foo| [vec])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds following vector including leading space', () => {
        const a = docFromTextNotation('(|def foo| [vec])');
        const b = docFromTextNotation('(def foo| [vec]|)');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Reverses direction of selection and finds next sexp', () => {
        const a = docFromTextNotation('(|<|def foo|<| [vec])');
        const b = docFromTextNotation('(def foo| [vec]|)');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('backwardSexpOrUpRange', () => {
      it('Finds the list preceding', () => {
        const a = docFromTextNotation('(def foo [vec])|');
        const b = docFromTextNotation('|(def foo [vec])|');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list preceding through metadata', () => {
        const a = docFromTextNotation('^:foo (def foo [vec])|');
        const b = docFromTextNotation('|^:foo (def foo [vec])|');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list preceding through metadata and readers', () => {
        const a = docFromTextNotation('^:f #a #b (def foo [vec])|');
        const b = docFromTextNotation('|^:f #a #b (def foo [vec])|');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list preceding through reader metadata reader', () => {
        const a = docFromTextNotation('#c ^:f #a #b (def foo [vec])|');
        const b = docFromTextNotation('|#c ^:f #a #b (def foo [vec])|');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds previous form, including space, and reverses direction', () => {
        // TODO: Should we really be reversing the direction here?
        const a = docFromTextNotation('(def |<|foo [vec]|<|)');
        const b = docFromTextNotation('(|def |foo [vec])');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Goes up when at front bounds', () => {
        const a = docFromTextNotation('(def x (|inc 1))');
        const b = docFromTextNotation('(def x |(|inc 1))');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors go up when at front bounds', () => {
        const a = docFromTextNotation('(|1a (|b 1))');
        const b = docFromTextNotation('|1(|1a |(|b 1))');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Multi-cursors, one go up when at front bounds, the other back sexp', () => {
        const a = docFromTextNotation('(|1a (b c|))');
        const b = docFromTextNotation('|1(|1a (b |c|))');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('moveToRangeRight', () => {
      it('Places cursor at the right end of the selection', () => {
        const a = docFromTextNotation('(def |foo| [vec])');
        const b = docFromTextNotation('(def foo| [vec])');
        paredit.moveToRangeRight(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Places cursor at the right end of the selection 2', () => {
        const a = docFromTextNotation('(|def foo| [vec])');
        const b = docFromTextNotation('(def foo| [vec])');
        paredit.moveToRangeRight(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Move to right of given range, regardless of previous selection', () => {
        const a = docFromTextNotation('(|<|def|<| foo [vec])');
        const b = docFromTextNotation('(def foo |[vec]|)');
        const c = docFromTextNotation('(def foo [vec]|)');
        paredit.moveToRangeRight(a, textAndSelection(b)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(c));
      });
    });

    describe('moveToRangeLeft', () => {
      it('Places cursor at the left end of the selection', () => {
        const a = docFromTextNotation('(def |foo| [vec])');
        const b = docFromTextNotation('(def |foo [vec])');
        paredit.moveToRangeLeft(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Places cursor at the left end of the selection 2', () => {
        const a = docFromTextNotation('(|def foo| [vec])');
        const b = docFromTextNotation('(|def foo [vec])');
        paredit.moveToRangeLeft(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Move to left of given range, regardless of previous selection', () => {
        const a = docFromTextNotation('(|<|def|<| foo [vec])');
        const b = docFromTextNotation('(def foo |[vec]|)');
        const c = docFromTextNotation('(def foo |[vec])');
        paredit.moveToRangeLeft(a, textAndSelection(b)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(c));
      });
    });

    describe('Forward to end of list', () => {
      it('rangeToForwardList', () => {
        const a = docFromTextNotation('(|c§(#b §[:f :b :z])§#z§1)');
        const b = docFromTextNotation('(|c§(#b §[:f :b :z])§#z§1|)');
        expect(paredit.rangeToForwardList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToForwardList through readers and meta', () => {
        const a = docFromTextNotation('(|^e #a ^{:c d}§#b§[:f]§#z§1)');
        const b = docFromTextNotation('(|^e #a ^{:c d}§#b§[:f]§#z§1|)');
        expect(paredit.rangeToForwardList(a)).toEqual(textAndSelection(b)[1][0]);
      });
    });

    describe('Backward to start of list', () => {
      it('rangeToBackwardList', () => {
        const a = docFromTextNotation('(c§(#b §[:f :b :z])§#z§1|)');
        const b = docFromTextNotation('(|c§(#b §[:f :b :z])§#z§1|)');
        expect(paredit.rangeToBackwardList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToBackwardList through readers and meta', () => {
        const a = docFromTextNotation('(^e #a ^{:c d}§#b§[:f]§#z§1|)');
        const b = docFromTextNotation('(|^e #a ^{:c d}§#b§[:f]§#z§1|)');
        expect(paredit.rangeToBackwardList(a)).toEqual(textAndSelection(b)[1][0]);
      });
    });

    describe('Down list', () => {
      it('rangeToForwardDownList', () => {
        const a = docFromTextNotation('(|c§(#b §[:f :b :z])§#z§1)');
        const b = docFromTextNotation('(|c§(|#b §[:f :b :z])§#z§1)');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToForwardDownList through readers', () => {
        const a = docFromTextNotation('(|c§#f§(#b §[:f :b :z])§#z§1)');
        const b = docFromTextNotation('(|c§#f§(|#b §[:f :b :z])§#z§1)');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToForwardDownList through metadata', () => {
        const a = docFromTextNotation('(|c§^f§(#b §[:f :b]))');
        const b = docFromTextNotation('(|c§^f§(|#b §[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToForwardDownList through metadata collection', () => {
        const a = docFromTextNotation('(|c§^{:f 1}§(#b §[:f :b]))');
        const b = docFromTextNotation('(|c§^{:f 1}§(|#b §[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToForwardDownList through metadata and readers', () => {
        const a = docFromTextNotation('(|c§^:a #f§(#b §[:f :b]))');
        const b = docFromTextNotation('(|c§^:a #f§(|#b §[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToForwardDownList through metadata collection and reader', () => {
        const a = docFromTextNotation('(|c§^{:f 1}§#a §(#b §[:f :b]))');
        const b = docFromTextNotation('(|c§^{:f 1}§#a §(|#b §[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1][0]);
      });
    });

    describe('Backward Up list', () => {
      it('rangeToBackwardUpList', () => {
        const a = docFromTextNotation('(c§(|#b §[:f :b :z])§#z§1)');
        const b = docFromTextNotation('(c§|(|#b §[:f :b :z])§#z§1)');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToBackwardUpList through readers', () => {
        const a = docFromTextNotation('(c§#f§(|#b §[:f :b :z])§#z§1)');
        const b = docFromTextNotation('(c§|#f§(|#b §[:f :b :z])§#z§1)');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToBackwardUpList through metadata', () => {
        const a = docFromTextNotation('(c§^f§(|#b §[:f :b]))');
        const b = docFromTextNotation('(c§|^f§(|#b §[:f :b]))');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToBackwardUpList through metadata and readers', () => {
        const a = docFromTextNotation('(c§^:a #f§(|#b §[:f :b]))');
        const b = docFromTextNotation('(c§|^:a #f§(|#b §[:f :b]))');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1][0]);
      });
      it('rangeToBackwardUpList 2', () => {
        // TODO: This is wrong! But real Paredit behaves as it should...
        const a = docFromTextNotation('(a(b(c§#f§(#b §|[:f :b :z])§#z§1)))');
        const b = docFromTextNotation('(a(b|(c§#f§(#b §|[:f :b :z])§#z§1)))');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1][0]);
      });
    });
  });

  describe('Reader tags', () => {
    it('dragSexprBackward', () => {
      const a = docFromTextNotation('(a(b(c§#f§|(#b §[:f :b :z])§#z§1)))');
      const b = docFromTextNotation('(a(b(#f§|(#b §[:f :b :z])§c§#z§1)))');
      void paredit.dragSexprBackward(a);
      expect(textAndSelection(a)).toEqual(textAndSelection(b));
    });
    it('dragSexprForward', () => {
      const a = docFromTextNotation('(a(b(c§#f§|(#b §[:f :b :z])§#z§1)))');
      const b = docFromTextNotation('(a(b(c§#z§1§#f§|(#b §[:f :b :z]))))');
      void paredit.dragSexprForward(a);
      expect(textAndSelection(a)).toEqual(textAndSelection(b));
    });
    describe('Stacked readers', () => {
      const docText = '(c\n#f\n(#b \n[:f :b :z])\n#x\n#y\n1)';
      let doc: model.StringDocument;

      beforeEach(() => {
        doc = new model.StringDocument(docText);
      });
      it('dragSexprBackward', async () => {
        const a = docFromTextNotation('(c§#f§(#b §[:f :b :z])§#x§#y§|a)');
        const b = docFromTextNotation('(c§#x§#y§|a§#f§(#b §[:f :b :z]))');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('dragSexprForward', () => {
        const a = docFromTextNotation('(c§#f§|(#b §[:f :b :z])§#x§#y§1)');
        const b = docFromTextNotation('(c§#x§#y§1§#f§|(#b §[:f :b :z]))');
        void paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Top Level Readers', () => {
      const docText = '#f\n(#b \n[:f :b :z])\n#x\n#y\n1\n#å#ä#ö';
      let doc: model.StringDocument;

      beforeEach(() => {
        doc = new model.StringDocument(docText);
      });
      it('dragSexprBackward: #f§(#b §[:f :b :z])§#x§#y§|a§#å#ä#ö => #x§#y§1§#f§(#b §[:f :b :z])§#å#ä#ö', () => {
        doc.selections = [new ModelEditSelection(26, 26)];
        void paredit.dragSexprBackward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
      });
      it('dragSexprForward: #f§|(#b §[:f :b :z])§#x§#y§1#å#ä#ö => #x§#y§1§#f§|(#b §[:f :b :z])§#å#ä#ö', () => {
        doc.selections = [new ModelEditSelection(3, 3)];
        void paredit.dragSexprForward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
        expect(doc.selections).toEqual([new ModelEditSelection(11)]);
      });
      it('dragSexprForward: #f§(#b §[:f :b :z])§#x§#y§|a§#å#ä#ö => #f§(#b §[:f :b :z])§#x§#y§|a§#å#ä#ö', () => {
        doc.selections = [new ModelEditSelection(26, 26)];
        void paredit.dragSexprForward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#f\n(#b \n[:f :b :z])\n#x\n#y\n1\n#å#ä#ö');
        expect(doc.selections).toEqual([new ModelEditSelection(26)]);
      });
    });
  });

  describe('selection', () => {
    describe('selectRangeBackward', () => {
      // TODO: Fix #498
      it('Extends backward selections backwards', () => {
        const a = docFromTextNotation('(def foo [:foo :bar |<|:baz|<|])');
        const selDoc = docFromTextNotation('(def foo [:foo |:bar| :baz])');
        const b = docFromTextNotation('(def foo [:foo |<|:bar :baz|<|])');
        paredit.selectRangeBackward(
          a,
          selDoc.selections.map((s) => [s.anchor, s.active])
        );
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Contracts forward selection and extends backwards', () => {
        const a = docFromTextNotation('(def foo [:foo :bar |:baz|])');
        const selDoc = docFromTextNotation('(def foo [:foo |:bar| :baz])');
        const b = docFromTextNotation('(def foo [:foo |<|:bar |<|:baz])');
        paredit.selectRangeBackward(
          a,
          selDoc.selections.map((s) => [s.anchor, s.active])
        );
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('selectRangeForward', () => {
      it('(def foo [:foo >:bar> >|:baz>|]) => (def foo [:foo >:bar :baz>])', () => {
        const barSelection = [new ModelEditSelection(15, 19)],
          bazRange = [[20, 24] as [number, number]],
          barBazSelection = [new ModelEditSelection(15, 24)];
        doc.selections = barSelection;
        paredit.selectRangeForward(doc, bazRange);
        expect(doc.selections).toEqual(barBazSelection);
      });
      it('(def foo [<:foo :bar< >|:baz>|]) => (def foo [>:foo :bar :baz>])', () => {
        const [fooLeft, barRight] = [10, 19],
          barFooSelection = [new ModelEditSelection(barRight, fooLeft)],
          bazRange = [[20, 24] as [number, number]],
          fooBazSelection = [new ModelEditSelection(19, 24)];
        doc.selections = barFooSelection;
        paredit.selectRangeForward(doc, bazRange);
        expect(doc.selections).toEqual(fooBazSelection);
      });
      it('(def foo [<:foo :bar< <|:baz<|]) => (def foo [>:foo :bar :baz>])', () => {
        const [fooLeft, barRight] = [10, 19],
          barFooSelection = [new ModelEditSelection(barRight, fooLeft)],
          bazRange = [[24, 20] as [number, number]],
          fooBazSelection = [new ModelEditSelection(19, 24)];
        doc.selections = barFooSelection;
        paredit.selectRangeForward(doc, bazRange);
        expect(doc.selections).toEqual(fooBazSelection);
      });
    });
  });

  describe('selection stack', () => {
    const range = [15, 20] as [number, number];
    it('should make grow selection the topmost element on the stack', () => {
      paredit.growSelectionStack(doc, [range]);
      expect(last(doc.selectionsStack)).toEqual([new ModelEditSelection(range[0], range[1])]);
    });
    it('get us back to where we started if we just grow, then shrink', () => {
      const selectionBefore = startSelections.map((s) => s.clone());
      paredit.growSelectionStack(doc, [range]);
      paredit.shrinkSelection(doc);
      expect(last(doc.selectionsStack)).toEqual(selectionBefore);
    });
    it('should not add selections identical to the topmost', () => {
      const selectionBefore = doc.selections.map((s) => s.clone());
      paredit.growSelectionStack(doc, [range]);
      paredit.growSelectionStack(doc, [range]);
      paredit.shrinkSelection(doc);
      expect(last(doc.selectionsStack)).toEqual(selectionBefore);
    });
    it('should have A topmost after adding A, then B, then shrinking', () => {
      const a = range,
        b: [number, number] = [10, 24];
      paredit.growSelectionStack(doc, [a]);
      paredit.growSelectionStack(doc, [b]);
      paredit.shrinkSelection(doc);
      expect(last(doc.selectionsStack)).toEqual([new ModelEditSelection(a[0], a[1])]);
    });
    it('selects the enclosing form when all the text in a list is selected', () => {
      const a = docFromTextNotation('(|a|)');
      const b = docFromTextNotation('|(a)|'); // '(a)' [[0, 3]];
      paredit.growSelection(a);
      expect(textAndSelection(a)).toEqual(textAndSelection(b));
    });
  });

  describe('dragSexpr', () => {
    describe('forwardAndBackwardSexpr', () => {
      // (comment\n  ['(0 1 2 "t" "f")§   "b"§             {:s "h"}§             :f]§  [:f '(0 "t") "b" :s]§  [:f 0§   "b" :s§   4 :b]§  {:e '(e o ea)§   3 {:w? 'w}§   :t '(t i o im)§   :b 'b})
      let doc: model.StringDocument;

      beforeEach(() => {
        doc = new model.StringDocument(docText);
      });

      it('drags forward in regular lists', () => {
        const a = docFromTextNotation(`(c§ [:|f '(0 "t")§   "b" :s]§)`);
        const b = docFromTextNotation(`(c§ ['(0 "t") :|f§   "b" :s]§)`);
        void paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags backward in regular lists', () => {
        const a = docFromTextNotation(`(c§ [:f '(0 "t")§   "b"| :s]§)`);
        const b = docFromTextNotation(`(c§ [:f "b"|§   '(0 "t") :s]§)`);
        void paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('does not drag forward when sexpr is last in regular lists', () => {
        const dotText = `(c§ [:f '(0 "t")§   "b" |:s ]§)`;
        const a = docFromTextNotation(dotText);
        const b = docFromTextNotation(dotText);
        void paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('does not drag backward when sexpr is last in regular lists', () => {
        const dotText = `(c§ [ :|f '(0 "t")§   "b" :s ]§)`;
        const a = docFromTextNotation(dotText);
        const b = docFromTextNotation(dotText);
        void paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair forward in maps', () => {
        const a = docFromTextNotation(
          `(c§ {:|e '(e o ea)§   3 {:w? 'w}§   :t '(t i o im)§   :b 'b}§)`
        );
        const b = docFromTextNotation(
          `(c§ {3 {:w? 'w}§   :|e '(e o ea)§   :t '(t i o im)§   :b 'b}§)`
        );
        void paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair backwards in maps', () => {
        const a = docFromTextNotation(
          `(c§ {:e '(e o ea)§   3 {:w? 'w}§   :t '(t i o im)|§   :b 'b}§)`
        );
        const b = docFromTextNotation(
          `(c§ {:e '(e o ea)§   :t '(t i o im)|§   3 {:w? 'w}§   :b 'b}§)`
        );
        void paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair backwards in meta-data maps', () => {
        const a = docFromTextNotation(
          `(c§ ^{:e '(e o ea)§   3 {:w? 'w}§   :t '(t i o im)|§   :b 'b}§)`
        );
        const b = docFromTextNotation(
          `(c§ ^{:e '(e o ea)§   :t '(t i o im)|§   3 {:w? 'w}§   :b 'b}§)`
        );
        void paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr forward in sets', () => {
        const a = docFromTextNotation(
          `(c§ #{:|e '(e o ea)§   3 {:w? 'w}§   :t '(t i o im)§   :b 'b}§)`
        );
        const b = docFromTextNotation(
          `(c§ #{'(e o ea) :|e§   3 {:w? 'w}§   :t '(t i o im)§   :b 'b}§)`
        );
        void paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair in binding box', () => {
        const b = docFromTextNotation(
          `(c§ [:e '(e o ea)§   3 {:w? 'w}§   :t |'(t i o im)§   :b 'b]§)`
        );
        const a = docFromTextNotation(
          `(c§ [:e '(e o ea)§   3 {:w? 'w}§   :b 'b§   :t |'(t i o im)]§)`
        );
        void paredit.dragSexprForward(b, ['c']);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });

    describe('backwardUp - one line', () => {
      it('Drags up from start of vector', () => {
        const b = docFromTextNotation(`(def foo [:|foo :bar :baz])`);
        const a = docFromTextNotation(`(def foo :|foo [:bar :baz])`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from middle of vector', () => {
        const b = docFromTextNotation(`(def foo [:foo |:bar :baz])`);
        const a = docFromTextNotation(`(def foo |:bar [:foo :baz])`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from end of vector', () => {
        const b = docFromTextNotation(`(def foo [:foo :bar :baz|])`);
        const a = docFromTextNotation(`(def foo :baz| [:foo :bar])`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from start of list', () => {
        const b = docFromTextNotation(`(d|e|f foo [:foo :bar :baz])`);
        const a = docFromTextNotation(`de|f (foo [:foo :bar :baz])`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up without killing preceding line comments', () => {
        const b = docFromTextNotation(`(;;foo§de|f foo [:foo :bar :baz])`);
        const a = docFromTextNotation(`de|f§(;;foo§ foo [:foo :bar :baz])`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up without killing preceding line comments or trailing parens', () => {
        const b = docFromTextNotation(`(def ;; foo§  |:foo)`);
        const a = docFromTextNotation(`|:foo§(def ;; foo§)`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('backwardUp - multi-line', () => {
      it('Drags up from indented vector', () => {
        const b = docFromTextNotation(`((fn foo§  [x]§  [|:foo§   :bar§   :baz])§ 1)`);
        const a = docFromTextNotation(`((fn foo§  [x]§  |:foo§  [:bar§   :baz])§ 1)`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from indented list', () => {
        const b = docFromTextNotation(`(|(fn foo§  [x]§  [:foo§   :bar§   :baz])§ 1)`);
        const a = docFromTextNotation(`|(fn foo§  [x]§  [:foo§   :bar§   :baz])§(1)`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from end of indented list', () => {
        const b = docFromTextNotation(`((fn foo§  [x]§  [:foo§   :bar§   :baz])§ |a)`);
        const a = docFromTextNotation(`|a§((fn foo§  [x]§  [:foo§   :bar§   :baz]))`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from indented vector w/o killing preceding comment', () => {
        const b = docFromTextNotation(`((fn foo§  [x]§  [:foo§   ;; foo§   :b|ar§   :baz])§ 1)`);
        const a = docFromTextNotation(`((fn foo§  [x]§  :b|ar§  [:foo§   ;; foo§§   :baz])§ 1)`);
        void paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('forwardDown - one line', () => {
      it('Drags down into vector', () => {
        const b = docFromTextNotation(`(def f|oo [:foo :bar :baz])`);
        const a = docFromTextNotation(`(def [f|oo :foo :bar :baz])`);
        void paredit.dragSexprForwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags down into vector past sexpression on the same level', () => {
        const b = docFromTextNotation(`(d|ef| foo [:foo :bar :baz])`);
        const a = docFromTextNotation(`(foo [def| :foo :bar :baz])`);
        void paredit.dragSexprForwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags down into vector w/o killing line comments on the way', () => {
        const b = docFromTextNotation(`(d|ef ;; foo§ [:foo :bar :baz])`);
        const a = docFromTextNotation(`(;; foo§ [d|ef :foo :bar :baz])`);
        void paredit.dragSexprForwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('forwardUp', () => {
      it('Drags forward out of vector', () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
        const a = docFromTextNotation(`((fn foo [x] [:foo] :b|ar)) :baz`);
        void paredit.dragSexprForwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags forward out of vector w/o killing line comments on the way', () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar ;; bar§])) :baz`);
        const a = docFromTextNotation(`((fn foo [x] [:foo ;; bar§] :b|ar)) :baz`);
        void paredit.dragSexprForwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('backwardDown', () => {
      it('Drags backward down into list', () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :bar])) :b|az`);
        const a = docFromTextNotation(`((fn foo [x] [:foo :bar]) :b|az)`);
        void paredit.dragSexprBackwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags backward down into list w/o killing line comments on the way', () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :bar])) ;; baz§:b|az`);
        const a = docFromTextNotation(`((fn foo [x] [:foo :bar]) :b|az) ;; baz`);
        void paredit.dragSexprBackwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it("Does not drag when can't drag down", () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
        const a = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
        void paredit.dragSexprBackwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
  });

  describe('edits', () => {
    describe('Close lists', () => {
      it('Advances cursor if at end of list of the same type', () => {
        const a = docFromTextNotation('(str "foo"|)');
        const b = docFromTextNotation('(str "foo")|');
        void paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Does not enter new closing parens in balanced doc', () => {
        const a = docFromTextNotation('(str |"foo")');
        const b = docFromTextNotation('(str |"foo")');
        void paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      xit('Enter new closing parens in unbalanced doc', () => {
        // TODO: Reinstall this test once the corresponding cursor test works
        //       (The extension actually behaves correctly.)
        const a = docFromTextNotation('(str |"foo"');
        const b = docFromTextNotation('(str )|"foo"');
        void paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Enter new closing parens in string', () => {
        const a = docFromTextNotation('(str "|foo"');
        const b = docFromTextNotation('(str ")|foo"');
        void paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });
    describe('String quoting', () => {
      it('Closes quote at end of string', () => {
        const a = docFromTextNotation('(str "foo|")');
        const b = docFromTextNotation('(str "foo"|)');
        void paredit.stringQuote(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Slurping', () => {
      describe('Slurping forwards', () => {
        it('slurps form after list', () => {
          const a = docFromTextNotation('(str|) "foo"');
          const b = docFromTextNotation('(str| "foo")');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, in multiline document', () => {
          const a = docFromTextNotation('(foo§ (str| ) "foo")');
          const b = docFromTextNotation('(foo§ (str| "foo"))');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps and adds leading space', () => {
          const a = docFromTextNotation('(s|tr)#(foo)');
          const b = docFromTextNotation('(s|tr #(foo))');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps without adding a space', () => {
          const a = docFromTextNotation('(s|tr )#(foo)');
          const b = docFromTextNotation('(s|tr #(foo))');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, trimming inside whitespace', () => {
          const a = docFromTextNotation('(str|   )"foo"');
          const b = docFromTextNotation('(str| "foo")');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, trimming outside whitespace', () => {
          const a = docFromTextNotation('(str|)   "foo"');
          const b = docFromTextNotation('(str| "foo")');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, trimming inside and outside whitespace', () => {
          const a = docFromTextNotation('(str|   )   "foo"');
          const b = docFromTextNotation('(str| "foo")');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after empty list', () => {
          const a = docFromTextNotation('(|) "foo"');
          const b = docFromTextNotation('(| "foo")');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('leaves newlines when slurp', () => {
          const a = docFromTextNotation('(fo|o§)  bar');
          const b = docFromTextNotation('(fo|o§  bar)');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps properly when closing paren is on new line', () => {
          // https://github.com/BetterThanTomorrow/calva/issues/1171
          const a = docFromTextNotation('(def foo§  (str|§   )§  42)');
          const b = docFromTextNotation('(def foo§  (str|§   §  42))');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form including meta and readers', () => {
          const a = docFromTextNotation('(|) ^{:a b} #c ^d "foo"');
          const b = docFromTextNotation('(| ^{:a b} #c ^d "foo")');
          void paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('Slurping backwards', () => {
        // TODO: Figure out why this test makes the following test fail
        //       It's something with in-string navigation...
        it.skip('slurps form before string', () => {
          const a = docFromTextNotation('(str) "fo|o"');
          const b = docFromTextNotation('"(str) fo|o"');
          void paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before list', () => {
          const a = docFromTextNotation('(str) (fo|o)');
          const b = docFromTextNotation('((str) fo|o)');
          void paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before list including meta and readers', () => {
          const a = docFromTextNotation('^{:a b} #c ^d "foo" (|)');
          // TODO: Figure out how to test result after format
          //       (Because that last space is then removed)
          const b = docFromTextNotation('(^{:a b} #c ^d "foo" |)');
          void paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
    });

    describe('Barfing', () => {
      describe('Barfing forwards', () => {
        it('barfs last form in list', () => {
          const a = docFromTextNotation('(str| "foo")');
          const b = docFromTextNotation('(str|) "foo"');
          void paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('leaves newlines when slurp', () => {
          const a = docFromTextNotation('(fo|o§  bar)');
          const b = docFromTextNotation('(fo|o)§  bar');
          void paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs form including meta and readers', () => {
          const a = docFromTextNotation('(| ^{:a b} #c ^d "foo")');
          const b = docFromTextNotation('(|) ^{:a b} #c ^d "foo"');
          void paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs form from balanced list, when inside unclosed list', () => {
          // Trying to expose:
          // https://github.com/BetterThanTomorrow/calva/issues/1585
          const a = docFromTextNotation('(let [a| a)');
          const b = docFromTextNotation('(let [a|) a');
          void paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Barfs symbols from vectors at multiple cursors positions', () => {
          const a = docFromTextNotation('[|a§ b]§[|1a§ b]');
          const b = docFromTextNotation('[|a]§ b§[|1a]§ b');
          void paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Barfs symbols from nested vectors at multiple cursors positions, needing post-format', () => {
          // TODO: This behaves before formatting happens
          //       In the ”real” editor formatting happens after the barf
          //       and formatting is still a single-cursor thing...
          const a = docFromTextNotation('([|a§  b])§([|1a§  b])');
          const b = docFromTextNotation('([|a]§  b)§([|1a]§  b)');
          void paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('Barfing backwards', () => {
        it('barfs first form in list', () => {
          const a = docFromTextNotation('((str) fo|o)');
          const b = docFromTextNotation('(str) (fo|o)');
          void paredit.backwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs first form in list including meta and readers', () => {
          const a = docFromTextNotation('(^{:a b} #c ^d "foo"|)');
          const b = docFromTextNotation('^{:a b} #c ^d "foo"(|)');
          void paredit.backwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
    });

    describe('Raise', () => {
      it('raises the current form when cursor is preceding', () => {
        const a = docFromTextNotation('(comment§  (str |#(foo)))');
        const b = docFromTextNotation('(comment§  |#(foo))');
        void paredit.raiseSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('raises the current form when cursor is trailing', () => {
        const a = docFromTextNotation('(comment§  (str #(foo)|))');
        const b = docFromTextNotation('(comment§  #(foo)|)');
        void paredit.raiseSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('raises the current form when with two cursors ordered left->right', () => {
        const a = docFromTextNotation('(a (b|)) (a (b|1)) (a (b))');
        const b = docFromTextNotation('(a b|) (a b|1) (a (b))');
        void paredit.raiseSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('raises the current form when with two cursors ordered right->left', () => {
        const a = docFromTextNotation('(a (b|1)) (a (b|)) (a (b))');
        const b = docFromTextNotation('(a b|1) (a b|) (a (b))'); // "(a b) (a b) (a (b))", [[ 10, 10], [4, 4]]
        void paredit.raiseSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Kill character backwards (backspace)', () => {
      it('Leaves closing paren of empty list alone', async () => {
        const a = docFromTextNotation('{::foo ()|§ ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes closing paren if unbalance', async () => {
        const a = docFromTextNotation('{::foo )|§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening paren of non-empty list alone', async () => {
        const a = docFromTextNotation('{::foo (|a)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |(a)§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo "|a"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |"a"§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves closing quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo "a"|§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "a|"§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings', async () => {
        const a = docFromTextNotation('{::foo "a|"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 2', async () => {
        const a = docFromTextNotation('{::foo "a|a"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 3', async () => {
        const a = docFromTextNotation('{::foo "aa|"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "a|"§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote', async () => {
        const a = docFromTextNotation('{::foo \\"|§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote in string', async () => {
        const a = docFromTextNotation('{::foo "\\"|"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in list', async () => {
        const a = docFromTextNotation('{::foo (a|)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty list function', async () => {
        const a = docFromTextNotation('{::foo (|)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty set', async () => {
        const a = docFromTextNotation('#{|}');
        const b = docFromTextNotation('|');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty literal function with trailing newline', async () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1079
        const a = docFromTextNotation('{::foo #(|)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes open paren prefix characters', async () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1122
        const a = docFromTextNotation('#|(foo)');
        const b = docFromTextNotation('|(foo)');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes open map curly prefix/ns characters', async () => {
        const a = docFromTextNotation('#:same|{:thing :here}');
        const b = docFromTextNotation('#:sam|{:thing :here}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes open set hash characters', async () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1122
        const a = docFromTextNotation('#|{:thing :here}');
        const b = docFromTextNotation('|{:thing :here}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Moves cursor past entire open paren, including prefix characters', async () => {
        const a = docFromTextNotation('#(|foo)');
        const b = docFromTextNotation('|#(foo)');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes unbalanced bracket', async () => {
        // This hangs the structural editing in the real editor
        // https://github.com/BetterThanTomorrow/calva/issues/1573
        const a = docFromTextNotation('([{|)');
        const b = docFromTextNotation('([|');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Kill character forwards (delete)', () => {
      it('Leaves closing paren of empty list alone', async () => {
        const a = docFromTextNotation('{::foo |()§ ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes closing paren if unbalance', async () => {
        const a = docFromTextNotation('{::foo |)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening paren of non-empty list alone', async () => {
        const a = docFromTextNotation('{::foo |(a)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo (|a)§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo |"a"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves closing quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo "a|"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "a"|§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings', async () => {
        const a = docFromTextNotation('{::foo "|a"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 2', async () => {
        const a = docFromTextNotation('{::foo "|aa"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote', async () => {
        const a = docFromTextNotation('{::foo |\\"§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote in string', async () => {
        const a = docFromTextNotation('{::foo "|\\""§ ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in list', async () => {
        const a = docFromTextNotation('{::foo (|a)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty list function', async () => {
        const a = docFromTextNotation('{::foo (|)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty set', async () => {
        const a = docFromTextNotation('#{|}');
        const b = docFromTextNotation('|');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty literal function with trailing newline', async () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1079
        const a = docFromTextNotation('{::foo #(|)§ ::bar :foo}');
        const b = docFromTextNotation('{::foo |§ ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Kill/Delete forward to End of List', () => {
      it('Multi: kills last symbol in each list after cursor', async () => {
        const a = docFromTextNotation('(|2a)(|1a)(|a)');
        const b = docFromTextNotation('(|2)(|1)(|)');
        await paredit.killForwardList(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Kill/Delete backward to start of List', () => {
      it('Multi: kills last symbol in list after cursor', async () => {
        const a = docFromTextNotation('(a|)(a|1)(a|2)'); // "(a)(a)(a)" [[2,2], [5,5], [8,8]]
        const b = docFromTextNotation('(|)(|1)(|2)'); // "()()()" [[1,1], [3,3], [5,5]],
        await paredit.killBackwardList(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Kill/Delete Sexp', () => {
      describe('Kill/Delete Sexp Forward', () => {
        it('Multi: kills/deletes sexp forwards', () => {
          const a = docFromTextNotation('(|2a) (|1a) (|a) (a)');
          const b = docFromTextNotation('(|2) (|1) (|) (a)');
          void paredit.killSexpForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
      describe('Kill/Delete Sexp Backwards', () => {
        it('Multi: kills/deletes sexp Backwards', async () => {
          const a = docFromTextNotation('(a|2) (a|1) (a|) (a)');
          const b = docFromTextNotation('(|2) (|1) (|) (a)');
          await paredit.killSexpBackward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
    });

    describe('addRichComment', () => {
      it('Adds Rich Comment after Top Level form', () => {
        const a = docFromTextNotation('(fo|o)§§(bar)');
        const b = docFromTextNotation('(foo)§§(comment§  |§  )§§(bar)');
        paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels', () => {
        const a = docFromTextNotation('(foo)§|§(bar)');
        const b = docFromTextNotation('(foo)§§(comment§  |§  )§§(bar)');
        paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, before Top Level form', () => {
        const a = docFromTextNotation('(foo)§§|(bar)');
        const b = docFromTextNotation('(foo)§§(comment§  |§  )§§(bar)');
        paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, after Top Level form', () => {
        const a = docFromTextNotation('(foo)|§§(bar)');
        const b = docFromTextNotation('(foo)§§(comment§  |§  )§§(bar)');
        paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, in comment', () => {
        const a = docFromTextNotation('(foo)§;foo| bar§(bar)');
        const b = docFromTextNotation('(foo)§;foo bar§§(comment§  |§  )§§(bar)');
        paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Moves to Rich Comment below, if any', () => {
        const a = docFromTextNotation('(foo|)§§(comment§§bar§§baz)');
        const b = docFromTextNotation('(foo)§§(comment§§|bar§§baz)');
        paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Moves to Rich Comment below, if any, looking behind line comments', () => {
        const a = docFromTextNotation('(foo|)§§;;line comment§§(comment§§bar§§baz)');
        const b = docFromTextNotation('(foo)§§;;line comment§§(comment§§|bar§§baz)');
        paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('splice sexp', () => {
      it('does not splice empty', () => {
        const a = docFromTextNotation('|');
        const b = docFromTextNotation('|');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splices empty list', () => {
        const a = docFromTextNotation('(|)');
        const b = docFromTextNotation('|');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splices two list (multi-cursor', () => {
        const a = docFromTextNotation('(|a)§(|1b)');
        // TODO: This is quite strange.
        //       In the VS Code editor the result is:
        //       '|a§b|1'
        //       Running this test, the result is:
        //       '|a§(b|1'
        //       (Both are wrong)
        const b = docFromTextNotation('|a§|1b');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splices multiple list', () => {
        const a = docFromTextNotation('(|a)§(|1b b)§(|2c c c)§(|3d d d d)');
        const b = docFromTextNotation('|a§|1b b§|2c c c§|3d d d d');
        // TODO: Same weirdness as with the two lists above
        //       What I get in VS Code:
        //       '|a§b |1b§c c |2c§d d d |3d'
        //       What this test produces:
        //       '|a§(b|1b)§c c|2c)§(dd d|3d)'
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splices list also when forms have meta and readers', () => {
        const a = docFromTextNotation('(^{:d e} #a|a b c)');
        const b = docFromTextNotation('^{:d e} #a|a b c');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it.skip('splices list with meta and readers', () => {
        // TODO: Probably the meta data attached to the list should be removed
        const a = docFromTextNotation('^{:d e} #a (|a b c)');
        const b = docFromTextNotation('|a b c');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splice vector', () => {
        const a = docFromTextNotation('[a| b c]');
        const b = docFromTextNotation('a| b c');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splice map', () => {
        const a = docFromTextNotation('{a| b}');
        const b = docFromTextNotation('a| b');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('splice nested', () => {
        const a = docFromTextNotation('[1 {ab| cd} 2]');
        const b = docFromTextNotation('[1 ab| cd 2]');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('splice set', () => {
        // TODO: Figure out why the cursor gets misplaced
        const a = docFromTextNotation('#{a| b}');
        const b = docFromTextNotation('a |b');
        void paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      // NB: enabling this breaks bunch of other tests.
      //     Not sure why, but it can be run successfully by itself.
      it.skip('splice string', () => {
        const a = docFromTextNotation('"h|ello"');
        void paredit.spliceSexp(a);
        expect(getText(a)).toEqual('hello');
      });
    });

    describe('wrap sexp', () => {
      it('wraps symbol', () => {
        const a = docFromTextNotation('|a');
        const b = docFromTextNotation('(|a)');
        void paredit.wrapSexpr(a, '(', ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('wraps multiple symbols (multi-cursor)', () => {
        const a = docFromTextNotation('|a§|1b');
        const b = docFromTextNotation('(|a)§(|1b)');
        void paredit.wrapSexpr(a, '(', ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('wraps list', () => {
        const a = docFromTextNotation('(a)|');
        const b = docFromTextNotation('[(a)|]');
        void paredit.wrapSexpr(a, '[', ']');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('wraps multiple list (multi-cursor)', () => {
        const a = docFromTextNotation('(a)|§(b)|1');
        const b = docFromTextNotation('[(a)|]§[(b)|1]');
        void paredit.wrapSexpr(a, '[', ']');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('wraps selection', () => {
        // TODO: See if we can maintain the selection here
        const a = docFromTextNotation('|a|');
        const b = docFromTextNotation('(|a)');
        void paredit.wrapSexpr(a, '(', ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('wraps multiple selections (multi-cursor)', () => {
        const a = docFromTextNotation('|a|§|1b|1');
        const b = docFromTextNotation('(|a)§(|1b)');
        void paredit.wrapSexpr(a, '(', ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });
  });
});
