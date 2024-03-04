import * as expect from 'expect';
import _ = require('lodash');
import * as model from '../../../cursor-doc/model';
import * as paredit from '../../../cursor-doc/paredit';
import * as handlers from '../../../paredit/commands';
import { docFromTextNotation, textAndSelection, textAndSelections } from '../common/text-notation';

model.initScanner(20000);

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
        const a = docFromTextNotation('|2(c•(#b •[:f |1:b :z|])•#z•1|3)');
        const b = docFromTextNotation('|1(c•(#b •[:f :b :z]|)•#z•1)|2');
        handlers.forwardUpSexp(a, true);
        // docFromTextNotation creates a mock doc that won't dedupe selections
        // expect(_.uniqWith(a.selections, _.isEqual)).toEqual(b.selections);
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
        // expect(_.uniqWith(a.selections, _.isEqual)).toEqual(b.selections);
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
        // expect(_.uniqWith(a.selections, _.isEqual)).toEqual(b.selections);
        expect(a.selections).toEqual(b.selections);
      });
    });
  });
});
