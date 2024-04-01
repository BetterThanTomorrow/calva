import * as expect from 'expect';
import * as model from '../../../cursor-doc/model';
import * as handlers from '../../../paredit/commands';
import { docFromTextNotation, textNotationFromDoc } from '../common/text-notation';
import _ = require('lodash');

model.initScanner(20000);

/**
 * Properties that pertain to changes, that we cannot reflect in the "expected" doc in each test.
 */
const defaultDocOmit = [
  'model.deletedLines',
  'model.insertedLines',
  'model.dirtyLines',
  'model.changedLines',
  'model.lineEndingLength',
];

describe('paredit commands', () => {
  describe('movement', () => {
    describe('forwardSexp', () => {
      it('Single-cursor: find the list in front', () => {
        const a = docFromTextNotation('|(a b [c])•|1(a b [c])');
        const b = docFromTextNotation('(a b [c])|•(a b [c])');
        handlers.forwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: find the list in front', () => {
        const a = docFromTextNotation('|(a b [c])•|1(a b [c])');
        const b = docFromTextNotation('(a b [c])|•(a b [c])|1');
        handlers.forwardSexp(a, true);
        expect(a).toEqual(b);
      });
      it('Single-cursor: find the list in front through metadata', () => {
        const a = docFromTextNotation('|^:a (b c [d])•|1^:a (b c [d])');
        const b = docFromTextNotation('^:a (b c [d])|•^:a (b c [d])');
        handlers.forwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: find the list in front through metadata', () => {
        const a = docFromTextNotation('|^:a (b c [d])•|1^:a (b c [d])');
        const b = docFromTextNotation('^:a (b c [d])|•^:a (b c [d])|1');
        handlers.forwardSexp(a, true);
        expect(a).toEqual(b);
      });
      it('Single-cursor: find the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (c d [e])•|1^:f #a #b (c d [e])');
        const b = docFromTextNotation('^:f #a #b (c d [e])|•^:f #a #b (c d [e])');
        handlers.forwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: find the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (c d [e])•|1^:f #a #b (c d [e])');
        const b = docFromTextNotation('^:f #a #b (c d [e])|•^:f #a #b (c d [e])|1');
        handlers.forwardSexp(a, true);
        expect(a).toEqual(b);
      });
      it('Single-cursor: find the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (c d [e])•|1^:f #a #b (c d [e])');
        const b = docFromTextNotation('^:f #a #b (c d [e])|•^:f #a #b (c d [e])');
        handlers.forwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: find the list in front through metadata and readers', () => {
        const a = docFromTextNotation('|^:f #a #b (c d [e])•|1^:f #a #b (c d [e])');
        const b = docFromTextNotation('^:f #a #b (c d [e])|•^:f #a #b (c d [e])|1');
        handlers.forwardSexp(a, true);
        expect(a).toEqual(b);
      });
      it('Single-cursor: do not find anything at end of list', () => {
        const a = docFromTextNotation('(|)•(|1)');
        const b = docFromTextNotation('(|)•()');
        handlers.forwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: do not find anything at end of list', () => {
        const a = docFromTextNotation('(|)•(|1)');
        const b = docFromTextNotation('(|)•(|1)');
        handlers.forwardSexp(a, true);
        expect(a).toEqual(b);
      });
      it('Single-cursor: Cursor 1 finds fwd sexp, cursor 2 does not, cursor 3 does', () => {
        const a = docFromTextNotation('(|a)•(|1)•|2(b)');
        const b = docFromTextNotation('(a|)•()•(b)');
        handlers.forwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: Cursor 1 finds fwd sexp, cursor 2 does not, cursor 3 does', () => {
        const a = docFromTextNotation('(|a)•(|1)•|2(b)');
        const b = docFromTextNotation('(a|)•(|1)•(b)|2');
        handlers.forwardSexp(a, true);
        expect(a).toEqual(b);
      });
    });

    describe('backwardSexp', () => {
      it('Single-cursor: find the list preceding', () => {
        const a = docFromTextNotation('(def foo |1[vec])|');
        const b = docFromTextNotation('|(def foo [vec])');
        handlers.backwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: find the list preceding', () => {
        const a = docFromTextNotation('(def foo |1[vec])|');
        const b = docFromTextNotation('|(def |1foo [vec])');
        handlers.backwardSexp(a, true);
        expect(a).toEqual(b);
      });

      it('Single-cursor: find the list preceding through metadata', () => {
        const a = docFromTextNotation('^:foo (def |1foo [vec])|');
        const b = docFromTextNotation('|^:foo (def foo [vec])');
        handlers.backwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: find the list preceding through metadata', () => {
        const a = docFromTextNotation('^:foo (def |1foo [vec])|');
        const b = docFromTextNotation('|^:foo (|1def foo [vec])');
        handlers.backwardSexp(a, true);
        expect(a).toEqual(b);
      });

      it('Single-cursor: find the list preceding through metadata and readers', () => {
        const a = docFromTextNotation('^:f #a #b (def |1foo [vec])|');
        const b = docFromTextNotation('|^:f #a #b (def foo [vec])');
        handlers.backwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: find the list preceding through metadata and readers', () => {
        const a = docFromTextNotation('^:f #a #b (def |1foo [vec])|');
        const b = docFromTextNotation('|^:f #a #b (|1def foo [vec])');
        handlers.backwardSexp(a, true);
        expect(a).toEqual(b);
      });

      it('Single-cursor: find the list preceding through metadata and readers', () => {
        const a = docFromTextNotation('#c ^:f #a #b (def |1foo [vec])|');
        const b = docFromTextNotation('|#c ^:f #a #b (def foo [vec])');
        handlers.backwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: find the list preceding through metadata and readers', () => {
        const a = docFromTextNotation('#c ^:f #a #b (def |1foo [vec])|');
        const b = docFromTextNotation('|#c ^:f #a #b (|1def foo [vec])');
        handlers.backwardSexp(a, true);
        expect(a).toEqual(b);
      });

      it('Single-cursor: do not find anything at start of list', () => {
        const a = docFromTextNotation('(|)•(|1)');
        const b = docFromTextNotation('(|)•()');
        handlers.backwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: do not find anything at start of list', () => {
        const a = docFromTextNotation('(|)•(|1)');
        const b = docFromTextNotation('(|)•(|1)');
        handlers.backwardSexp(a, true);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds previous form, including space, and reverses direction', () => {
        const a = docFromTextNotation('(def <foo [vec]<)|1');
        const b = docFromTextNotation('(|def foo [vec])');
        handlers.backwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: Finds previous form, including space, and reverses direction', () => {
        const a = docFromTextNotation('(def <foo [vec]<)|1');
        const b = docFromTextNotation('|1(|def foo [vec])');
        handlers.backwardSexp(a, true);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Cursor 1 finds bwd sexp, cursor 2 does not, cursor 3 does', () => {
        const a = docFromTextNotation('(a|)•(|1)•|2(b)');
        const b = docFromTextNotation('(|a)•()•(b)');
        handlers.backwardSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: Cursor 1 finds bwd sexp, cursor 2 does not, cursor 3 does', () => {
        const a = docFromTextNotation('(a|)•(|1)•|2(b)');
        const b = docFromTextNotation('(|a)•|2(|1)•(b)');
        handlers.backwardSexp(a, true);
        expect(a).toEqual(b);
      });
    });

    describe('forwardDownSexp', () => {
      it('Single-cursor: ', () => {
        const a = docFromTextNotation('(|c•(|1#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('(c•(|#b •[:f :b :z])•#z•1)');
        handlers.forwardDownSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: ', () => {
        const a = docFromTextNotation('(|c•(|1#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('(c•(|#b •[|1:f :b :z])•#z•1)');
        handlers.forwardDownSexp(a, true);
        expect(a).toEqual(b);
      });
    });

    describe('backwardDownSexp', () => {
      it('Single-cursor: ', () => {
        const a = docFromTextNotation('(c•(#b •[:f :b :z])|1•#z•1)|');
        const b = docFromTextNotation('(c•(#b •[:f :b :z])•#z•1|)');
        handlers.backwardDownSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: ', () => {
        const a = docFromTextNotation('(c•(#b •[:f :b :z])|1•#z•1)|');
        const b = docFromTextNotation('(c•(#b •[:f :b :z]|1)•#z•1|)');
        handlers.backwardDownSexp(a, true);
        expect(a).toEqual(b);
      });
    });

    describe('forwardUpSexp', () => {
      it('Single-cursor: ', () => {
        const a = docFromTextNotation('|2(c•(#b •[:f |1:b :z|])•#z•1|3)');
        const b = docFromTextNotation('(c•(#b •[:f :b :z]|)•#z•1)');
        handlers.forwardUpSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: ', () => {
        const a = docFromTextNotation('|1(c•(#b •[:f |:b :z|])•#z•1|2)');
        const b = docFromTextNotation('|1(c•(#b •[:f :b :z]|)•#z•1)|2');
        handlers.forwardUpSexp(a, true);
        expect(a.selections).toEqual(b.selections);
      });
    });

    describe('backwardUpSexp', () => {
      it('Single-cursor: ', () => {
        const a = docFromTextNotation('(c•(|#b •[|1:f|2 :b :z])•#z•1)|3');
        const b = docFromTextNotation('(c•|(#b •[:f :b :z])•#z•1)');
        handlers.backwardUpSexp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: ', () => {
        const a = docFromTextNotation('(c•(|#b •[|1:f|2 :b :z])•#z•1)|3');
        const b = docFromTextNotation('(c•|(|1#b •[:f :b :z])•#z•1)|2');
        handlers.backwardUpSexp(a, true);
        expect(a.selections).toEqual(b.selections);
      });
    });

    describe('forwardSexpOrUp', () => {
      it('Single-cursor: leave sexp if at the end', () => {
        const a = docFromTextNotation('(a|)•(b|1)');
        const b = docFromTextNotation('(a)|•(b)');
        handlers.forwardSexpOrUp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: leave sexp if at the end', () => {
        const a = docFromTextNotation('(a|)•(b|1)');
        const b = docFromTextNotation('(a)|•(b)|1');
        handlers.forwardSexpOrUp(a, true);
        expect(a).toEqual(b);
      });
      it('Single-cursor: one goes fwd a sexp, one leaves sexp b/c at the end', () => {
        const a = docFromTextNotation('(|a)•(b|1)');
        const b = docFromTextNotation('(a|)•(b)');
        handlers.forwardSexpOrUp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: one goes fwd a sexp, one leaves sexp b/c at the end', () => {
        const a = docFromTextNotation('(|a)•(b|1)');
        const b = docFromTextNotation('(a|)•(b)|1');
        handlers.forwardSexpOrUp(a, true);
        expect(a).toEqual(b);
      });
    });

    describe('backwardSexpOrUp', () => {
      it('Single-cursor: go up when at front bounds', () => {
        const a = docFromTextNotation('(|1a (|b 1))');
        const b = docFromTextNotation('(a |(b 1))');
        handlers.backwardSexpOrUp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: go up when at front bounds', () => {
        const a = docFromTextNotation('(|1a (|b 1))');
        const b = docFromTextNotation('|1(a |(b 1))');
        handlers.backwardSexpOrUp(a, true);
        expect(a).toEqual(b);
      });
      it('Single-cursor: one go up when at front bounds, the other back sexp', () => {
        const a = docFromTextNotation('(|1a (b c|))');
        const b = docFromTextNotation('(a (b |c))');
        handlers.backwardSexpOrUp(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursors: one go up when at front bounds, the other back sexp', () => {
        const a = docFromTextNotation('(|1a (b c|))');
        const b = docFromTextNotation('|1(a (b |c))');
        handlers.backwardSexpOrUp(a, true);
        expect(a).toEqual(b);
      });
    });

    describe('closeList', () => {
      it('Single-cursor: ', () => {
        const a = docFromTextNotation('|(c•(|1#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('|(c•(#b •[:f :b :z])•#z•1)');
        handlers.closeList(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: ', () => {
        const a = docFromTextNotation('|(c•(|1#b •[:f :b :z])•#z•1)');
        const b = docFromTextNotation('|(c•(#b •[:f :b :z]|1)•#z•1)');
        handlers.closeList(a, true);
        expect(a).toEqual(b);
      });
    });

    describe('openList', () => {
      it('Single-cursor: ', () => {
        const a = docFromTextNotation('(c•|(|1#b •[:f :b :z])|2•#z•1)');
        const b = docFromTextNotation('(|c•(#b •[:f :b :z])•#z•1)');
        handlers.openList(a, false);
        expect(a).toEqual(b);
      });
      it('Multi-cursor: ', () => {
        const a = docFromTextNotation('(c•|(|1#b •[:f :b :z])|2•#z•1)');
        const b = docFromTextNotation('(|c•(|1#b •[:f :b :z])•#z•1)');
        handlers.openList(a, true);
        expect(a.selections).toEqual(b.selections);
      });
    });
  });

  describe('selection', () => {
    describe('selectCurrentForm', () => {
      it('Single-cursor: handles cases like reader tags/metadata + keeps other selections ', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js a|a #p (+ a)•b b]•{:a aa•:b b}))•(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [|^js aa| #p (+ a)•b b]•{:a aa•:b b}))•(:a)'
        );
        handlers.selectCurrentForm(a, false);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor: handles cases like reader tags/metadata + keeps other selections ', () => {
        const a = docFromTextNotation(
          '(defn|1 |2[a b]•(let [|3^js aa |4#p (+ a)•<5b b<5]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(|1defn|1 |2[a b]|2•(let [|3^js aa|3 |4#p (+ a)|4•<5b b<5]•{:a aa•:b b}))•(|:a|)'
        );
        handlers.selectCurrentForm(a, true);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });

      it('Single-cursor: handles cursor at a distance from form', () => {
        const a = docFromTextNotation('[|1    a b  |2c    d { e f}|3 g   |]');
        const aSelections = a.selections;
        const b = docFromTextNotation('[    a b  c    d { e f} |g|   ]');
        handlers.selectCurrentForm(a, false);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor: handles cursor at a distance from form', () => {
        const a = docFromTextNotation('[|1    a b  |2c    d { e f}|3 g   |]');
        const aSelections = a.selections;
        const b = docFromTextNotation('[    |1a|1 b  |2c|2    d |3{ e f}|3 |g|   ]');
        handlers.selectCurrentForm(a, true);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });

      it('Single-cursor: collapses overlapping selections', () => {
        const a = docFromTextNotation(
          '(de|1fn| [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(|defn| [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:a)'
        );
        handlers.selectCurrentForm(a, false);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor: collapses overlapping selections', () => {
        const a = docFromTextNotation(
          '(de|5fn|1 |2[a b]•(let [|3^js aa |4#p (+ a)•<5b b<5]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(|1defn|1 |2[a b]|2•(let [|3^js aa|3 |4#p (+ a)|4•<5b b<5]•{:a aa•:b b}))•(|:a|)'
        );
        handlers.selectCurrentForm(a, true);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });

      it('Single-cursor: collapses overlapping selections preferring the larger one', () => {
        const a = docFromTextNotation(
          '(de|1fn| [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(|defn| [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:a)'
        );
        handlers.selectCurrentForm(a, false);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor: collapses overlapping selections preferring the larger one', () => {
        const a = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b |b]|1•|3{:a a|2a•:b b}))•(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let |1[^js aa #p (+ a)•b b]|1•|3{:a aa•:b b}|3))•(:a)'
        );
        handlers.selectCurrentForm(a, true);
        expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('rangeForDefun', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)|'
        );
        handlers.rangeForDefun(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '|1(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))|1•|(:a)|'
        );
        handlers.rangeForDefun(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('sexpRangeExpansion', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a|)'
        );
        handlers.sexpRangeExpansion(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(|1defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a|)'
        );
        handlers.sexpRangeExpansion(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('sexpRangeContraction', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a|)'
        );
        handlers.sexpRangeExpansion(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
        const c = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)|'
        );
        handlers.sexpRangeExpansion(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections, c.selections]);
        handlers.sexpRangeContraction(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(|1defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a|)'
        );
        handlers.sexpRangeExpansion(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
        const c = docFromTextNotation(
          '(|1defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b})|1)•|(:a)|'
        );
        handlers.sexpRangeExpansion(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections, c.selections]);
        handlers.sexpRangeContraction(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectForwardSexp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b]•(let [^js |2aa|2 #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a|)'
        );
        handlers.selectForwardSexp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b]•(let [^js |2aa|2 #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn|1 |1[a b]•(let [^js |2aa #p (+ a)|2•b b]•{:a aa•:b b}))•(:|a|)'
        );
        handlers.selectForwardSexp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectRight', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b]•(let [^js |2aa|2 #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a|)'
        );
        handlers.selectRight(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b]•(let [^js |2aa|2 #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn|1 [a b]|1•(let [^js |2aa #p (+ a)|2•b b]•{:a aa•:b b}))•(:|a|)'
        );
        handlers.selectRight(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectBackwardSexp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(|1defn|1 [a b]•(let [^js aa #p|2 (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(<:<a)'
        );
        handlers.selectBackwardSexp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(|1defn|1 [a b]•(let [^js aa #p|2 (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(|1defn [a b]•(let [<2^js aa #p<2 (+ a)•b b]•{:a aa•:b b}))•(<:<a)'
        );
        handlers.selectBackwardSexp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectForwardDownSexp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(|:a)'
        );
        handlers.selectForwardDownSexp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn|1 [|1a b|2]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(|:a)'
        );
        handlers.selectForwardDownSexp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectBackwardDownSexp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b})<)•<(:a)'
        );
        handlers.selectBackwardDownSexp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(<1defn<1 [a b|2]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b})<)•<(:a)'
        );
        handlers.selectBackwardDownSexp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectForwardUpSexp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        handlers.selectForwardUpSexp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))|1•|(:a)'
        );
        handlers.selectForwardUpSexp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectForwardSexpOrUp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)|'
        );
        handlers.selectForwardSexpOrUp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•|(:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn|1 |1[a b|2]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b})|2)•|(:a)|'
        );
        handlers.selectForwardSexpOrUp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectBackwardSexpOrUp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•<(<:a)'
        );
        handlers.selectBackwardSexpOrUp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(<1defn<1 [a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '<1(defn<1 <2[a b<2]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•<(<:a)'
        );
        handlers.selectBackwardSexpOrUp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectBackwardUpSexp', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(defn |1[a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•<(<:a)'
        );
        handlers.selectBackwardUpSexp(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(defn |1[a b|2]|2•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(|:a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '<1(defn [a b<1]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•<(<:a)'
        );
        handlers.selectBackwardUpSexp(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectCloseList', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a|)'
        );
        handlers.selectCloseList(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b})|1)•(:|a|)'
        );
        handlers.selectCloseList(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
    describe('selectOpenList', () => {
      it('Single-cursor:', () => {
        const a = docFromTextNotation(
          '(defn|1 [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(<:<a)'
        );
        handlers.selectOpenList(a, false);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
      it('Multi-cursor:', () => {
        const a = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(:|a)'
        );
        const aSelections = a.selections;
        const b = docFromTextNotation(
          '(defn [a b]•(let [^js aa #p (+ a)•b b]•{:a aa•:b b}))•(<:<a)'
        );
        handlers.selectOpenList(a, true);
        expect(a.selectionsStack).toEqual([aSelections, b.selections]);
      });
    });
  });

  describe('deletion', () => {
    describe('killLeft', () => {
      // TODO: Test kill-also-copies?
      // TODO: Test mullticursor
      it('Single-cursor: Finds whole string in list', async () => {
        const a = docFromTextNotation('("This needs to find the start of the string."|)');
        const b = docFromTextNotation('(|)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds whole string', async () => {
        const a = docFromTextNotation('"This needs to find the start of the string."|');
        const b = docFromTextNotation('|');
        await handlers.killLeft(a, false);
        expect(_.omit(a, 'model')).toEqual(_.omit(b, 'model'));
      });

      it('Single-cursor: Finds start of string', async () => {
        const a = docFromTextNotation('"This needs to find the |start of the string."');
        const b = docFromTextNotation('"|start of the string."');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds line content start in multi line string', async () => {
        const a = docFromTextNotation('"This needs to find the start\n of the |string."');
        const b = docFromTextNotation('"This needs to find the start\n |string."');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds line content start in multi line string (Windows)', async () => {
        const a = docFromTextNotation('"This needs to find the start\r\n of the |string."');
        const b = docFromTextNotation('"This needs to find the start\r\n |string."');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of form from inside comment', async () => {
        const a = docFromTextNotation('(a ;; foo|\n e)');
        const b = docFromTextNotation('(|\n e)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of form from inside comment (Windows)', async () => {
        const a = docFromTextNotation('(a ;; foo|\r\n e)');
        const b = docFromTextNotation('(|\r\n e)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Maintains balanced delimiters 1', async () => {
        const a = docFromTextNotation('(a b (c\n d) e|)');
        const b = docFromTextNotation('(a b |)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Maintains balanced delimiters 1 (Windows)', async () => {
        const a = docFromTextNotation('(a b (c\r\n d) e|)');
        const b = docFromTextNotation('(a b |)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Maintains balanced delimiters 2', async () => {
        const a = docFromTextNotation('(aa (c (e\nf)) |g)');
        const b = docFromTextNotation('(aa |g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Maintains balanced delimiters 2 (Windows)', async () => {
        const a = docFromTextNotation('(aa (c (e\r\nf)) |g)');
        const b = docFromTextNotation('(aa |g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Maintains balanced delimiters 3', async () => {
        const a = docFromTextNotation('(aa (  c (e\nf)) |g)');
        const b = docFromTextNotation('(aa |g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Maintains balanced delimiters 3 (Windows)', async () => {
        const a = docFromTextNotation('(aa (  c (e\r\nf)) |g)');
        const b = docFromTextNotation('(aa |g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Squashes preceding whitespace, stopping at line start', async () => {
        const a = docFromTextNotation('(a\n |e) g)');
        const b = docFromTextNotation('(a\n|e) g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Squashes preceding whitespace, stopping at line start (Windows)', async () => {
        const a = docFromTextNotation('(a\r\n |e) g)');
        const b = docFromTextNotation('(a\r\n|e) g)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Retreats past line start when invoked at line start', async () => {
        const a = docFromTextNotation('(a\n| e) g)');
        const b = docFromTextNotation('(a| e) g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Retreats past line start when invoked at line start (Windows)', async () => {
        const a = docFromTextNotation('(a\r\n| e) g)');
        const b = docFromTextNotation('(a| e) g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Retreats past line start when invoked at line start 2', async () => {
        const a = docFromTextNotation('(:a :b \n|)');
        const b = docFromTextNotation('(:a :b |)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      // This one catches the weird `\r\n\|)` case, described inside `backwardHybredSexpRange`'s line comments.
      it('Single-cursor: Retreats past line start when invoked at line start 2 (Windows)', async () => {
        const a = docFromTextNotation('(:a :b \r\n|)');
        const b = docFromTextNotation('(:a :b |)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Retreats past line start, squashing whitepace when invoked at line start', async () => {
        const a = docFromTextNotation('(a  \n| e) g)');
        const b = docFromTextNotation('(a | e) g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Retreats past line start, squashing whitepace when invoked at line start (Windows)', async () => {
        const a = docFromTextNotation('(a  \r\n| e) g)');
        const b = docFromTextNotation('(a | e) g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Retreats past line start, squashing only preceding whitepace when invoked at line start', async () => {
        const a = docFromTextNotation('(a  \n| e) g)');
        const b = docFromTextNotation('(a | e) g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Retreats past line start, squashing only preceding whitepace when invoked at line start (Windows)', async () => {
        const a = docFromTextNotation('(a  \r\n| e) g)');
        const b = docFromTextNotation('(a | e) g)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      // https://github.com/BetterThanTomorrow/calva/pull/2427#issuecomment-1985910937
      it('Single-cursor: Finds start of line after whitespace', async () => {
        const a = docFromTextNotation('(a\n |b)');
        const b = docFromTextNotation('(a\n|b)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of line after whitespace (Windows)', async () => {
        const a = docFromTextNotation('(a\r\n |b)');
        const b = docFromTextNotation('(a\r\n|b)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds newline when at line start', async () => {
        const a = docFromTextNotation('(a\n| b)');
        const b = docFromTextNotation('(a| b)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Finds newline when at line start (Windows)', async () => {
        const a = docFromTextNotation('(a\r\n| b)');
        const b = docFromTextNotation('(a| b)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Finds start of vectors', async () => {
        const a = docFromTextNotation('[a [b c d e| f] g h]');
        const b = docFromTextNotation('[a [| f] g h]');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of lists', async () => {
        const a = docFromTextNotation('(foo |bar)\n');
        const b = docFromTextNotation('(|bar)\n');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of maps', async () => {
        const a = docFromTextNotation('{:a 1 :b 2| :c 3}');
        const b = docFromTextNotation('{| :c 3}');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of line in multiline maps', async () => {
        const a = docFromTextNotation('{:a 1 \n:b 2| :c 3}');
        const b = docFromTextNotation('{:a 1 \n| :c 3}');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of line in multiline maps (Windows)', async () => {
        const a = docFromTextNotation('{:a 1 \r\n:b 2| :c 3}');
        const b = docFromTextNotation('{:a 1 \r\n| :c 3}');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of expr in multiline maps', async () => {
        const a = docFromTextNotation('{:a 1 :b 2 (+\n 0\n 2\n) 3| :c 4}');
        const b = docFromTextNotation('{:a 1 :b 2 | :c 4}');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Finds start of expr in multiline maps (Windows)', async () => {
        const a = docFromTextNotation('{:a 1 :b 2 (+\r\n 0\r\n 2\r\n) 3| :c 4}');
        const b = docFromTextNotation('{:a 1 :b 2 | :c 4}');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Finds start of immediate list even in bindings if at list close', async () => {
        const a = docFromTextNotation('(let [a (+ 1 2)\n b (+ 2 3)|] (+ a b))');
        const b = docFromTextNotation('(let [a (+ 1 2)\n b |] (+ a b))');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of line in bindings if not at list close', async () => {
        const a = docFromTextNotation('(let [{a :a} c\n {b :b} d|] (+ a b))');
        const b = docFromTextNotation('(let [{a :a} c\n |] (+ a b))');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds start of expr in multiline bindings', async () => {
        const a = docFromTextNotation('(let [{a :a\n b :b} d| c (+ 2 3)] (+ a b))');
        const b = docFromTextNotation('(let [| c (+ 2 3)] (+ a b))');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Finds start of expr in multiline bindings (Windows)', async () => {
        const a = docFromTextNotation('(let [{a :a\r\n b :b} d| c (+ 2 3)] (+ a b))');
        const b = docFromTextNotation('(let [| c (+ 2 3)] (+ a b))');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Finds range in line of tokens', async () => {
        const a = docFromTextNotation('2 \n"hello" :hello/world bye | ');
        const b = docFromTextNotation('2 \n| ');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds range in token with form over multiple lines', async () => {
        const a = docFromTextNotation('3 [\n 1 \n] a|');
        const b = docFromTextNotation('3 |');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Finds range in token with form over multiple lines (Windows)', async () => {
        const a = docFromTextNotation('3 [\r\n 1 \r\n] a|');
        const b = docFromTextNotation('3 |');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Deals with comments start of line', async () => {
        const a = docFromTextNotation('\n;;  hi|');
        const b = docFromTextNotation('\n|');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Deals with comments start of line (Windows)', async () => {
        const a = docFromTextNotation('\r\n;;  hi|');
        const b = docFromTextNotation('\r\n|');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Deals with comments middle of line', async () => {
        const a = docFromTextNotation('\n;; |hi');
        const b = docFromTextNotation('\n|hi');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Deals with comments middle of line (Windows)', async () => {
        const a = docFromTextNotation('\r\n;; |hi');
        const b = docFromTextNotation('\r\n|hi');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Deals with empty lines', async () => {
        const a = docFromTextNotation('\n|');
        const b = docFromTextNotation('|');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Deals with empty lines (Windows)', async () => {
        const a = docFromTextNotation('\r\n|');
        const b = docFromTextNotation('|');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Deals with comments with empty line', async () => {
        const a = docFromTextNotation('\n;; |');
        const b = docFromTextNotation('\n|');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Deals with comments with empty line (Windows)', async () => {
        const a = docFromTextNotation('\r\n;; |');
        const b = docFromTextNotation('\r\n|');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Does not retreat when on closing token type ', async () => {
        const a = docFromTextNotation('\n(|a e)\n');
        const b = docFromTextNotation('\n(||a e)\n');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);
      });

      it('Single-cursor: Finds the full form after an ignore marker', async () => {
        // https://github.com/BetterThanTomorrow/calva/pull/1293#issuecomment-927123696
        const a = docFromTextNotation(
          '(comment•  #_[a b (c d•              e•              f) g]|•  :a•)'
        );
        const b = docFromTextNotation('(comment•  #_|•  :a•)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
      });

      it('Single-cursor: Takes 3 invocations to kill to first non-whitespace, preceding whitespace and then preceding newline', async () => {
        const a = docFromTextNotation('(:a :b \n    :c :d|)');
        const b = docFromTextNotation('(:a :b \n    |)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);

        const c = docFromTextNotation('(:a :b \n|)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(c);

        const d = docFromTextNotation('(:a :b |)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(d, defaultDocOmit));
      });

      it('Single-cursor: Takes 3 invocations to kill to first non-whitespace, preceding whitespace and then preceding newline (Windows)', async () => {
        const a = docFromTextNotation('(:a :b \r\n    :c :d|)');
        const b = docFromTextNotation('(:a :b \r\n    |)');
        await handlers.killLeft(a, false);
        expect(a).toEqual(b);

        const c = docFromTextNotation('(:a :b \r\n|)');
        await handlers.killLeft(a, false);
        // expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(c, defaultDocOmit));
        expect(a).toEqual(c);
        const aText = a.model.getText(0, a.model.maxOffset);
        expect(aText).toEqual('(:a :b \r\n)');

        const d = docFromTextNotation('(:a :b |)');
        await handlers.killLeft(a, false);
        expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(d, defaultDocOmit));
      });
    });
  });

  describe('editing', () => {
    describe('wrapping', () => {
      describe('rewrap', () => {
        it('Single-cursor: Rewraps () -> []', async () => {
          const a = docFromTextNotation('a (b c|) d');
          const b = docFromTextNotation('a [b c|] d');
          await handlers.rewrapSquare(a, false);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps () -> []', async () => {
          const a = docFromTextNotation('(a|2 (b c|) |1d)|3');
          const b = docFromTextNotation('[a|2 [b c|] |1d]|3');
          await handlers.rewrapSquare(a, true);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        it('Single-cursor: Rewraps [] -> ()', async () => {
          const a = docFromTextNotation('[a [b c|] d]');
          const b = docFromTextNotation('[a (b c|) d]');
          await handlers.rewrapParens(a, false);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps [] -> ()', async () => {
          const a = docFromTextNotation('[a|2 [b c|] |1d]|3');
          const b = docFromTextNotation('(a|2 (b c|) |1d)|3');
          await handlers.rewrapParens(a, true);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        it('Single-cursor: Rewraps [] -> {}', async () => {
          const a = docFromTextNotation('[a [b c|] d]');
          const b = docFromTextNotation('[a {b c|} d]');
          await handlers.rewrapCurly(a, false);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps [] -> {}', async () => {
          const a = docFromTextNotation('[a|2 [b c|] |1d]|3');
          const b = docFromTextNotation('{a|2 {b c|} |1d}|3');
          await handlers.rewrapCurly(a, true);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        it('Multi-cursor: Handles rewrapping nested forms [] -> {}', async () => {
          const a = docFromTextNotation('[:d :e [a|1 [b c|]]]');
          const b = docFromTextNotation('[:d :e {a|1 {b c|}}]');
          await handlers.rewrapCurly(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Handles rewrapping nested forms [] -> {} 2', async () => {
          const a = docFromTextNotation('[|1:d :e [a|2 [b c|]]]');
          const b = docFromTextNotation('{|1:d :e {a|2 {b c|}}}');
          await handlers.rewrapCurly(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Handles rewrapping nested forms mixed -> {}', async () => {
          const a = docFromTextNotation('[:d :e (a|1 {b c|})]');
          const b = docFromTextNotation('[:d :e {a|1 {b c|}}]');
          await handlers.rewrapCurly(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Handles rewrapping nested forms mixed -> {} 2', async () => {
          const a = docFromTextNotation('[|1:d :e (a|2 {b c|})]');
          const b = docFromTextNotation('{|1:d :e {a|2 {b c|}}}');
          await handlers.rewrapCurly(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        it('Single-cursor: Rewraps #{} -> {}', async () => {
          const a = docFromTextNotation('#{a #{b c|} d}');
          const b = docFromTextNotation('#{a {b c|} d}');
          await handlers.rewrapCurly(a, false);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps #{} -> {}', async () => {
          const a = docFromTextNotation('#{a|2 #{b c|} |1d}|3');
          const b = docFromTextNotation('{a|2 {b c|} |1d}|3');
          await handlers.rewrapCurly(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        it('Single-cursor: Rewraps #{} -> ""', async () => {
          const a = docFromTextNotation('#{a #{b c|} d}');
          const b = docFromTextNotation('#{a "b c|" d}');
          await handlers.rewrapQuote(a, false);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps #{} -> ""', async () => {
          const a = docFromTextNotation('#{a|2 #{b c|} |1d}|3');
          const b = docFromTextNotation('"a|2 "b c|" |1d"|3');
          await handlers.rewrapQuote(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps #{} -> "" 2', async () => {
          const a = docFromTextNotation('#{a|2 #{b c|} |1d}|3\n#{a|6 #{b c|4} |5d}|7');
          const b = docFromTextNotation('"a|2 "b c|" |1d"|3\n"a|6 "b c|4" |5d"|7');
          await handlers.rewrapQuote(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps #{} -> [] 3', async () => {
          const a = docFromTextNotation('#{a|2 #{b c|} |1d\n#{a|6 #{b c|4} |5d}}|3');
          const b = docFromTextNotation('[a|2 [b c|] |1d\n[a|6 [b c|4] |5d]]|3');
          await handlers.rewrapSquare(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        it('Single-cursor: Rewraps [] -> #{}', async () => {
          const a = docFromTextNotation('[[b c|] d]');
          const b = docFromTextNotation('[#{b c|} d]');
          await handlers.rewrapSet(a, false);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps [] -> #{}', async () => {
          const a = docFromTextNotation('[[b|2 c|] |1d]|3');
          const b = docFromTextNotation('#{#{b|2 c|} |1d}|3');
          await handlers.rewrapSet(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps [] -> #{} 2', async () => {
          const a = docFromTextNotation('[[b|2 c|] |1d]|3\n[a|6 [b c|4] |5d]|7');
          const b = docFromTextNotation('#{#{b|2 c|} |1d}|3\n#{a|6 #{b c|4} |5d}|7');
          await handlers.rewrapSet(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps [] -> #{} 3', async () => {
          const a = docFromTextNotation('[[b|2 c|] |1d\n[a|6 [b c|4] |5d]]|3');
          const b = docFromTextNotation('#{#{b|2 c|} |1d\n#{a|6 #{b c|4} |5d}}|3');
          await handlers.rewrapSet(a, true);
          expect(textNotationFromDoc(a)).toEqual(textNotationFromDoc(b));
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        // TODO: This tests current behavior. What should happen?
        it('Single-cursor: Rewraps ^{} -> #{}', async () => {
          const a = docFromTextNotation('^{^{b c|} d}');
          const b = docFromTextNotation('^{#{b c|} d}');
          await handlers.rewrapSet(a, false);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps ^{} -> #{}', async () => {
          const a = docFromTextNotation('^{^{b|2 c|} |1d}|3');
          const b = docFromTextNotation('#{#{b|2 c|} |1d}|3');
          await handlers.rewrapSet(a, true);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });

        // TODO: This tests current behavior. What should happen?
        it('Single-cursor: Rewraps ~{} -> #{}', async () => {
          const a = docFromTextNotation('~{~{b c|} d}');
          const b = docFromTextNotation('~{#{b c|} d}');
          await handlers.rewrapSet(a, false);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
        it('Multi-cursor: Rewraps ~{} -> #{}', async () => {
          const a = docFromTextNotation('~{~{b|2 c|} |1d}|3');
          const b = docFromTextNotation('#{#{b|2 c|} |1d}|3');
          await handlers.rewrapSet(a, true);
          expect(_.omit(a, defaultDocOmit)).toEqual(_.omit(b, defaultDocOmit));
        });
      });
    });
  });
});
