import * as expect from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as model from '../../../cursor-doc/model';
import {
  docFromTextNotation,
  textAndSelection,
  getText,
  textAndSelections,
} from '../common/text-notation';
import { ModelEditRange, ModelEditSelection } from '../../../cursor-doc/model';
import { last } from 'lodash';

model.initScanner(20000);

/**
 * TODO: Use await instead of void on edit operations
 */

describe('paredit', () => {
  const docText = '(def foo [:foo :bar :baz])';
  let doc: model.StringDocument;
  const startSelection = new ModelEditSelection(0, 0);

  beforeEach(() => {
    doc = new model.StringDocument(docText);
    doc.selections = [startSelection.clone()];
  });

  describe('movement', () => {
    describe('rangeToSexprForward/forwardSexpRange', () => {
      it('Finds the list in front', () => {
        const a = docFromTextNotation('|(def foo [vec])');
        const b = docFromTextNotation('|(def foo [vec])|');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through metadata', () => {
        const a = docFromTextNotation('|^:foo (def foo [vec])');
        const b = docFromTextNotation('|^:foo (def foo [vec])|');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (def foo [vec])');
        const b = docFromTextNotation('|^:f #a #b (def foo [vec])|');
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
      it('Returns empty range when no forward sexp', () => {
        const a = docFromTextNotation('(def foo [:foo :bar :baz|])');
        const b = docFromTextNotation('(def foo [:foo :bar :baz|])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds next symbol, including leading space', () => {
        const a = docFromTextNotation('(>0def>0 foo [vec])');
        const b = docFromTextNotation('(def>0 foo>0 [vec])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds following vector including leading space', () => {
        const a = docFromTextNotation('(>0def foo>0 [vec])');
        const b = docFromTextNotation('(def foo>0 [vec]>0)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Reverses direction of selection and finds next sexp', () => {
        const a = docFromTextNotation('(<0def foo<0 [vec])');
        const b = docFromTextNotation('(def foo>0 [vec]>0)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('rangeToSexprBackward/backwardSexpRange', () => {
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
        const a = docFromTextNotation('(def <0foo [vec]<0)');
        const b = docFromTextNotation('(>0def >0foo [vec])');
        expect(paredit.backwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('forwardHybridSexpRange (for killRight)', () => {
      it('Finds end of string', () => {
        const a = docFromTextNotation('"This |needs to find the end of the string."');
        const b = docFromTextNotation('"This |needs to find the end of the string.|"');
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

      it('Finds newline in multi line string (Windows)', () => {
        const a = docFromTextNotation('"This |needs to find the end\r\n of the string."');
        const b = docFromTextNotation('"This |needs to find the end|\r\n of the string."');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds end of comment', () => {
        const a = docFromTextNotation('(a |;; foo\n e)');
        const b = docFromTextNotation('(a |;; foo|\n e)');
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
        const a = docFromTextNotation('(a| b (c\n d) e)');
        const b = docFromTextNotation('(a| b (c\n d)| e)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 1 (Windows)', () => {
        const a = docFromTextNotation('(a| b (c\r\n d) e)');
        const b = docFromTextNotation('(a| b (c\r\n d)| e)');
        const [start, end] = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual([start, end]);
      });

      it('Maintains balanced delimiters 2', () => {
        const a = docFromTextNotation('(aa| (c (e\nf)) g)');
        const b = docFromTextNotation('(aa| (c (e\nf))|g)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 2 (Windows)', () => {
        const a = docFromTextNotation('(aa| (c (e\r\nf)) g)');
        const b = docFromTextNotation('(aa| (c (e\r\nf))|g)');
        const [start, end] = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual([start, end]);
      });

      it('Maintains balanced delimiters 3', () => {
        const a = docFromTextNotation('(aa| (  c (e\nf)) g)');
        const b = docFromTextNotation('(aa| (  c (e\nf))|g)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 3 (Windows)', () => {
        const a = docFromTextNotation('(aa| (  c (e\r\nf)) g)');
        const b = docFromTextNotation('(aa| (  c (e\r\nf))|g)');
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

      it('Advances past newline when invoked on newline (Windows)', () => {
        const a = docFromTextNotation('(a|\r\n e) g)');
        const b = docFromTextNotation('(a|\r\n| e) g)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Advances past newline, preserving leading whitepace when invoked on newline with squash off', () => {
        const a = docFromTextNotation('(a|\n   e) g)');
        const b = docFromTextNotation('(a|\n|   e)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a, a.selections[0].active, false);
        expect(actual).toEqual(expected);
      });

      it('Advances past newline, preserving leading whitepace when invoked on newline with squash off (Windows)', () => {
        const a = docFromTextNotation('(a|\r\n   e) g)');
        const b = docFromTextNotation('(a|\r\n|   e) g)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a, a.selections[0].active, false);
        expect(actual).toEqual(expected);
      });

      it('Advances past newline, squashing leading whitepace when invoked on newline', () => {
        const a = docFromTextNotation('(a|\n   e) g)');
        const b = docFromTextNotation('(a|\n  | e) g)');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Advances past newline, squashing leading whitepace when invoked on newline (Windows)', () => {
        const a = docFromTextNotation('(a|\r\n   e) g)');
        const b = docFromTextNotation('(a|\r\n  | e) g)');
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

      it('Finds end of expr in multiline maps (Windows)', () => {
        const a = docFromTextNotation('{:a 1 |:b (+\r\n 0\r\n 2\r\n) :c 3}');
        const b = docFromTextNotation('{:a 1 |:b (+\r\n 0\r\n 2\r\n)| :c 3}');
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

      it('Finds end of expr in multiline bindings (Windows)', () => {
        const a = docFromTextNotation('(let [|a (+\r\n 1 \r\n 2)\r\n b (+ 2 3)] (+ a b))');
        const b = docFromTextNotation('(let [|a (+\r\n 1 \r\n 2)|\r\n b (+ 2 3)] (+ a b))');
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

      it('Finds range in token with form over multiple lines 2', () => {
        const a = docFromTextNotation('|a [\n 1 \n]');
        const b = docFromTextNotation('|a [\n 1 \n]|');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds range in token with form over multiple lines 2 (Windows)', () => {
        const a = docFromTextNotation('|a [\r\n 1 \r\n]');
        const b = docFromTextNotation('|a [\r\n 1 \r\n]|');
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds range in token with form over multiple lines (Windows)', () => {
        const a = docFromTextNotation(' | 2 [\r\n 1 \r\n]');
        const b = docFromTextNotation(' | 2 [\r\n 1 \r\n]|');
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

      it('Deals with empty lines (Windows)', () => {
        const a = docFromTextNotation('|\r\n');
        const b = docFromTextNotation('|\r\n|');
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

      it('Deals with comments with empty line (Windows)', () => {
        const a = docFromTextNotation(';; |\r\n');
        const b = docFromTextNotation(';; |\r\n|');
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
          '(comment•  #_|[a b (c d•              e•              f) g]•  :a•)'
        );
        const b = docFromTextNotation(
          '(comment•  #_|[a b (c d•              e•              f) g]|• :a•)'
        );
        const expected = textAndSelection(b)[1];
        const actual = paredit.forwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });
    });

    // TODO: backwardHybridSexpRange should probably be tested as a Directed range, not undirected
    describe('backwardHybridSexpRange (for killLeft)', () => {
      it('Finds whole string in list', () => {
        const a = docFromTextNotation('("This needs to find the start of the string."|)');
        const b = docFromTextNotation('(|"This needs to find the start of the string."|)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds whole string', () => {
        const a = docFromTextNotation('"This needs to find the start of the string."|');
        const b = docFromTextNotation('|"This needs to find the start of the string."|');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of string', () => {
        const a = docFromTextNotation('"This needs to find the |start of the string."');
        const b = docFromTextNotation('"|This needs to find the |start of the string."');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds newline in multi line string', () => {
        const a = docFromTextNotation('"This needs to find the start\n of the |string."');
        const b = docFromTextNotation('"This needs to find the start\n |of the |string."');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds newline in multi line string (Windows)', () => {
        const a = docFromTextNotation('"This needs to find the start\r\n of the |string."');
        const b = docFromTextNotation('"This needs to find the start\r\n |of the |string."');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of form from inside comment', () => {
        const a = docFromTextNotation('(a ;; foo|\n e)');
        const b = docFromTextNotation('(|a ;; foo|\n e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of form from inside comment (Windows)', () => {
        const a = docFromTextNotation('(a ;; foo|\r\n e)');
        const b = docFromTextNotation('(|a ;; foo|\r\n e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 1', () => {
        const a = docFromTextNotation('(a b (c\n d) e|)');
        const b = docFromTextNotation('(a b |(c\n d) e|)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 1 (Windows)', () => {
        const a = docFromTextNotation('(a b (c\r\n d) e|)');
        const b = docFromTextNotation('(a b |(c\r\n d) e|)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 2', () => {
        const a = docFromTextNotation('(aa (c (e\nf)) |g)');
        const b = docFromTextNotation('(aa |(c (e\nf)) |g)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 2 (Windows)', () => {
        const a = docFromTextNotation('(aa (c (e\r\nf)) |g)');
        const b = docFromTextNotation('(aa |(c (e\r\nf)) |g)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 3', () => {
        const a = docFromTextNotation('(aa (  c (e\nf)) |g)');
        const b = docFromTextNotation('(aa |(  c (e\nf)) |g)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Maintains balanced delimiters 3 (Windows)', () => {
        const a = docFromTextNotation('(aa (  c (e\r\nf)) |g)');
        const b = docFromTextNotation('(aa |(  c (e\r\nf)) |g)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Squashes preceding whitespace, stopping at line start', () => {
        const a = docFromTextNotation('(a\n |e) g)');
        const b = docFromTextNotation('(a\n| |e) g)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Squashes preceding whitespace, stopping at line start (Windows)', () => {
        const a = docFromTextNotation('(a\r\n |e) g)');
        const b = docFromTextNotation('(a\r\n| |e) g)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start when invoked at line start', () => {
        const a = docFromTextNotation('(a\n| e) g)');
        const b = docFromTextNotation('(a|\n| e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start when invoked at line start (Windows)', () => {
        const a = docFromTextNotation('(a\r\n| e) g)');
        const b = docFromTextNotation('(a|\r\n| e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start, preserving leading whitepace when invoked at line start with squash off', () => {
        const a = docFromTextNotation('(a  \n| e) g)');
        const b = docFromTextNotation('(a  |\n| e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, false);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start, preserving leading whitepace when invoked at line start with squash off (Windows)', () => {
        const a = docFromTextNotation('(a  \r\n| e) g)');
        const b = docFromTextNotation('(a  |\r\n| e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, false);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start, squashing whitepace when invoked at line start', () => {
        const a = docFromTextNotation('(a  \n| e) g)');
        const b = docFromTextNotation('(a | \n| e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start, squashing whitepace when invoked at line start (Windows)', () => {
        const a = docFromTextNotation('(a  \r\n| e) g)');
        const b = docFromTextNotation('(a | \r\n| e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start, squashing only preceding whitepace when invoked at line start', () => {
        const a = docFromTextNotation('(a  \n| e) g)');
        const b = docFromTextNotation('(a | \n| e)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      it('Retreats past line start, squashing only preceding whitepace when invoked at line start (Windows)', () => {
        const a = docFromTextNotation('(a  \r\n| e) g)');
        const b = docFromTextNotation('(a | \r\n| e) g)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      // https://github.com/BetterThanTomorrow/calva/pull/2427#issuecomment-1985910937
      it('Finds start of line after whitespace', () => {
        const a = docFromTextNotation('(a\n |b)');
        const b = docFromTextNotation('(a\n| |b)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      it('Finds start of line after whitespace (Windows)', () => {
        const a = docFromTextNotation('(a\r\n |b)');
        const b = docFromTextNotation('(a\r\n| |b)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      it('Finds newline when at line start', () => {
        const a = docFromTextNotation('(a\n| b)');
        const b = docFromTextNotation('(a|\n| b)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      it('Finds newline when at line start (Windows)', () => {
        const a = docFromTextNotation('(a\r\n| b)');
        const b = docFromTextNotation('(a|\r\n| b)');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a, a.selections[0].active, true);
        expect(actual).toEqual(expected);
      });

      it('Finds start of vectors', () => {
        const a = docFromTextNotation('[a [b c d e| f] g h]');
        const b = docFromTextNotation('[a [|b c d e| f] g h]');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of lists', () => {
        const a = docFromTextNotation('(foo |bar)\n');
        const b = docFromTextNotation('(|foo |bar)\n');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of maps', () => {
        const a = docFromTextNotation('{:a 1 :b 2| :c 3}');
        const b = docFromTextNotation('{|:a 1 :b 2| :c 3}');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of line in multiline maps', () => {
        const a = docFromTextNotation('{:a 1 \n:b 2| :c 3}');
        const b = docFromTextNotation('{:a 1 \n|:b 2| :c 3}');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of line in multiline maps (Windows)', () => {
        const a = docFromTextNotation('{:a 1 \r\n:b 2| :c 3}');
        const b = docFromTextNotation('{:a 1 \r\n|:b 2| :c 3}');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of expr in multiline maps', () => {
        const a = docFromTextNotation('{:a 1 :b 2 (+\n 0\n 2\n) 3| :c 4}');
        const b = docFromTextNotation('{:a 1 :b 2 |(+\n 0\n 2\n) 3| :c 4}');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of expr in multiline maps (Windows)', () => {
        const a = docFromTextNotation('{:a 1 :b 2 (+\r\n 0\r\n 2\r\n) 3| :c 4}');
        const b = docFromTextNotation('{:a 1 :b 2 |(+\r\n 0\r\n 2\r\n) 3| :c 4}');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of immediate list even in bindings if at list close', () => {
        const a = docFromTextNotation('(let [a (+ 1 2)\n b (+ 2 3)|] (+ a b))');
        const b = docFromTextNotation('(let [a (+ 1 2)\n b |(+ 2 3)|] (+ a b))');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of line in bindings if not at list close', () => {
        const a = docFromTextNotation('(let [{a :a} c\n {b :b} d|] (+ a b))');
        const b = docFromTextNotation('(let [{a :a} c\n |{b :b} d|] (+ a b))');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of expr in multiline bindings', () => {
        const a = docFromTextNotation('(let [{a :a\n b :b} d| c (+ 2 3)] (+ a b))');
        const b = docFromTextNotation('(let [|{a :a\n b :b} d| c (+ 2 3)] (+ a b))');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds start of expr in multiline bindings (Windows)', () => {
        const a = docFromTextNotation('(let [{a :a\r\n b :b} d| c (+ 2 3)] (+ a b))');
        const b = docFromTextNotation('(let [|{a :a\r\n b :b} d| c (+ 2 3)] (+ a b))');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds range in line of tokens', () => {
        const a = docFromTextNotation('2 \n"hello" :hello/world bye | ');
        const b = docFromTextNotation('2 \n|"hello" :hello/world bye | ');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds range in token with form over multiple lines', () => {
        const a = docFromTextNotation('3 [\n 1 \n] a|');
        const b = docFromTextNotation('3 |[\n 1 \n] a|');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds range in token with form over multiple lines (Windows)', () => {
        const a = docFromTextNotation('3 [\r\n 1 \r\n] a|');
        const b = docFromTextNotation('3 |[\r\n 1 \r\n] a|');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments start of line', () => {
        const a = docFromTextNotation('\n;;  hi|');
        const b = docFromTextNotation('\n|;;  hi|');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments start of line (Windows)', () => {
        const a = docFromTextNotation('\r\n;;  hi|');
        const b = docFromTextNotation('\r\n|;;  hi|');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments middle of line', () => {
        const a = docFromTextNotation('\n;; |hi');
        const b = docFromTextNotation('\n|;; |hi');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments middle of line (Windows)', () => {
        const a = docFromTextNotation('\r\n;; |hi');
        const b = docFromTextNotation('\r\n|;; |hi');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with empty lines', () => {
        const a = docFromTextNotation('\n|');
        const b = docFromTextNotation('|\n|');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with empty lines (Windows)', () => {
        const a = docFromTextNotation('\r\n|');
        const b = docFromTextNotation('|\r\n|');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: true } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments with empty line', () => {
        const a = docFromTextNotation('\n;; |');
        const b = docFromTextNotation('\n|;; |');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Deals with comments with empty line (Windows)', () => {
        const a = docFromTextNotation('\r\n;; |');
        const b = docFromTextNotation('\r\n|;; |');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Does not retreat when on closing token type ', () => {
        const a = docFromTextNotation('\n(|a e)\n');
        const b = docFromTextNotation('\n(||a e)\n');
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Finds the full form after an ignore marker', () => {
        // https://github.com/BetterThanTomorrow/calva/pull/1293#issuecomment-927123696
        const a = docFromTextNotation(
          '(comment•  #_[a b (c d•              e•              f) g]|•  :a•)'
        );
        const b = docFromTextNotation(
          // '(comment•  #_<[a b (c d•              e•              f) g]<• :a•)'
          '(comment•  #_|[a b (c d•              e•              f) g]|• :a•)'
        );
        const expected = { range: textAndSelection(b)[1], editOptions: { skipFormat: false } };
        const actual = paredit.backwardHybridSexpRange(a);
        expect(actual).toEqual(expected);
      });

      it('Takes 3 invocations to kill to first non-whitespace, preceding whitespace and then preceding newline', () => {
        const firstBase = docFromTextNotation('(:a :b \n    :c :d|)');
        const firstDoc = docFromTextNotation('(:a :b \n    |:c :d|)');
        const firstExpected = {
          range: textAndSelection(firstDoc)[1],
          editOptions: { skipFormat: false },
        };
        const firstActual = paredit.backwardHybridSexpRange(firstBase);
        expect(firstActual).toEqual(firstExpected);

        const secondBase = docFromTextNotation('(:a :b \n    |:c :d)');
        const secondDoc = docFromTextNotation('(:a :b \n|    |:c :d)');
        const secondExpected = {
          range: textAndSelection(secondDoc)[1],
          editOptions: { skipFormat: true },
        };
        const secondActual = paredit.backwardHybridSexpRange(secondBase);
        expect(secondActual).toEqual(secondExpected);

        const thirdBase = docFromTextNotation('(:a :b \n|    :c :d)');
        const thirdDoc = docFromTextNotation('(:a :b |\n|    :c :d)');
        const thirdExpected = {
          range: textAndSelection(thirdDoc)[1],
          editOptions: { skipFormat: true },
        };
        const thirdActual = paredit.backwardHybridSexpRange(thirdBase);
        expect(thirdActual).toEqual(thirdExpected);
      });

      it('Takes 3 invocations to kill to first non-whitespace, preceding whitespace and then preceding newline (Windows)', () => {
        const firstBase = docFromTextNotation('(:a :b \r\n    :c :d|)');
        const firstDoc = docFromTextNotation('(:a :b \r\n    |:c :d|)');
        const firstExpected = {
          range: textAndSelection(firstDoc)[1],
          editOptions: { skipFormat: false },
        };
        const firstActual = paredit.backwardHybridSexpRange(firstBase);
        expect(firstActual).toEqual(firstExpected);

        const secondBase = docFromTextNotation('(:a :b \r\n    |:c :d)');
        const secondDoc = docFromTextNotation('(:a :b \r\n|    |:c :d)');
        const secondExpected = {
          range: textAndSelection(secondDoc)[1],
          editOptions: { skipFormat: true },
        };
        const secondActual = paredit.backwardHybridSexpRange(secondBase);
        expect(secondActual).toEqual(secondExpected);

        const thirdBase = docFromTextNotation('(:a :b \r\n|    :c :d)');
        const thirdDoc = docFromTextNotation('(:a :b |\r\n|    :c :d)');
        const thirdExpected = {
          range: textAndSelection(thirdDoc)[1],
          editOptions: { skipFormat: true },
        };
        const thirdActual = paredit.backwardHybridSexpRange(thirdBase);
        expect(thirdActual).toEqual(thirdExpected);
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
      it('Finds next symbol, including leading space', () => {
        const a = docFromTextNotation('(>0def>0 foo [vec])');
        const b = docFromTextNotation('(def>0 foo>0 [vec])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds following vector including leading space', () => {
        const a = docFromTextNotation('(>0def foo>0 [vec])');
        const b = docFromTextNotation('(def foo>0 [vec]>0)');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Reverses direction of selection and finds next sexp', () => {
        const a = docFromTextNotation('(<0def foo<0 [vec])');
        const b = docFromTextNotation('(def foo>0 [vec]>0)');
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
        const a = docFromTextNotation('(def <0foo [vec]<0)');
        const b = docFromTextNotation('(>0def >0foo [vec])');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Goes up when at front bounds', () => {
        const a = docFromTextNotation('(def x (|inc 1))');
        const b = docFromTextNotation('(def x |(|inc 1))');
        expect(paredit.backwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('moveToRangeRight', () => {
      it('Places cursor at the right end of the selection', () => {
        const a = docFromTextNotation('(def >0foo>0 [vec])');
        const b = docFromTextNotation('(def foo| [vec])');
        paredit.moveToRangeRight(a, textAndSelections(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Places cursor at the right end of the selection 2', () => {
        const a = docFromTextNotation('(>0def foo>0 [vec])');
        const b = docFromTextNotation('(def foo| [vec])');
        paredit.moveToRangeRight(a, textAndSelections(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Move to right of given range, regardless of previous selection', () => {
        const a = docFromTextNotation('(<0def<0 foo [vec])');
        const b = docFromTextNotation('(def foo >0[vec]>0)');
        const c = docFromTextNotation('(def foo [vec]|)');
        paredit.moveToRangeRight(a, textAndSelections(b)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(c));
      });
    });

    describe('moveToRangeLeft', () => {
      it('Places cursor at the left end of the selection', () => {
        const a = docFromTextNotation('(def >0foo>0 [vec])');
        const b = docFromTextNotation('(def |foo [vec])');
        paredit.moveToRangeLeft(a, textAndSelections(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Places cursor at the left end of the selection 2', () => {
        const a = docFromTextNotation('(>0def foo>0 [vec])');
        const b = docFromTextNotation('(|def foo [vec])');
        paredit.moveToRangeLeft(a, textAndSelections(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Move to left of given range, regardless of previous selection', () => {
        const a = docFromTextNotation('(<0def<0 foo [vec])');
        const b = docFromTextNotation('(def foo >0[vec]>0)');
        const c = docFromTextNotation('(def foo |[vec])');
        paredit.moveToRangeLeft(a, textAndSelections(b)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(c));
      });
    });

    describe('Forward to end of list', () => {
      it('rangeToForwardList', () => {
        const a = docFromTextNotation('(|c•(#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('(|c•(#b •[:f :b :z])•#z•1|)');
        expect(paredit.rangeToForwardList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToForwardList through readers and meta', () => {
        const a = docFromTextNotation('(|^e #a ^{:c d}•#b•[:f]•#z•1)');
        const b = docFromTextNotation('(|^e #a ^{:c d}•#b•[:f]•#z•1|)');
        expect(paredit.rangeToForwardList(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('Backward to start of list', () => {
      it('rangeToBackwardList', () => {
        const a = docFromTextNotation('(c•(#b •[:f :b :z])•#z•1|)');
        const b = docFromTextNotation('(|c•(#b •[:f :b :z])•#z•1|)');
        expect(paredit.rangeToBackwardList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToBackwardList through readers and meta', () => {
        const a = docFromTextNotation('(^e #a ^{:c d}•#b•[:f]•#z•1|)');
        const b = docFromTextNotation('(|^e #a ^{:c d}•#b•[:f]•#z•1|)');
        expect(paredit.rangeToBackwardList(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('Down list', () => {
      it('rangeToForwardDownList', () => {
        const a = docFromTextNotation('(|c•(#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('(|c•(|#b •[:f :b :z])•#z•1)');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToForwardDownList through readers', () => {
        const a = docFromTextNotation('(|c•#f•(#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('(|c•#f•(|#b •[:f :b :z])•#z•1)');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToForwardDownList through metadata', () => {
        const a = docFromTextNotation('(|c•^f•(#b •[:f :b]))');
        const b = docFromTextNotation('(|c•^f•(|#b •[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToForwardDownList through metadata collection', () => {
        const a = docFromTextNotation('(|c•^{:f 1}•(#b •[:f :b]))');
        const b = docFromTextNotation('(|c•^{:f 1}•(|#b •[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToForwardDownList through metadata and readers', () => {
        const a = docFromTextNotation('(|c•^:a #f•(#b •[:f :b]))');
        const b = docFromTextNotation('(|c•^:a #f•(|#b •[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToForwardDownList through metadata collection and reader', () => {
        const a = docFromTextNotation('(|c•^{:f 1}•#a •(#b •[:f :b]))');
        const b = docFromTextNotation('(|c•^{:f 1}•#a •(|#b •[:f :b]))');
        expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1]);
      });
    });

    describe('Backward Up list', () => {
      it('rangeToBackwardUpList', () => {
        const a = docFromTextNotation('(c•(|#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('(c•|(|#b •[:f :b :z])•#z•1)');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToBackwardUpList through readers', () => {
        const a = docFromTextNotation('(c•#f•(|#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('(c•|#f•(|#b •[:f :b :z])•#z•1)');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToBackwardUpList through metadata', () => {
        const a = docFromTextNotation('(c•^f•(|#b •[:f :b]))');
        const b = docFromTextNotation('(c•|^f•(|#b •[:f :b]))');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToBackwardUpList through metadata and readers', () => {
        const a = docFromTextNotation('(c•^:a #f•(|#b •[:f :b]))');
        const b = docFromTextNotation('(c•|^:a #f•(|#b •[:f :b]))');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1]);
      });
      it('rangeToBackwardUpList 2', () => {
        // TODO: This is wrong! But real Paredit behaves as it should...
        const a = docFromTextNotation('(a(b(c•#f•(#b •|[:f :b :z])•#z•1)))');
        const b = docFromTextNotation('(a(b|(c•#f•(#b •|[:f :b :z])•#z•1)))');
        expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1]);
      });
    });
  });

  describe('Reader tags', () => {
    it('dragSexprBackward', async () => {
      const a = docFromTextNotation('(a(b(c•#f•|(#b •[:f :b :z])•#z•1)))');
      const b = docFromTextNotation('(a(b(#f•|(#b •[:f :b :z])•c•#z•1)))');
      await paredit.dragSexprBackward(a);
      expect(textAndSelection(a)).toEqual(textAndSelection(b));
    });
    it('dragSexprForward', async () => {
      const a = docFromTextNotation('(a(b(c•#f•|(#b •[:f :b :z])•#z•1)))');
      const b = docFromTextNotation('(a(b(c•#z•1•#f•|(#b •[:f :b :z]))))');
      await paredit.dragSexprForward(a);
      expect(textAndSelection(a)).toEqual(textAndSelection(b));
    });
    describe('Stacked readers', () => {
      const docText = '(c\n#f\n(#b \n[:f :b :z])\n#x\n#y\n1)';
      let doc: model.StringDocument;

      beforeEach(() => {
        doc = new model.StringDocument(docText);
      });
      it('dragSexprBackward', async () => {
        const a = docFromTextNotation('(c•#f•(#b •[:f :b :z])•#x•#y•|:a)');
        const b = docFromTextNotation('(c•#x•#y•|:a•#f•(#b •[:f :b :z]))');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('dragSexprForward', async () => {
        const a = docFromTextNotation('(c•#f•|(#b •[:f :b :z])•#x•#y•1)');
        const b = docFromTextNotation('(c•#x•#y•1•#f•|(#b •[:f :b :z]))');
        return paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Top Level Readers', () => {
      const docText = '#f\n(#b \n[:f :b :z])\n#x\n#y\n1\n#å#ä#ö';
      let doc: model.StringDocument;

      beforeEach(() => {
        doc = new model.StringDocument(docText);
      });
      it('dragSexprBackward: #f•(#b •[:f :b :z])•#x•#y•|:a•#å#ä#ö => #x•#y•1•#f•(#b •[:f :b :z])•#å#ä#ö', async () => {
        doc.selections = [new ModelEditSelection(26, 26)];
        await paredit.dragSexprBackward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
      });
      it('dragSexprForward: #f•|(#b •[:f :b :z])•#x•#y•1#å#ä#ö => #x•#y•1•#f•|(#b •[:f :b :z])•#å#ä#ö', async () => {
        doc.selections = [new ModelEditSelection(3, 3)];
        await paredit.dragSexprForward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
        expect(doc.selections).toEqual([new ModelEditSelection(11)]);
      });
      it('dragSexprForward: #f•(#b •[:f :b :z])•#x•#y•|:a•#å#ä#ö => #f•(#b •[:f :b :z])•#x•#y•|:a•#å#ä#ö', async () => {
        doc.selections = [new ModelEditSelection(26, 26)];
        await paredit.dragSexprForward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#f\n(#b \n[:f :b :z])\n#x\n#y\n1\n#å#ä#ö');
        expect(doc.selections).toEqual([new ModelEditSelection(26)]);
      });
    });
  });

  describe('selection', () => {
    describe('selectRangeBackward', () => {
      // TODO: Fix #498
      it('Extends backward selections backwards', () => {
        const a = docFromTextNotation('(def foo [:foo :bar <0:baz<0])');
        const selDoc = docFromTextNotation('(def foo [:foo |:bar| :baz])');
        const b = docFromTextNotation('(def foo [:foo <0:bar :baz<0])');
        paredit.selectRangeBackward(a, [selDoc.selections[0].asDirectedRange]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Contracts forward selection and extends backwards', () => {
        const a = docFromTextNotation('(def foo [:foo :bar >0:baz>0])');
        const selDoc = docFromTextNotation('(def foo [:foo |:bar| :baz])');
        const b = docFromTextNotation('(def foo [:foo <0:bar <0:baz])');
        paredit.selectRangeBackward(a, [selDoc.selections[0].asDirectedRange]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('selectRangeForward', () => {
      it('(def foo [:foo >:bar> >|:baz>|]) => (def foo [:foo >:bar :baz>])', () => {
        const barSelection = new ModelEditSelection(15, 19),
          bazRange = [20, 24] as [number, number],
          barBazSelection = new ModelEditSelection(15, 24);
        doc.selections = [barSelection];
        paredit.selectRangeForward(doc, [bazRange]);
        expect(doc.selections).toEqual([barBazSelection]);
      });
      it('(def foo [<:foo :bar< >|:baz>|]) => (def foo [>:foo :bar :baz>])', () => {
        const [fooLeft, barRight] = [10, 19],
          barFooSelection = new ModelEditSelection(barRight, fooLeft),
          bazRange = [20, 24] as [number, number],
          fooBazSelection = new ModelEditSelection(19, 24);
        doc.selections = [barFooSelection];
        paredit.selectRangeForward(doc, [bazRange]);
        expect(doc.selections).toEqual([fooBazSelection]);
      });
      it('(def foo [<:foo :bar< <|:baz<|]) => (def foo [>:foo :bar :baz>])', () => {
        const [fooLeft, barRight] = [10, 19],
          barFooSelection = new ModelEditSelection(barRight, fooLeft),
          bazRange = [24, 20] as [number, number],
          fooBazSelection = new ModelEditSelection(19, 24);
        doc.selections = [barFooSelection];
        paredit.selectRangeForward(doc, [bazRange]);
        expect(doc.selections).toEqual([fooBazSelection]);
      });
    });
  });

  describe('selection stack', () => {
    const range: ModelEditRange = [15, 20];
    it('should make grow selection the topmost element on the stack', () => {
      paredit.growSelectionStack(doc, [range]);
      expect(last(doc.selectionsStack)).toEqual([new ModelEditSelection(range[0], range[1])]);
    });
    it('get us back to where we started if we just grow, then shrink', () => {
      const selectionBefore = startSelection.clone();
      paredit.growSelectionStack(doc, [range]);
      paredit.shrinkSelection(doc, [doc.selections[0]]);
      expect(last(doc.selectionsStack)).toEqual([selectionBefore]);
    });
    it('should not add selections identical to the topmost', () => {
      const selectionBefore = doc.selections[0].clone();
      paredit.growSelectionStack(doc, [range]);
      paredit.growSelectionStack(doc, [range]);
      paredit.shrinkSelection(doc, [doc.selections[0]]);
      expect(last(doc.selectionsStack)).toEqual([selectionBefore]);
    });
    it('should have A topmost after adding A, then B, then shrinking', () => {
      const a = range,
        b: [number, number] = [10, 24];
      paredit.growSelectionStack(doc, [a]);
      paredit.growSelectionStack(doc, [b]);
      paredit.shrinkSelection(doc, [doc.selections[0]]);
      expect(last(doc.selectionsStack)).toEqual([new ModelEditSelection(a[0], a[1])]);
    });
    it('grows selection to binding pairs', () => {
      const a = docFromTextNotation('(a (let [b c |e| f]))');
      // const aSelection = new ModelEditSelection(a.selections[0].anchor, a.selections[0].active);
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(a (let [b c |e f|]))');
      // const bSelection = new ModelEditSelection(b.selections[0].anchor, b.selections[0].active);
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to all of binding box when binding pairs are selected', () => {
      const a = docFromTextNotation('(a (let [b c |e f|]))');
      const aSelection = new ModelEditSelection(a.selections[0].anchor, a.selections[0].active);
      const b = docFromTextNotation('(a (let [|b c e f|]))');
      const bSelection = new ModelEditSelection(b.selections[0].anchor, b.selections[0].active);
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to the binding box when all binding pairs are selected', () => {
      const a = docFromTextNotation('(a (let [|b c e f|]))');
      const aSelection = new ModelEditSelection(a.selections[0].anchor, a.selections[0].active);
      const b = docFromTextNotation('(a (let |[b c e f]|))');
      const bSelection = new ModelEditSelection(b.selections[0].anchor, b.selections[0].active);
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to binding pairs in :let within for (value selected first)', () => {
      const a = docFromTextNotation('(for [x [1 2] :let [a |b| c d]] [a c])');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(for [x [1 2] :let [|a b| c d]] [a c])');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection from cursor to form to pair in :let within for', () => {
      const a = docFromTextNotation('(for [x [1 2] :let [a |b c d]] [a c])');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(for [x [1 2] :let [a |b| c d]] [a c])');
      const bSelection = b.selections[0];
      const c = docFromTextNotation('(for [x [1 2] :let [|a b| c d]] [a c])');
      const cSelection = c.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection], [cSelection]]);
    });
    it('grows selection to all of binding box in :let within for', () => {
      const a = docFromTextNotation('(for [x [1 2] :let [a |b c| d]] [a c])');
      const aSelection = new ModelEditSelection(a.selections[0].anchor, a.selections[0].active);
      const b = docFromTextNotation('(for [x [1 2] :let [|a b c d|]] [a c])');
      const bSelection = new ModelEditSelection(b.selections[0].anchor, b.selections[0].active);
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to binding pairs in :let within doseq', () => {
      const a = docFromTextNotation('(doseq [x xs] :let [a |b| c d] (println a))');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(doseq [x xs] :let [|a b| c d] (println a))');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to all of binding box in :let within doseq', () => {
      const a = docFromTextNotation('(doseq [x xs] :let [a |b c| d] (println a))');
      const aSelection = new ModelEditSelection(a.selections[0].anchor, a.selections[0].active);
      const b = docFromTextNotation('(doseq [x xs] :let [|a b c d|] (println a))');
      const bSelection = new ModelEditSelection(b.selections[0].anchor, b.selections[0].active);
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });

    it('grows selection to binding pairs in :let with diverse interspersed comments', () => {
      // Comment inside the vector between pairs
      const e = docFromTextNotation('(for [x xs :let [a b ; comment\n c |d|]])');
      const eSelection = e.selections[0];
      const f = docFromTextNotation('(for [x xs :let [a b ; comment\n |c d|]])');
      const fSelection = f.selections[0];
      paredit.growSelection(e);
      expect(e.selectionsStack).toEqual([[eSelection], [fSelection]]);

      // Comment inside a pair
      const g = docFromTextNotation('(for [x xs :let [a ; comment\n |b| c d]])');
      const gSelection = g.selections[0];
      const h = docFromTextNotation('(for [x xs :let [|a ; comment\n b| c d]])');
      const hSelection = h.selections[0];
      paredit.growSelection(g);
      expect(g.selectionsStack).toEqual([[gSelection], [hSelection]]);
    });

    it('does not treat regular vectors in let body as pair forms', () => {
      const a = docFromTextNotation(
        '(let [[root left right] tree] [root |(mirror-tree left)| (mirror-tree right)])'
      );
      const aSelection = a.selections[0];
      const b = docFromTextNotation(
        '(let [[root left right] tree] [|root (mirror-tree left) (mirror-tree right)|])'
      );
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });

    describe('cond pairs', () => {
      it('grows selection to test/expr pairs in cond (expr selected first)', () => {
        const a = docFromTextNotation('(cond true |:yes| false :no)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond |true :yes| false :no)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to test/expr pairs in cond (test selected first)', () => {
        const a = docFromTextNotation('(cond |true| :yes false :no)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond |true :yes| false :no)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to test/expr pairs in cond (second pair)', () => {
        const a = docFromTextNotation('(cond (pos? x) :positive |(neg? x)| :negative :else :zero)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond (pos? x) :positive |(neg? x) :negative| :else :zero)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to test/expr pairs in cond with comment between', () => {
        const a = docFromTextNotation('(cond true ;; comment\n |:yes| false :no)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond |true ;; comment\n :yes| false :no)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });

    describe('cond-> and cond->> pairs', () => {
      it('grows selection to test/expr pairs in cond-> (expr selected first)', () => {
        const a = docFromTextNotation('(cond-> x (> 0 x) |inc| (even? x) (* 2 x))');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond-> x |(> 0 x) inc| (even? x) (* 2 x))');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to test/expr pairs in cond-> (test selected first)', () => {
        const a = docFromTextNotation('(cond-> x |(> 0 x)| inc (even? x) (* 2 x))');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond-> x |(> 0 x) inc| (even? x) (* 2 x))');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to test/expr pairs in cond->> (expr selected first)', () => {
        const a = docFromTextNotation('(cond->> x (> 0 x) |inc| (even? x) (* 2 x))');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond->> x |(> 0 x) inc| (even? x) (* 2 x))');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to test/expr pairs in cond->> (test selected first)', () => {
        const a = docFromTextNotation('(cond->> x |(> 0 x)| inc (even? x) (* 2 x))');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(cond->> x |(> 0 x) inc| (even? x) (* 2 x))');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });

    describe('pair selection with case', () => {
      it('grows selection to value/result pairs in case (result selected first)', () => {
        const a = docFromTextNotation('(case x "x" |"one"| "y" "two" "default")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(case x |"x" "one"| "y" "two" "default")');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to value/result pairs in case (value selected first)', () => {
        const a = docFromTextNotation('(case x |"x"| "one" "y" "two" "default")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(case x |"x" "one"| "y" "two" "default")');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to value/result pairs in case with list value', () => {
        const a = docFromTextNotation('(case x (2 3) |"two or three"| 4 "four" "default")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(case x |(2 3) "two or three"| 4 "four" "default")');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('does not treat default as pair when growing selection in case', () => {
        const a = docFromTextNotation('(case x 1 "one" 2 "two" |"default"|)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(|case x 1 "one" 2 "two" "default"|)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection from case keyword to list contents', () => {
        const a = docFromTextNotation('(|case| x 1 "one" 2 "two" "default")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(|case x 1 "one" 2 "two" "default"|)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });

    describe('assoc pairs', () => {
      it('grows selection to key/value pairs in assoc (value selected first)', () => {
        const a = docFromTextNotation('(assoc m :a |"one"| :b "two")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(assoc m |:a "one"| :b "two")');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to key/value pairs in assoc (key selected first)', () => {
        const a = docFromTextNotation('(assoc m |:a| "one" :b "two")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(assoc m |:a "one"| :b "two")');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('grows selection to key/value pairs in assoc (second pair)', () => {
        const a = docFromTextNotation('(assoc m :a "one" |:b| "two")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(assoc m :a "one" |:b "two"|)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
      it('does not treat map argument as part of pair', () => {
        const a = docFromTextNotation('(assoc |m| :a "one" :b "two")');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(|assoc m :a "one" :b "two"|)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });
  });

  describe('condp pair/triple selection tests', () => {
    it('grows selection to test/result pairs in condp (result selected first)', () => {
      const a = docFromTextNotation('(condp = x 1 |"one"| 2 "two" "default")');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(condp = x |01 "one"|0 2 "two" "default")');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to test/result pairs in condp (test selected first)', () => {
      const a = docFromTextNotation('(condp = x |"x"| "one" "y" "two" "default")');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(condp = x |"x" "one"| "y" "two" "default")');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to test/result pairs in condp with set test', () => {
      const a = docFromTextNotation('(condp = x #{1 2} |"one or two"| 3 "three" "default")');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(condp = x |0#{1 2} "one or two"|0 3 "three" "default")');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to triple in condp with :>> (test selected)', () => {
      const a = docFromTextNotation('(condp some [1 2 3 4] |#{0 6 7}| :>> inc #{5 9} :>> dec)');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(condp some [1 2 3 4] |0#{0 6 7} :>> inc|0 #{5 9} :>> dec)');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to triple in condp with :>> (:>> selected)', () => {
      const a = docFromTextNotation('(condp some [1 2 3 4] #{0 6 7} |:>>| inc #{5 9} :>> dec)');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(condp some [1 2 3 4] |0#{0 6 7} :>> inc|0 #{5 9} :>> dec)');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to triple in condp with :>> (function selected)', () => {
      const a = docFromTextNotation('(condp some [1 2 3 4] #{0 6 7} :>> |inc| #{5 9} :>> dec)');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(condp some [1 2 3 4] |0#{0 6 7} :>> inc|0 #{5 9} :>> dec)');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection to triple in condp with :>> and fn form', () => {
      const a = docFromTextNotation(
        '(condp some [1 2 3 4] #{1 2 3} :>> |#(+ % 3)| #{5 9} :>> dec)'
      );
      const aSelection = a.selections[0];
      const b = docFromTextNotation(
        '(condp some [1 2 3 4] |0#{1 2 3} :>> #(+ % 3)|0 #{5 9} :>> dec)'
      );
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('does not treat default as pair when growing selection in condp', () => {
      const a = docFromTextNotation('(condp = x 1 "one" 2 "two" |"default"|)');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(|condp = x 1 "one" 2 "two" "default"|)');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
    it('grows selection from condp keyword to list contents', () => {
      const a = docFromTextNotation('(|condp| = x 1 "one" 2 "two" "default")');
      const aSelection = a.selections[0];
      const b = docFromTextNotation('(|condp = x 1 "one" 2 "two" "default"|)');
      const bSelection = b.selections[0];
      paredit.growSelection(a);
      expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
    });
  });

  describe('dragSexpr', () => {
    describe('forwardAndBackwardSexpr', () => {
      // (comment\n  ['(0 1 2 "t" "f")•   "b"•             {:s "h"}•             :f]•  [:f '(0 "t") "b" :s]•  [:f 0•   "b" :s•   4 :b]•  {:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b})
      let doc: model.StringDocument;

      beforeEach(() => {
        doc = new model.StringDocument(docText);
      });

      it('drags forward in regular lists', async () => {
        const a = docFromTextNotation(`(c• [:|f '(0 "t")•   "b" :s]•)`);
        const b = docFromTextNotation(`(c• ['(0 "t") :|f•   "b" :s]•)`);
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags backward in regular lists', async () => {
        const a = docFromTextNotation(`(c• [:f '(0 "t")•   "b"| :s]•)`);
        const b = docFromTextNotation(`(c• [:f "b"|•   '(0 "t") :s]•)`);
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('does not drag forward when sexpr is last in regular lists', async () => {
        const dotText = `(c• [:f '(0 "t")•   "b" |:s ]•)`;
        const a = docFromTextNotation(dotText);
        const b = docFromTextNotation(dotText);
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('does not drag backward when sexpr is last in regular lists', async () => {
        const dotText = `(c• [ :|f '(0 "t")•   "b" :s ]•)`;
        const a = docFromTextNotation(dotText);
        const b = docFromTextNotation(dotText);
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair forward in maps', async () => {
        const a = docFromTextNotation(
          `(c• {:|e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`
        );
        const b = docFromTextNotation(
          `(c• {3 {:w? 'w}•   :|e '(e o ea)•   :t '(t i o im)•   :b 'b}•)`
        );
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair backwards in maps', async () => {
        const a = docFromTextNotation(
          `(c• {:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)|•   :b 'b}•)`
        );
        const b = docFromTextNotation(
          `(c• {:e '(e o ea)•   :t '(t i o im)|•   3 {:w? 'w}•   :b 'b}•)`
        );
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair backwards in meta-data maps', async () => {
        const a = docFromTextNotation(
          `(c• ^{:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)|•   :b 'b}•)`
        );
        const b = docFromTextNotation(
          `(c• ^{:e '(e o ea)•   :t '(t i o im)|•   3 {:w? 'w}•   :b 'b}•)`
        );
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr forward in sets', async () => {
        const a = docFromTextNotation(
          `(c• #{:|e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`
        );
        const b = docFromTextNotation(
          `(c• #{'(e o ea) :|e•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`
        );
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags pair in binding box', async () => {
        const b = docFromTextNotation(
          `(let• [:e '(e o ea)•   3 {:w? 'w}•   :t |'(t i o im)•   :b 'b]•)`
        );
        const a = docFromTextNotation(
          `(let• [:e '(e o ea)•   3 {:w? 'w}•   :b 'b•   :t |'(t i o im)]•)`
        );
        await paredit.dragSexprForward(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });

      it('drags single sexpr forward in destructing lists', async () => {
        const a = docFromTextNotation(`(let [{:keys [a |b c d]} some-map])`);
        const b = docFromTextNotation(`(let [{:keys [a c |b d]} some-map])`);
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr backward in destructing lists', async () => {
        const a = docFromTextNotation(`(let [{:keys [a b c |d]} some-map])`);
        const b = docFromTextNotation(`(let [{:keys [a b |d c]} some-map])`);
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr forward in bound vectors', async () => {
        const a = docFromTextNotation(`(let [x [1| 2 3]])`);
        const b = docFromTextNotation(`(let [x [2 1| 3]])`);
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr backward in bound vectors', async () => {
        const a = docFromTextNotation(`(let [x [1 2 |:a]])`);
        const b = docFromTextNotation(`(let [x [1 |:a 2]])`);
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr forward in bound lists', async () => {
        const a = docFromTextNotation(`(let [x (1 2| 3)])`);
        const b = docFromTextNotation(`(let [x (1 3 2|)])`);
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr backward in bound lists', async () => {
        const a = docFromTextNotation(`(let [x (1 2 |:a)])`);
        const b = docFromTextNotation(`(let [x (1 |:a 2)])`);
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('backwardUp - one line', () => {
      it('Drags up from start of vector', async () => {
        const b = docFromTextNotation(`(def foo [:|foo :bar :baz])`);
        const a = docFromTextNotation(`(def foo :|foo [:bar :baz])`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from middle of vector', async () => {
        const b = docFromTextNotation(`(def foo [:foo |:bar :baz])`);
        const a = docFromTextNotation(`(def foo |:bar [:foo :baz])`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from end of vector', async () => {
        const b = docFromTextNotation(`(def foo [:foo :bar :baz|])`);
        const a = docFromTextNotation(`(def foo :baz| [:foo :bar])`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from start of list', async () => {
        const b = docFromTextNotation(`(d|e|f foo [:foo :bar :baz])`);
        const a = docFromTextNotation(`de|f (foo [:foo :bar :baz])`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up without killing preceding line comments', async () => {
        const b = docFromTextNotation(`(;;foo•de|f foo [:foo :bar :baz])`);
        const a = docFromTextNotation(`de|f•(;;foo• foo [:foo :bar :baz])`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up without killing preceding line comments or trailing parens', async () => {
        const b = docFromTextNotation(`(def ;; foo•  |:foo)`);
        const a = docFromTextNotation(`|:foo•(def ;; foo•)`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('backwardUp - multi-line', () => {
      it('Drags up from indented vector', async () => {
        const b = docFromTextNotation(`((fn foo•  [x]•  [|:foo•   :bar•   :baz])• 1)`);
        const a = docFromTextNotation(`((fn foo•  [x]•  |:foo•  [:bar•   :baz])• 1)`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from indented list', async () => {
        const b = docFromTextNotation(`(|(fn foo•  [x]•  [:foo•   :bar•   :baz])• 1)`);
        const a = docFromTextNotation(`|(fn foo•  [x]•  [:foo•   :bar•   :baz])•(1)`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from end of indented list', async () => {
        const b = docFromTextNotation(`((fn foo•  [x]•  [:foo•   :bar•   :baz])• |:a)`);
        const a = docFromTextNotation(`|:a•((fn foo•  [x]•  [:foo•   :bar•   :baz]))`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags up from indented vector w/o killing preceding comment', async () => {
        const b = docFromTextNotation(`((fn foo•  [x]•  [:foo•   ;; foo•   :b|ar•   :baz])• 1)`);
        const a = docFromTextNotation(`((fn foo•  [x]•  :b|ar•  [:foo•   ;; foo••   :baz])• 1)`);
        await paredit.dragSexprBackwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('forwardDown - one line', () => {
      it('Drags down into vector', async () => {
        const b = docFromTextNotation(`(def f|oo [:foo :bar :baz])`);
        const a = docFromTextNotation(`(def [f|oo :foo :bar :baz])`);
        await paredit.dragSexprForwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags down into vector past sexpression on the same level', async () => {
        const b = docFromTextNotation(`(d|ef| foo [:foo :bar :baz])`);
        const a = docFromTextNotation(`(foo [def| :foo :bar :baz])`);
        await paredit.dragSexprForwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags down into vector w/o killing line comments on the way', async () => {
        const b = docFromTextNotation(`(d|ef ;; foo• [:foo :bar :baz])`);
        const a = docFromTextNotation(`(;; foo• [d|ef :foo :bar :baz])`);
        await paredit.dragSexprForwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('forwardUp', () => {
      it('Drags forward out of vector', async () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
        const a = docFromTextNotation(`((fn foo [x] [:foo] :b|ar)) :baz`);
        await paredit.dragSexprForwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags forward out of vector w/o killing line comments on the way', async () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar ;; bar•])) :baz`);
        const a = docFromTextNotation(`((fn foo [x] [:foo ;; bar•] :b|ar)) :baz`);
        await paredit.dragSexprForwardUp(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
    describe('backwardDown', () => {
      it('Drags backward down into list', async () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :bar])) :b|az`);
        const a = docFromTextNotation(`((fn foo [x] [:foo :bar]) :b|az)`);
        await paredit.dragSexprBackwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it('Drags backward down into list w/o killing line comments on the way', async () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :bar])) ;; baz•:b|az`);
        const a = docFromTextNotation(`((fn foo [x] [:foo :bar]) :b|az) ;; baz`);
        await paredit.dragSexprBackwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
      it("Does not drag when can't drag down", async () => {
        const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
        const a = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
        await paredit.dragSexprBackwardDown(b);
        expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
      });
    });
  });
  describe('Drag Sexp with pairs/triples', () => {
    describe('cond forms', () => {
      it('drags test/expr pair forward in cond', async () => {
        const a = docFromTextNotation('(cond |:a 1 :b 2)');
        const b = docFromTextNotation('(cond :b 2 |:a 1)');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags test/expr pair backward in cond', async () => {
        const a = docFromTextNotation('(cond :a 1 |:b 2)');
        const b = docFromTextNotation('(cond |:b 2 :a 1)');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags test/expr pair forward in cond when cursor on expr', async () => {
        const a = docFromTextNotation('(cond :a |01 :b 2)');
        const b = docFromTextNotation('(cond :b 2 :a |01)');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('cond-> and cond->> forms', () => {
      it('drags test/expr pair forward in cond->', async () => {
        const a = docFromTextNotation('(cond-> x |:a (inc) :b (dec))');
        const b = docFromTextNotation('(cond-> x :b (dec) |:a (inc))');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags test/expr pair backward in cond->>', async () => {
        const a = docFromTextNotation('(cond->> x :a (inc) |:b (dec))');
        const b = docFromTextNotation('(cond->> x |:b (dec) :a (inc))');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('case forms', () => {
      it('drags value/result pair forward in case', async () => {
        const a = docFromTextNotation('(case x |01 "one" 2 "two" "default")');
        const b = docFromTextNotation('(case x 2 "two" |01 "one" "default")');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags value/result pair backward in case', async () => {
        const a = docFromTextNotation('(case x 1 "one" |02 "two" "default")');
        const b = docFromTextNotation('(case x |02 "two" 1 "one" "default")');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('does not drag default value as pair in case', async () => {
        const a = docFromTextNotation('(case x 1 "one" |"default")');
        // Default is a single form, not a pair, so it should drag alone
        const b = docFromTextNotation('(case x |"default" 1 "one")');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('condp forms', () => {
      it('drags test/result pair forward in condp', async () => {
        const a = docFromTextNotation('(condp = x |01 "one" 2 "two" "default")');
        const b = docFromTextNotation('(condp = x 2 "two" |01 "one" "default")');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags test/result pair backward in condp', async () => {
        const a = docFromTextNotation('(condp = x 1 "one" |02 "two" "default")');
        const b = docFromTextNotation('(condp = x |02 "two" 1 "one" "default")');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags triple (:>> form) forward in condp', async () => {
        const a = docFromTextNotation('(condp some [1 2] |#{1} :>> inc #{2} :>> dec)');
        const b = docFromTextNotation('(condp some [1 2] #{2} :>> dec |#{1} :>> inc)');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags triple (:>> form) backward in condp', async () => {
        const a = docFromTextNotation('(condp some [1 2] #{1} :>> inc |#{2} :>> dec)');
        const b = docFromTextNotation('(condp some [1 2] |#{2} :>> dec #{1} :>> inc)');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe(':let bindings in for/doseq', () => {
      it('drags binding pair forward in :let within for', async () => {
        const a = docFromTextNotation('(for [x xs :let [|a 1 b 2]] [a b])');
        const b = docFromTextNotation('(for [x xs :let [b 2 |a 1]] [a b])');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags binding pair backward in :let within doseq', async () => {
        const a = docFromTextNotation('(doseq [x xs :let [a 1 |b 2]] (println a b))');
        const b = docFromTextNotation('(doseq [x xs :let [|b 2 a 1]] (println a b))');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('regular vectors in let body', () => {
      it('does not treat regular vector in let body as pairs when dragging backward', async () => {
        // https://github.com/BetterThanTomorrow/calva/issues/2735
        // Regular vectors in let body should not have pair semantics
        const a = docFromTextNotation(
          '(let [[root left right] tree] [root (mirror-tree left) |(mirror-tree right)])'
        );
        const b = docFromTextNotation(
          '(let [[root left right] tree] [root |(mirror-tree right) (mirror-tree left)])'
        );
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('does NOT treat regular vector in let body as pairs when dragging forward', async () => {
        const a = docFromTextNotation(
          '(let [[root left right] tree] [root |(mirror-tree left) (mirror-tree right)])'
        );
        const b = docFromTextNotation(
          '(let [[root left right] tree] [root (mirror-tree right) |(mirror-tree left)])'
        );
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('assoc forms', () => {
      it('drags key/value pair forward in assoc', async () => {
        const a = docFromTextNotation('(assoc m |:a "one" :b "two")');
        const b = docFromTextNotation('(assoc m :b "two" |:a "one")');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags key/value pair backward in assoc', async () => {
        const a = docFromTextNotation('(assoc m :a "one" |:b "two")');
        const b = docFromTextNotation('(assoc m |:b "two" :a "one")');
        await paredit.dragSexprBackward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags key/value pair forward in assoc when cursor on value', async () => {
        const a = docFromTextNotation('(assoc m :a |"one" :b "two")');
        const b = docFromTextNotation('(assoc m :b "two" :a |"one")');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags map argument past pair when dragging forward in assoc', async () => {
        const a = docFromTextNotation('(assoc |m :a "one" :b "two")');
        // Map drags past the first key-value pair to maintain pair structure
        const b = docFromTextNotation('(assoc :a "one" |m :b "two")');
        await paredit.dragSexprForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('threading macros with pairs', () => {
      describe('assoc in -> macro', () => {
        it('grows selection to key/value pairs in assoc inside ->', () => {
          const a = docFromTextNotation('(-> m (assoc |:a| "one" :b "two"))');
          const aSelection = a.selections[0];
          const b = docFromTextNotation('(-> m (assoc |:a "one"| :b "two"))');
          const bSelection = b.selections[0];
          paredit.growSelection(a);
          expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
        });

        it('drags key/value pair forward in assoc inside ->', async () => {
          const a = docFromTextNotation('(-> m (assoc |:a "one" :b "two"))');
          const b = docFromTextNotation('(-> m (assoc :b "two" |:a "one"))');
          await paredit.dragSexprForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('cond-> inside -> macro (nested threading)', () => {
        it('grows selection to pair inside cond-> which is itself inside ->', () => {
          const a = docFromTextNotation('(-> {} (cond-> |true| (assoc :a "one")))');
          const aSelection = a.selections[0];
          const b = docFromTextNotation('(-> {} (cond-> |true (assoc :a "one")|))');
          const bSelection = b.selections[0];
          paredit.growSelection(a);
          expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
        });

        it('drags pair forward in cond-> which is inside ->', async () => {
          const a = docFromTextNotation(
            '(-> {} (cond-> |true (assoc :a "one") false (assoc :b "two")))'
          );
          const b = docFromTextNotation(
            '(-> {} (cond-> false (assoc :b "two") |true (assoc :a "one")))'
          );
          await paredit.dragSexprForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('case inside -> macro', () => {
        it('grows selection to value/result pair inside case>', () => {
          const a = docFromTextNotation('(-> x (case |"x"| "one" 2 "two" "default"))');
          const aSelection = a.selections[0];
          const b = docFromTextNotation('(-> x (case |"x" "one"| 2 "two" "default"))');
          const bSelection = b.selections[0];
          paredit.growSelection(a);
          expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
        });
        it('drags value/result pair backward in case inside ->', async () => {
          const a = docFromTextNotation('(-> x (case |"x" "one" 2 "two" "default"))');
          const b = docFromTextNotation('(-> x (case 2 "two" |"x" "one" "default"))');
          await paredit.dragSexprForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('assoc in ->> macro', () => {
        it('grows selection to key/value pairs with trailing unpaired key in assoc inside ->>', () => {
          const a = docFromTextNotation('(->> "two" (assoc {} |:one| "one" :two))');
          const aSelection = a.selections[0];
          const b = docFromTextNotation('(->> "two" (assoc {} |:one "one"| :two))');
          const bSelection = b.selections[0];
          paredit.growSelection(a);
          expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
        });
        it('grows selection to entire form because :two is trailing unpaired key', () => {
          const a = docFromTextNotation('(->> "two" (assoc {} :one "one" |:two|))');
          const aSelection = a.selections[0];
          const b = docFromTextNotation('(->> "two" (|assoc {} :one "one" :two|))');
          const bSelection = b.selections[0];
          paredit.growSelection(a);
          expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
        });
        it('drags key/value pair forward with trailing unpaired key in assoc inside ->>', async () => {
          const a = docFromTextNotation('(->> "three" (assoc {} |:one "one" :two "two" :three))');
          const b = docFromTextNotation('(->> "three" (assoc {} :two "two" |:one "one" :three))');
          await paredit.dragSexprForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
      describe('case inside ->> macro', () => {
        it('grows selection to value/result pair inside case inside ->>', () => {
          const a = docFromTextNotation('(->> "default" (case "x" :four "four" :five |"five"|))');
          const aSelection = a.selections[0];
          const b = docFromTextNotation('(->> "default" (case "x" :four "four" |:five "five"|))');
          const bSelection = b.selections[0];
          paredit.growSelection(a);
          expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
        });
        it('drags value/result pair backward in case inside ->>', async () => {
          const a = docFromTextNotation('(->> "default" (case "x" |:four "four" :five "five"))');
          const b = docFromTextNotation('(->> "default" (case "x" :five "five" |:four "four"))');
          await paredit.dragSexprForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('Nested threading)', () => {
        it('handles cond-> inside -> with assoc pairs (first expansion)', () => {
          const a = docFromTextNotation('(-> {} (cond-> true (assoc |:a "one")))');
          const b = docFromTextNotation('(-> {} (cond-> true (assoc |:a "one"|)))');
          paredit.growSelection(a, a.selections);
          expect(getText(a)).toBe(getText(b));
        });

        it('handles cond-> inside -> with assoc form (second expansion)', () => {
          const a = docFromTextNotation('(-> {} (cond-> true |(assoc :a "one")))');
          const b = docFromTextNotation('(-> {} (cond-> |true (assoc :a "one")|))');
          paredit.growSelection(a, a.selections);
          expect(getText(a)).toBe(getText(b));
        });

        it('handles cond->> inside ->> with assoc pairs', () => {
          const a = docFromTextNotation('(->> {} (cond->> true (assoc |:a "one")))');
          const b = docFromTextNotation('(->> {} (cond->> true (assoc |:a "one"|)))');
          paredit.growSelection(a, a.selections);
          expect(getText(a)).toBe(getText(b));
        });

        it('handles cond->> inside ->> with condition pairs', () => {
          const a = docFromTextNotation('(->> {} (cond->> |true (assoc :a "one")))');
          const b = docFromTextNotation('(->> {} (cond->> |true (assoc :a "one")|))');
          paredit.growSelection(a, a.selections);
          expect(getText(a)).toBe(getText(b));
        });
      });
    });
  });

  describe('edits', () => {
    describe('Close lists', () => {
      it('Advances cursor if at end of list of the same type', async () => {
        const a = docFromTextNotation('(str "foo"|)');
        const b = docFromTextNotation('(str "foo")|');
        await paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Does not enter new closing parens in balanced doc', async () => {
        const a = docFromTextNotation('(str |"foo")');
        const b = docFromTextNotation('(str |"foo")');
        await paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      xit('Enter new closing parens in unbalanced doc', async () => {
        // TODO: Reinstall this test once the corresponding cursor test works
        //       (The extension actually behaves correctly.)
        const a = docFromTextNotation('(str |"foo"');
        const b = docFromTextNotation('(str )|"foo"');
        await paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Enter new closing parens in string', async () => {
        const a = docFromTextNotation('(str "|foo"');
        const b = docFromTextNotation('(str ")|foo"');
        await paredit.close(a, ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });
    describe('String quoting', () => {
      it('Closes quote at end of string', async () => {
        const a = docFromTextNotation('(str "foo|")');
        const b = docFromTextNotation('(str "foo"|)');
        await paredit.stringQuote(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Rewrap', () => {
      it('Rewraps () -> []', async () => {
        const a = docFromTextNotation('a (b c|) d');
        const b = docFromTextNotation('a [b c|] d');
        await paredit.rewrapSexpr(a, '[', ']');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Rewraps [] -> ()', async () => {
        const a = docFromTextNotation('a [b c|] d');
        const b = docFromTextNotation('a (b c|) d');
        await paredit.rewrapSexpr(a, '(', ')');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Rewraps [] -> {}', async () => {
        const a = docFromTextNotation('a [b c|] d');
        const b = docFromTextNotation('a {b c|} d');
        await paredit.rewrapSexpr(a, '{', '}');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Rewraps #{} -> {}', async () => {
        const a = docFromTextNotation('a #{b c|} d');
        const b = docFromTextNotation('a {b c|} d');
        await paredit.rewrapSexpr(a, '{', '}');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Rewraps #{} -> ""', async () => {
        const a = docFromTextNotation('a #{b c|} d');
        const b = docFromTextNotation('a "b c|" d');
        await paredit.rewrapSexpr(a, '"', '"');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Rewraps [] -> #{}', async () => {
        const a = docFromTextNotation('[b c|] d');
        const b = docFromTextNotation('#{b c|} d');
        await paredit.rewrapSexpr(a, '#{', '}');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      // TODO: This tests current behavior. What should happen?
      it('Rewraps ^{} -> #{}', async () => {
        const a = docFromTextNotation('^{b c|} d');
        const b = docFromTextNotation('#{b c|} d');
        await paredit.rewrapSexpr(a, '#{', '}');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      // TODO: This tests current behavior. What should happen?
      it('Rewraps ~{} -> #{}', async () => {
        const a = docFromTextNotation('~{b c|} d');
        const b = docFromTextNotation('#{b c|} d');
        await paredit.rewrapSexpr(a, '#{', '}');
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Slurping', () => {
      describe('Slurping forwards', () => {
        it('slurps form after list', async () => {
          const a = docFromTextNotation('(str|) "foo"');
          const b = docFromTextNotation('(str| "foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, in multiline document', async () => {
          const a = docFromTextNotation('(foo• (str| ) "foo")');
          const b = docFromTextNotation('(foo• (str| "foo"))');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps and adds leading space', async () => {
          const a = docFromTextNotation('(s|tr)#(foo)');
          const b = docFromTextNotation('(s|tr #(foo))');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps without adding a space', async () => {
          const a = docFromTextNotation('(s|tr )#(foo)');
          const b = docFromTextNotation('(s|tr #(foo))');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, trimming inside whitespace', async () => {
          const a = docFromTextNotation('(str|   )"foo"');
          const b = docFromTextNotation('(str| "foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, trimming outside whitespace', async () => {
          const a = docFromTextNotation('(str|)   "foo"');
          const b = docFromTextNotation('(str| "foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps, trimming inside and outside whitespace', async () => {
          const a = docFromTextNotation('(str|   )   "foo"');
          const b = docFromTextNotation('(str| "foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after empty list without adding leading space', async () => {
          const a = docFromTextNotation('(|) "foo"');
          const b = docFromTextNotation('(|"foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after whitespace-only list without adding leading space', async () => {
          const a = docFromTextNotation('(|   ) "foo"');
          const b = docFromTextNotation('(|"foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('leaves newlines when slurp', async () => {
          const a = docFromTextNotation('(fo|o•)  bar');
          const b = docFromTextNotation('(fo|o•  bar)');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps properly when closing paren is on new line', async () => {
          // https://github.com/BetterThanTomorrow/calva/issues/1171
          const a = docFromTextNotation('(def foo•  (str|•   )•  42)');
          const b = docFromTextNotation('(def foo•  (str|•   •  42))');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form including meta and readers into empty list', async () => {
          const a = docFromTextNotation('(|) ^{:a b} #c ^d "foo"');
          const b = docFromTextNotation('(|^{:a b} #c ^d "foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps in the nearest enclosing list that has a next member (1)', async () => {
          const a = docFromTextNotation('#{([a|]) b}');
          const b = docFromTextNotation('#{([a|] b)}');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps in the nearest enclosing list that has a next member (2)', async () => {
          const a = docFromTextNotation('#{[([a|])] b}');
          const b = docFromTextNotation('#{[([a|]) b]}');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps forward at multiple cursors', async () => {
          const a = docFromTextNotation('(str|) "foo"•(str|1) "foo"');
          const b = docFromTextNotation('(str| "foo")•(str|1 "foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after empty string without adding leading space', async () => {
          const a = docFromTextNotation('"|"somestuff');
          const b = docFromTextNotation('"|somestuff"');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after non-empty list with leading space', async () => {
          const a = docFromTextNotation('(bar|) foo');
          const b = docFromTextNotation('(bar| foo)');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after non-empty string with leading space', async () => {
          const a = docFromTextNotation('"a|" b');
          const b = docFromTextNotation('"a| b"');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps into nested empty list - first slurp', async () => {
          const a = docFromTextNotation('([|]) "nested"');
          const b = docFromTextNotation('([|] "nested")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps into nested empty list - second slurp', async () => {
          const a = docFromTextNotation('([|] "nested")');
          const b = docFromTextNotation('([|"nested"])');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after empty list with ignore marker following', async () => {
          const a = docFromTextNotation('(|) #_(dosomething)');
          const b = docFromTextNotation('(|#_(dosomething))');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form after empty list with ignore marker following but does not slurp next sexp', async () => {
          const a = docFromTextNotation('(|) #_(dosomething) something');
          const b = docFromTextNotation('(|#_(dosomething)) something');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('Slurping backwards', () => {
        it('slurps form before non-empty string', async () => {
          const a = docFromTextNotation('(str) "fo|o"');
          const b = docFromTextNotation('"(str) fo|o"');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before empty string without adding trailing space', async () => {
          const a = docFromTextNotation('foo "|"');
          const b = docFromTextNotation('"foo|"');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before empty list without adding trailing space', async () => {
          const a = docFromTextNotation('foo (|)');
          const b = docFromTextNotation('(foo|)');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before whitespace-only list without adding trailing space', async () => {
          const a = docFromTextNotation('foo (|   )');
          const b = docFromTextNotation('(foo|)');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before empty vector without adding trailing space', async () => {
          const a = docFromTextNotation('foo [|]');
          const b = docFromTextNotation('[foo|]');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before list', async () => {
          const a = docFromTextNotation('(str) (fo|o)');
          const b = docFromTextNotation('((str) fo|o)');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before list including meta and readers', async () => {
          const a = docFromTextNotation('^{:a b} #c ^d "foo" (|)');
          const b = docFromTextNotation('(^{:a b} #c ^d "foo"|)');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps in the nearest enclosing list that has a previous member (1)', async () => {
          const a = docFromTextNotation('#{a ([b|])}');
          const b = docFromTextNotation('#{(a [b|])}');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps in the nearest enclosing list that has a previous member (2)', async () => {
          const a = docFromTextNotation('#{a [([b|])]}');
          const b = docFromTextNotation('#{[a ([b|])]}');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps backward at multiple cursors', async () => {
          const a = docFromTextNotation('(str) (fo|o)•(str) (fo|1o)');
          const b = docFromTextNotation('((str) fo|o)•((str) fo|1o)');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before empty list with ignore marker preceding', async () => {
          const a = docFromTextNotation('#_(dosomething) (|)');
          const b = docFromTextNotation('(#_(dosomething)|)');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('slurps form before empty list with ignore marker preceding but does not slurp previous sexp', async () => {
          const a = docFromTextNotation('something #_(dosomething) (|)');
          const b = docFromTextNotation('something (#_(dosomething)|)');
          await paredit.backwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
    });

    describe('Barfing', () => {
      describe('Barfing forwards', () => {
        it('barfs last form in list', async () => {
          const a = docFromTextNotation('(str| "foo")');
          const b = docFromTextNotation('(str|) "foo"');
          await paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('leaves newlines when slurp', async () => {
          const a = docFromTextNotation('(fo|o•  bar)');
          const b = docFromTextNotation('(fo|o)•  bar');
          await paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs form including meta and readers', async () => {
          const a = docFromTextNotation('(| ^{:a b} #c ^d "foo")');
          const b = docFromTextNotation('(|) ^{:a b} #c ^d "foo"');
          await paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs form from balanced list, when inside unclosed list', async () => {
          // Trying to expose:
          // https://github.com/BetterThanTomorrow/calva/issues/1585
          const a = docFromTextNotation('(let [a| a)');
          const b = docFromTextNotation('(let [a|) a');
          await paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('keeps cursor within the list that lost a member (1)', async () => {
          const a = docFromTextNotation('(str |"foo")');
          const b = docFromTextNotation('(str|) "foo"');
          await paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('keeps cursor within the list that lost a member (2)', async () => {
          const a = docFromTextNotation('(str "foo"|)');
          const b = docFromTextNotation('(str|) "foo"');
          await paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs forward at multiple cursors', async () => {
          const a = docFromTextNotation('(str| "foo")•(str|1 "foo")');
          const b = docFromTextNotation('(str|) "foo"•(str|1) "foo"');
          await paredit.forwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('Barfing backwards', () => {
        it('barfs first form in list', async () => {
          const a = docFromTextNotation('((str) fo|o)');
          const b = docFromTextNotation('(str) (fo|o)');
          await paredit.backwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs first form in list including meta and readers', async () => {
          const a = docFromTextNotation('(^{:a b} #c ^d "foo"|)');
          const b = docFromTextNotation('^{:a b} #c ^d "foo"(|)');
          await paredit.backwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('barfs backward at multiple cursors', async () => {
          const a = docFromTextNotation('((str) fo|o)•((str) fo|1o)');
          const b = docFromTextNotation('(str) (fo|o)•(str) (fo|1o)');
          await paredit.backwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('keeps cursor within the list that lost its first member', async () => {
          const a = docFromTextNotation('(|(str) foo)');
          const b = docFromTextNotation('(str) (|foo)');
          await paredit.backwardBarfSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
    });

    describe('Raise', () => {
      it('raises the current form when cursor is preceding', async () => {
        const a = docFromTextNotation('(comment•  (str |#(foo)))');
        const b = docFromTextNotation('(comment•  |#(foo))');
        await paredit.raiseSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('raises the current form when cursor is trailing', async () => {
        const a = docFromTextNotation('(comment•  (str #(foo)|))');
        const b = docFromTextNotation('(comment•  #(foo)|)');
        await paredit.raiseSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Kill character backwards (backspace)', () => {
      it('Deletes a selected range', () => {
        const a = docFromTextNotation('{::foo ()• :|:bar |:foo}');
        const b = docFromTextNotation('{::foo ()• :|:foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves closing paren of empty list alone', () => {
        const a = docFromTextNotation('{::foo ()|• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes closing paren if unbalance', () => {
        const a = docFromTextNotation('{::foo )|• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening paren of non-empty list alone', () => {
        const a = docFromTextNotation('{::foo (|a)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |(a)• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening quote of non-empty string alone', () => {
        const a = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo |"a"• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves closing quote of non-empty string alone', () => {
        const a = docFromTextNotation('{::foo "a"|• ::bar :foo}');
        const b = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings', () => {
        const a = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 2', () => {
        const a = docFromTextNotation('{::foo "a|a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 3', () => {
        const a = docFromTextNotation('{::foo "aa|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote', () => {
        const a = docFromTextNotation('{::foo \\"|• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote in string', () => {
        const a = docFromTextNotation('{::foo "\\"|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in list', () => {
        const a = docFromTextNotation('{::foo (a|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty list function', () => {
        const a = docFromTextNotation('{::foo (|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty set', () => {
        const a = docFromTextNotation('#{|}');
        const b = docFromTextNotation('|');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty literal function with trailing newline', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1079
        const a = docFromTextNotation('{::foo #(|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes open paren prefix characters', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1122
        const a = docFromTextNotation('#|(foo)');
        const b = docFromTextNotation('|(foo)');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes open map curly prefix/ns characters', () => {
        const a = docFromTextNotation('#:same|{:thing :here}');
        const b = docFromTextNotation('#:sam|{:thing :here}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes open set hash characters', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1122
        const a = docFromTextNotation('#|{:thing :here}');
        const b = docFromTextNotation('|{:thing :here}');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quote prefix from quoted list with content', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/3020
        const a = docFromTextNotation("'('|(1 2 3) '(4 5 6) '(7 8 9))");
        const b = docFromTextNotation("'(|(1 2 3) '(4 5 6) '(7 8 9))");
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quote prefix from nested quoted list', () => {
        const a = docFromTextNotation("(foo '|(bar baz))");
        const b = docFromTextNotation('(foo |(bar baz))');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quote prefix from quoted vector', () => {
        const a = docFromTextNotation("'|[1 2 3]");
        const b = docFromTextNotation('|[1 2 3]');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Moves cursor past entire open paren, including prefix characters', () => {
        const a = docFromTextNotation('#(|foo)');
        const b = docFromTextNotation('|#(foo)');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes unbalanced bracket', () => {
        // This hangs the structural editing in the real editor
        // https://github.com/BetterThanTomorrow/calva/issues/1573
        const a = docFromTextNotation('([{|)');
        const b = docFromTextNotation('([|');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes whitespace to the left of the cursor', () => {
        const a = docFromTextNotation(
          `
(if false nil
  |true)
        `.trim()
        );
        const b = docFromTextNotation(`(if false nil |true)`.trim());
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left of the cursor without crossing multiple lines', () => {
        const a = docFromTextNotation('[•• |::foo]');
        const b = docFromTextNotation('[• |::foo]');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and right of the cursor when inside whitespace', () => {
        const a = docFromTextNotation('[• | ::foo]');
        const b = docFromTextNotation('[|::foo]');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and inserts a space when arriving at the end of a line', () => {
        const a = docFromTextNotation('(if :foo•  |:bar   :baz)');
        const b = docFromTextNotation('(if :foo |:bar   :baz)');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and inserts a single space when ending up on a line with trailing whitespace', () => {
        const a = docFromTextNotation('(if :foo    •  |:bar   :baz)');
        const b = docFromTextNotation('(if :foo |:bar   :baz)');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and avoids inserting a space if on a close token', () => {
        const a = docFromTextNotation('(if :foo•    |)');
        const b = docFromTextNotation('(if :foo|)');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      // https://github.com/BetterThanTomorrow/calva/issues/2108
      it('Deletes whitespace to the left and avoids inserting indent if at top level', () => {
        const a = docFromTextNotation('a\n\n    |b');
        const b = docFromTextNotation('a\n\n   |b');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left, inserting indents if at top level inside RFC', () => {
        const a = docFromTextNotation('(comment\n  a\n\n    |b)');
        const b = docFromTextNotation('(comment\n  a\n  |b)');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes a character when inside a token on a blank line', () => {
        const a = docFromTextNotation('(if• :|foo)');
        const b = docFromTextNotation('(if• |foo)');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      // https://github.com/BetterThanTomorrow/calva/issues/2327
      it('Deletes hash character to the left of a list, inside a list', () => {
        const a = docFromTextNotation('(#|())');
        const b = docFromTextNotation('(|())');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes hash character to the left of a vector, inside a list', () => {
        const a = docFromTextNotation('(#|[])');
        const b = docFromTextNotation('(|[])');
        paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      describe('Hash character deletion with non-empty reader macros', () => {
        it('Deletes # inside non-empty anonymous function', () => {
          const a = docFromTextNotation('[#|(prn "hello")]');
          const b = docFromTextNotation('[|(prn "hello")]');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # and space together after invalid # with space', () => {
          const a = docFromTextNotation('[# |(prn "hello")]');
          const b = docFromTextNotation('[|(prn "hello")]');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # inside non-empty set', () => {
          const a = docFromTextNotation('[#|{:foo :bar}]');
          const b = docFromTextNotation('[|{:foo :bar}]');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # inside empty anonymous function', () => {
          const a = docFromTextNotation('(#|())');
          const b = docFromTextNotation('(|())');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # inside empty set', () => {
          const a = docFromTextNotation('(#|{})');
          const b = docFromTextNotation('(|{})');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Jumps over # when cursor is after opening paren', () => {
          const a = docFromTextNotation('#(|foo)');
          const b = docFromTextNotation('|#(foo)');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Jumps over # when cursor is after opening brace', () => {
          const a = docFromTextNotation('#{|:foo}');
          const b = docFromTextNotation('|#{:foo}');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
      describe('Quote prefix deletion with empty forms', () => {
        it("Deletes ' before empty list", () => {
          const a = docFromTextNotation("'|()");
          const b = docFromTextNotation('|()');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it("Deletes ' before empty vector", () => {
          const a = docFromTextNotation("'|[]");
          const b = docFromTextNotation('|[]');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it("Deletes ' before empty map", () => {
          const a = docFromTextNotation("'|{}");
          const b = docFromTextNotation('|{}');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it("Deletes ' before non-empty list", () => {
          const a = docFromTextNotation("'|(foo)");
          const b = docFromTextNotation('|(foo)');
          paredit.backspace(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
    });

    describe('Kill character forwards (delete)', () => {
      it('Leaves closing paren of empty list alone', () => {
        const a = docFromTextNotation('{::foo |()• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes closing paren if unbalance', () => {
        const a = docFromTextNotation('{::foo |)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening paren of non-empty list alone', () => {
        const a = docFromTextNotation('{::foo |(a)• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|a)• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening quote of non-empty string alone', () => {
        const a = docFromTextNotation('{::foo |"a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves closing quote of non-empty string alone', () => {
        const a = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "a"|• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings', () => {
        const a = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 2', () => {
        const a = docFromTextNotation('{::foo "|aa"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote', () => {
        const a = docFromTextNotation('{::foo |\\"• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote in string', () => {
        const a = docFromTextNotation('{::foo "|\\""• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in list', () => {
        const a = docFromTextNotation('{::foo (|a)• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty list function', () => {
        const a = docFromTextNotation('{::foo (|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty set', () => {
        const a = docFromTextNotation('#{|}');
        const b = docFromTextNotation('|');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty literal function with trailing newline', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1079
        const a = docFromTextNotation('{::foo #(|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      // https://github.com/BetterThanTomorrow/calva/issues/3020
      describe('Quote prefix deletion', () => {
        it('Deletes quote prefix from quoted list with content', () => {
          const a = docFromTextNotation("'(|'(1 2 3) '(4 5 6) '(7 8 9))");
          const b = docFromTextNotation("'(|(1 2 3) '(4 5 6) '(7 8 9))");
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes quote prefix from nested quoted list', () => {
          const a = docFromTextNotation("(foo |'(bar baz))");
          const b = docFromTextNotation('(foo |(bar baz))');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes quote prefix from quoted vector', () => {
          const a = docFromTextNotation("|'[1 2 3]");
          const b = docFromTextNotation('|[1 2 3]');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      // https://github.com/BetterThanTomorrow/calva/issues/2766
      describe('Hash character deletion with reader macros', () => {
        it('Deletes # before non-empty anonymous function', () => {
          const a = docFromTextNotation('[|#(prn "hello")]');
          const b = docFromTextNotation('[|(prn "hello")]');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # before non-empty set', () => {
          const a = docFromTextNotation('[|#{:foo :bar}]');
          const b = docFromTextNotation('[|{:foo :bar}]');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # with invalid syntax before vector', () => {
          const a = docFromTextNotation('[|#[:foo]]');
          const b = docFromTextNotation('[|[:foo]]');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # before empty anonymous function', () => {
          const a = docFromTextNotation('[|#()]');
          const b = docFromTextNotation('[|()]');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('Deletes # before empty set', () => {
          const a = docFromTextNotation('[|#{}]');
          const b = docFromTextNotation('[|{}]');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
      describe('Quote prefix deletion with empty forms', () => {
        it("Deletes ' before empty list", () => {
          const a = docFromTextNotation("|'()");
          const b = docFromTextNotation('|()');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it("Deletes ' before empty vector", () => {
          const a = docFromTextNotation("|'[]");
          const b = docFromTextNotation('|[]');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it("Deletes ' before empty map", () => {
          const a = docFromTextNotation("|'{}");
          const b = docFromTextNotation('|{}');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it("Deletes ' before non-empty list", () => {
          const a = docFromTextNotation("|'(foo)");
          const b = docFromTextNotation('|(foo)');
          paredit.deleteForward(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });
    });

    describe('killRange', () => {
      it('Deletes top-level range with backward direction', async () => {
        const a = docFromTextNotation('a <0b<0 c');
        const b = docFromTextNotation('a | c');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes top-level range with backward direction, including space', async () => {
        const a = docFromTextNotation('a <0b <0c');
        const b = docFromTextNotation('a |c');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes top-level range with forward direction', async () => {
        const a = docFromTextNotation('a >0b >0c');
        const b = docFromTextNotation('a |c');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes nested range with backward direction', async () => {
        const a = docFromTextNotation('{a <0b <0c}');
        const b = docFromTextNotation('{a |c}');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes nested range with forward direction', async () => {
        const a = docFromTextNotation('{a >0b >0c}');
        const b = docFromTextNotation('{a |c}');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('addRichComment', () => {
      it('Adds Rich Comment after Top Level form', async () => {
        const a = docFromTextNotation('(fo|o)••(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  :rcf)••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels', async () => {
        const a = docFromTextNotation('(foo)•|•(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  :rcf)••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, before Top Level form', async () => {
        const a = docFromTextNotation('(foo)••|(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  :rcf)••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, after Top Level form', async () => {
        const a = docFromTextNotation('(foo)|••(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  :rcf)••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, in comment', async () => {
        const a = docFromTextNotation('(foo)•;foo| bar•(bar)');
        const b = docFromTextNotation('(foo)•;foo bar••(comment•  |•  :rcf)••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Moves to Rich Comment below, if any', async () => {
        const a = docFromTextNotation('(foo|)••(comment••bar••baz)');
        const b = docFromTextNotation('(foo)••(comment••|bar••baz)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Moves to Rich Comment below, if any, looking behind line comments', async () => {
        const a = docFromTextNotation('(foo|)••;;line comment••(comment••bar••baz)');
        const b = docFromTextNotation('(foo)••;;line comment••(comment••|bar••baz)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('splice sexp', () => {
      it('splice empty', async () => {
        const a = docFromTextNotation('|');
        const b = docFromTextNotation('|');
        await paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splice list', async () => {
        const a = docFromTextNotation('(a|a b c)');
        const b = docFromTextNotation('a|a b c');
        await paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splice list also when forms have meta and readers', async () => {
        const a = docFromTextNotation('(^{:d e} #a|a b c)');
        const b = docFromTextNotation('^{:d e} #a|a b c');
        await paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splice vector', async () => {
        const a = docFromTextNotation('[a| b c]');
        const b = docFromTextNotation('a| b c');
        await paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('splice map', async () => {
        const a = docFromTextNotation('{a| b}');
        const b = docFromTextNotation('a| b');
        await paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('splice nested', async () => {
        const a = docFromTextNotation('[1 {ab| cd} 2]');
        const b = docFromTextNotation('[1 ab| cd 2]');
        await paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('splice set', async () => {
        // TODO: Figure out why the cursor gets misplaced
        const a = docFromTextNotation('#{a| b}');
        const b = docFromTextNotation('a |b');
        await paredit.spliceSexp(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('splice string', async () => {
        const a = docFromTextNotation('"h|ello"');
        await paredit.spliceSexp(a);
        expect(getText(a)).toEqual('hello');
      });
    });
  });
});

describe('paredit util', () => {
  describe('_semiColonWouldBreakStructureWhere', () => {
    it('returns false at the end of the document', () => {
      expect(paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" (d)|'))).toBe(
        false
      );
    });
    it('returns false at the end of the line', () => {
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" (d)|• •   •'))
      ).toBe(false);
    });
    it('returns false at in the whitespace at the end of the line', () => {
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" (d)  | • •   •'))
      ).toBe(false);
    });
    it('returns false withing a string', () => {
      expect(paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b| c" d'))).toBe(
        false
      );
    });
    it('returns false a semicolon would be (illegally) escaped withing a string', () => {
      expect(paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b\\| c" d'))).toBe(
        false
      );
    });
    it('returns false withing a comment', () => {
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" d ; e| f'))
      ).toBe(false);
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" d ; e f|•'))
      ).toBe(false);
    });
    it('returns false in whitespace before a comment', () => {
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" d |; e f'))
      ).toBe(false);
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" d | ; e f•'))
      ).toBe(false);
    });
    it('returns true inside a list ending on the same line', () => {
      expect(paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a (b |c)• d '))).toBe(
        6
      );
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a (b {|} c•) d '))
      ).toBe(6);
    });
    it('returns false inside a list ending on some other line', () => {
      expect(paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a (b |•c)• d '))).toBe(
        false
      );
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a (b {|•} c•) d '))
      ).toBe(false);
    });
    it('returns true before a list ending on the same line', () => {
      expect(paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" | (d)'))).toBe(
        false
      );
    });
    it('returns false if can move by sexp to the end of the line', () => {
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a "b c" | (d) • e'))
      ).toBe(false);
      expect(
        paredit._semiColonWouldBreakStructureWhere(
          docFromTextNotation('a [b c• |(d) {[e]}•f g] • ')
        )
      ).toBe(false);
    });
    it('returns true before a list ending on some other line', () => {
      expect(paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('a |(b •c)• d '))).toBe(
        2
      );
      expect(
        paredit._semiColonWouldBreakStructureWhere(docFromTextNotation('|a (b {•} c•) d '))
      ).toBe(2);
    });
  });
});
