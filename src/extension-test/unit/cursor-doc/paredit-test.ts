import * as expect from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as model from '../../../cursor-doc/model';
import { docFromTextNotation, textAndSelection, text } from '../common/text-notation';
import { ModelEditSelection } from '../../../cursor-doc/model';

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
    doc.selection = startSelection.clone();
  });

  describe('movement', () => {
    describe('rangeToSexprForward', () => {
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
        const a = docFromTextNotation('(|>|def|>| foo [vec])');
        const b = docFromTextNotation('(def|>| foo|>| [vec])');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds following vector including leading space', () => {
        const a = docFromTextNotation('(|>|def foo|>| [vec])');
        const b = docFromTextNotation('(def foo|>| [vec]|>|)');
        expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Reverses direction of selection and finds next sexp', () => {
        const a = docFromTextNotation('(|<|def foo|<| [vec])');
        const b = docFromTextNotation('(def foo|>| [vec]|>|)');
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
        const b = docFromTextNotation('(|>|def |>|foo [vec])');
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
        // off by 1 because \r\n is treated as 1 char?
        expect(actual).toEqual([start, end - 1]);
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
      it('Leaves an sexp if at the end', () => {
        const a = docFromTextNotation('(def foo [:foo :bar :baz|])');
        const b = docFromTextNotation('(def foo [:foo :bar :baz|]|)');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds next symbol, including leading space', () => {
        const a = docFromTextNotation('(|>|def|>| foo [vec])');
        const b = docFromTextNotation('(def|>| foo|>| [vec])');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Finds following vector including leading space', () => {
        const a = docFromTextNotation('(|>|def foo|>| [vec])');
        const b = docFromTextNotation('(def foo|>| [vec]|>|)');
        expect(paredit.forwardSexpOrUpRange(a)).toEqual(textAndSelection(b)[1]);
      });
      it('Reverses direction of selection and finds next sexp', () => {
        const a = docFromTextNotation('(|<|def foo|<| [vec])');
        const b = docFromTextNotation('(def foo|>| [vec]|>|)');
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
        const b = docFromTextNotation('(|>|def |>|foo [vec])');
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
        const a = docFromTextNotation('(def |>|foo|>| [vec])');
        const b = docFromTextNotation('(def foo| [vec])');
        paredit.moveToRangeRight(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Places cursor at the right end of the selection 2', () => {
        const a = docFromTextNotation('(|>|def foo|>| [vec])');
        const b = docFromTextNotation('(def foo| [vec])');
        paredit.moveToRangeRight(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Move to right of given range, regardless of previous selection', () => {
        const a = docFromTextNotation('(|<|def|<| foo [vec])');
        const b = docFromTextNotation('(def foo |>|[vec]|>|)');
        const c = docFromTextNotation('(def foo [vec]|)');
        paredit.moveToRangeRight(a, textAndSelection(b)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(c));
      });
    });

    describe('moveToRangeLeft', () => {
      it('Places cursor at the left end of the selection', () => {
        const a = docFromTextNotation('(def |>|foo|>| [vec])');
        const b = docFromTextNotation('(def |foo [vec])');
        paredit.moveToRangeLeft(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Places cursor at the left end of the selection 2', () => {
        const a = docFromTextNotation('(|>|def foo|>| [vec])');
        const b = docFromTextNotation('(|def foo [vec])');
        paredit.moveToRangeLeft(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Move to left of given range, regardless of previous selection', () => {
        const a = docFromTextNotation('(|<|def|<| foo [vec])');
        const b = docFromTextNotation('(def foo |>|[vec]|>|)');
        const c = docFromTextNotation('(def foo |[vec])');
        paredit.moveToRangeLeft(a, textAndSelection(b)[1]);
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
        const a = docFromTextNotation('(c•#f•(#b •[:f :b :z])•#x•#y•|1)');
        const b = docFromTextNotation('(c•#x•#y•|1•#f•(#b •[:f :b :z]))');
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
      it('dragSexprBackward: #f•(#b •[:f :b :z])•#x•#y•|1•#å#ä#ö => #x•#y•1•#f•(#b •[:f :b :z])•#å#ä#ö', async () => {
        doc.selection = new ModelEditSelection(26, 26);
        await paredit.dragSexprBackward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
      });
      it('dragSexprForward: #f•|(#b •[:f :b :z])•#x•#y•1#å#ä#ö => #x•#y•1•#f•|(#b •[:f :b :z])•#å#ä#ö', async () => {
        doc.selection = new ModelEditSelection(3, 3);
        await paredit.dragSexprForward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
        expect(doc.selection).toEqual(new ModelEditSelection(11));
      });
      it('dragSexprForward: #f•(#b •[:f :b :z])•#x•#y•|1•#å#ä#ö => #f•(#b •[:f :b :z])•#x•#y•|1•#å#ä#ö', async () => {
        doc.selection = new ModelEditSelection(26, 26);
        await paredit.dragSexprForward(doc);
        expect(doc.model.getText(0, Infinity)).toBe('#f\n(#b \n[:f :b :z])\n#x\n#y\n1\n#å#ä#ö');
        expect(doc.selection).toEqual(new ModelEditSelection(26));
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
        paredit.selectRangeBackward(a, [selDoc.selection.anchor, selDoc.selection.active]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Contracts forward selection and extends backwards', () => {
        const a = docFromTextNotation('(def foo [:foo :bar |>|:baz|>|])');
        const selDoc = docFromTextNotation('(def foo [:foo |:bar| :baz])');
        const b = docFromTextNotation('(def foo [:foo |<|:bar |<|:baz])');
        paredit.selectRangeBackward(a, [selDoc.selection.anchor, selDoc.selection.active]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('selectRangeForward', () => {
      it('(def foo [:foo >:bar> >|:baz>|]) => (def foo [:foo >:bar :baz>])', () => {
        const barSelection = new ModelEditSelection(15, 19),
          bazRange = [20, 24] as [number, number],
          barBazSelection = new ModelEditSelection(15, 24);
        doc.selection = barSelection;
        paredit.selectRangeForward(doc, bazRange);
        expect(doc.selection).toEqual(barBazSelection);
      });
      it('(def foo [<:foo :bar< >|:baz>|]) => (def foo [>:foo :bar :baz>])', () => {
        const [fooLeft, barRight] = [10, 19],
          barFooSelection = new ModelEditSelection(barRight, fooLeft),
          bazRange = [20, 24] as [number, number],
          fooBazSelection = new ModelEditSelection(19, 24);
        doc.selection = barFooSelection;
        paredit.selectRangeForward(doc, bazRange);
        expect(doc.selection).toEqual(fooBazSelection);
      });
      it('(def foo [<:foo :bar< <|:baz<|]) => (def foo [>:foo :bar :baz>])', () => {
        const [fooLeft, barRight] = [10, 19],
          barFooSelection = new ModelEditSelection(barRight, fooLeft),
          bazRange = [24, 20] as [number, number],
          fooBazSelection = new ModelEditSelection(19, 24);
        doc.selection = barFooSelection;
        paredit.selectRangeForward(doc, bazRange);
        expect(doc.selection).toEqual(fooBazSelection);
      });
    });
  });

  describe('selection stack', () => {
    const range = [15, 20] as [number, number];
    it('should make grow selection the topmost element on the stack', () => {
      paredit.growSelectionStack(doc, range);
      expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(
        new ModelEditSelection(range[0], range[1])
      );
    });
    it('get us back to where we started if we just grow, then shrink', () => {
      const selectionBefore = startSelection.clone();
      paredit.growSelectionStack(doc, range);
      paredit.shrinkSelection(doc);
      expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(selectionBefore);
    });
    it('should not add selections identical to the topmost', () => {
      const selectionBefore = doc.selection.clone();
      paredit.growSelectionStack(doc, range);
      paredit.growSelectionStack(doc, range);
      paredit.shrinkSelection(doc);
      expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(selectionBefore);
    });
    it('should have A topmost after adding A, then B, then shrinking', () => {
      const a = range,
        b: [number, number] = [10, 24];
      paredit.growSelectionStack(doc, a);
      paredit.growSelectionStack(doc, b);
      paredit.shrinkSelection(doc);
      expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(
        new ModelEditSelection(a[0], a[1])
      );
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
          `(c• [:e '(e o ea)•   3 {:w? 'w}•   :t |'(t i o im)•   :b 'b]•)`
        );
        const a = docFromTextNotation(
          `(c• [:e '(e o ea)•   3 {:w? 'w}•   :b 'b•   :t |'(t i o im)]•)`
        );
        await paredit.dragSexprForward(b, ['c']);
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
        const a = docFromTextNotation(`(b [x [1| 2 3]])`);
        const b = docFromTextNotation(`(b [x [2 1| 3]])`);
        await paredit.dragSexprForward(a, ['b']);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr backward in bound vectors', async () => {
        const a = docFromTextNotation(`(b [x [1 2 |3]])`);
        const b = docFromTextNotation(`(b [x [1 |3 2]])`);
        await paredit.dragSexprBackward(a, ['b']);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr forward in bound lists', async () => {
        const a = docFromTextNotation(`(b [x (1 2| 3)])`);
        const b = docFromTextNotation(`(b [x (1 3 2|)])`);
        await paredit.dragSexprForward(a, ['b']);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('drags single sexpr backward in bound lists', async () => {
        const a = docFromTextNotation(`(b [x (1 2 |3)])`);
        const b = docFromTextNotation(`(b [x (1 |3 2)])`);
        await paredit.dragSexprBackward(a, ['b']);
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
        const b = docFromTextNotation(`((fn foo•  [x]•  [:foo•   :bar•   :baz])• |1)`);
        const a = docFromTextNotation(`|1•((fn foo•  [x]•  [:foo•   :bar•   :baz]))`);
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
        it('slurps form after empty list', async () => {
          const a = docFromTextNotation('(|) "foo"');
          const b = docFromTextNotation('(| "foo")');
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
        it('slurps form including meta and readers', async () => {
          const a = docFromTextNotation('(|) ^{:a b} #c ^d "foo"');
          const b = docFromTextNotation('(| ^{:a b} #c ^d "foo")');
          await paredit.forwardSlurpSexp(a);
          expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
      });

      describe('Slurping backwards', () => {
        // TODO: Figure out why this test makes the following test fail
        //       It's something with in-string navigation...
        it.skip('slurps form before string', async () => {
          const a = docFromTextNotation('(str) "fo|o"');
          const b = docFromTextNotation('"(str) fo|o"');
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
          // TODO: Figure out how to test result after format
          //       (Because that last space is then removed)
          const b = docFromTextNotation('(^{:a b} #c ^d "foo" |)');
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
      // TODO: Change to await instead of void
      it('Leaves closing paren of empty list alone', async () => {
        const a = docFromTextNotation('{::foo ()|• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes closing paren if unbalance', async () => {
        const a = docFromTextNotation('{::foo )|• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening paren of non-empty list alone', async () => {
        const a = docFromTextNotation('{::foo (|a)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |(a)• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo |"a"• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves closing quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo "a"|• ::bar :foo}');
        const b = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings', async () => {
        const a = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 2', async () => {
        const a = docFromTextNotation('{::foo "a|a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 3', async () => {
        const a = docFromTextNotation('{::foo "aa|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote', async () => {
        const a = docFromTextNotation('{::foo \\"|• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote in string', async () => {
        const a = docFromTextNotation('{::foo "\\"|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in list', async () => {
        const a = docFromTextNotation('{::foo (a|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty list function', async () => {
        const a = docFromTextNotation('{::foo (|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
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
        const a = docFromTextNotation('{::foo #(|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
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
      it('Deletes whitespace to the left of the cursor', async () => {
        const a = docFromTextNotation(
          `
(if false nil
  |true)
        `.trim()
        );
        const b = docFromTextNotation(`(if false nil |true)`.trim());
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left of the cursor without crossing multiple lines', async () => {
        const a = docFromTextNotation('[•• |::foo]');
        const b = docFromTextNotation('[• |::foo]');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and right of the cursor when inside whitespace', async () => {
        const a = docFromTextNotation('[• | ::foo]');
        const b = docFromTextNotation('[|::foo]');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and inserts a space when arriving at the end of a line', async () => {
        const a = docFromTextNotation('(if :foo•  |:bar   :baz)');
        const b = docFromTextNotation('(if :foo |:bar   :baz)');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and inserts a single space when ending up on a line with trailing whitespace', async () => {
        const a = docFromTextNotation('(if :foo    •  |:bar   :baz)');
        const b = docFromTextNotation('(if :foo |:bar   :baz)');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes whitespace to the left and avoids inserting a space if on a close token', async () => {
        const a = docFromTextNotation('(if :foo•    |)');
        const b = docFromTextNotation('(if :foo|)');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });

      it('Deletes a character when inside a token on a blank line', async () => {
        const a = docFromTextNotation('(if• :|foo)');
        const b = docFromTextNotation('(if• |foo)');
        await paredit.backspace(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('Kill character forwards (delete)', () => {
      it('Leaves closing paren of empty list alone', async () => {
        const a = docFromTextNotation('{::foo |()• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes closing paren if unbalance', async () => {
        const a = docFromTextNotation('{::foo |)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening paren of non-empty list alone', async () => {
        const a = docFromTextNotation('{::foo |(a)• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|a)• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves opening quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo |"a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Leaves closing quote of non-empty string alone', async () => {
        const a = docFromTextNotation('{::foo "a|"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "a"|• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings', async () => {
        const a = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in strings 2', async () => {
        const a = docFromTextNotation('{::foo "|aa"• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote', async () => {
        const a = docFromTextNotation('{::foo |\\"• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes quoted quote in string', async () => {
        const a = docFromTextNotation('{::foo "|\\""• ::bar :foo}');
        const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes contents in list', async () => {
        const a = docFromTextNotation('{::foo (|a)• ::bar :foo}');
        const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes empty list function', async () => {
        const a = docFromTextNotation('{::foo (|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
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
        const a = docFromTextNotation('{::foo #(|)• ::bar :foo}');
        const b = docFromTextNotation('{::foo |• ::bar :foo}');
        await paredit.deleteForward(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('killRange', () => {
      it('Deletes top-level range with backward direction', async () => {
        const a = docFromTextNotation('a |<|b|<| c');
        const b = docFromTextNotation('a | c');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes top-level range with backward direction, including space', async () => {
        const a = docFromTextNotation('a |<|b |<|c');
        const b = docFromTextNotation('a |c');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes top-level range with forward direction', async () => {
        const a = docFromTextNotation('a |>|b |>|c');
        const b = docFromTextNotation('a |c');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes nested range with backward direction', async () => {
        const a = docFromTextNotation('{a |<|b |<|c}');
        const b = docFromTextNotation('{a |c}');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Deletes nested range with forward direction', async () => {
        const a = docFromTextNotation('{a |>|b |>|c}');
        const b = docFromTextNotation('{a |c}');
        await paredit.killRange(a, textAndSelection(a)[1]);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
    });

    describe('addRichComment', () => {
      it('Adds Rich Comment after Top Level form', async () => {
        const a = docFromTextNotation('(fo|o)••(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels', async () => {
        const a = docFromTextNotation('(foo)•|•(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, before Top Level form', async () => {
        const a = docFromTextNotation('(foo)••|(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, after Top Level form', async () => {
        const a = docFromTextNotation('(foo)|••(bar)');
        const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
        await paredit.addRichComment(a);
        expect(textAndSelection(a)).toEqual(textAndSelection(b));
      });
      it('Inserts Rich Comment between Top Levels, in comment', async () => {
        const a = docFromTextNotation('(foo)•;foo| bar•(bar)');
        const b = docFromTextNotation('(foo)•;foo bar••(comment•  |•  )••(bar)');
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

      // NB: enabling this breaks bunch of other tests.
      //     Not sure why, but it can be run successfully by itself.
      it.skip('splice string', async () => {
        const a = docFromTextNotation('"h|ello"');
        await paredit.spliceSexp(a);
        expect(text(a)).toEqual('hello');
      });
    });
  });
});
