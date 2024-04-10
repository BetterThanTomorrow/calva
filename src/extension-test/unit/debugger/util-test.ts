import * as expect from 'expect';
import { moveTokenCursorToBreakpoint } from '../../../debugger/util';
import * as model from '../../../cursor-doc/model';

function getCoordinates(text: string): (string | number)[] {
  return text
    .split('\n')[0]
    .split(',')
    .map((s) => {
      const coor = s.replace(/;/g, '').trim();
      if (coor.startsWith('"')) {
        return coor.replace(/"/g, '');
      } else {
        return parseInt(coor);
      }
    });
}

describe('Debugger Util', () => {
  describe('moveTokenCursorToBreakpoint', () => {
    let debugResponse: any;

    beforeEach(() => {
      debugResponse = {
        line: 0,
        column: 0,
      };
    });

    function expectBreakpointToBeFound(coorsAndBody: string) {
      debugResponse.coor = getCoordinates(coorsAndBody);
      const doc = new model.StringDocument();
      doc.insertString(coorsAndBody);
      const tokenCursor = doc.getTokenCursor(0);
      moveTokenCursorToBreakpoint(tokenCursor, debugResponse);
      expect(tokenCursor.getPrevToken().raw.endsWith('|')).toBe(true);
    }

    it('simple example', () => {
      expectBreakpointToBeFound(`;; 3, 2
      (defn simple [x]
        (+ 1 #break x|))`);
    });

    it('function shorthand', () => {
      expectBreakpointToBeFound(`;; 3, 1, 2, 2
      (defn fn-shorthand
        [s x]
        (filter #(= % #break x|) s))`);
    });

    describe('maps', () => {
      it('map', () => {
        expectBreakpointToBeFound(`;; 3, "[1 (+ 1 2)]", 2
        (defn test-map
          [x]
          {:hello "world" [1 (+ 1 2)] (+ 5 #break x|)})`);
      });

      it('metadata map', () => {
        expectBreakpointToBeFound(`;; 3, 2, 2, 2
        (defn test-metadata-symbol
          [x]
          (let [y x]
            ^{:hello "world"}
            (+ x ^{:inner "meta"} (+ 1 #break y|))))`);
      });

      it('metadata map last sexp', () => {
        expectBreakpointToBeFound(`;; 3, 2, 2, 2
        #dbg
         (defn test-metadata-symbol
           [x]
           (let [y x]
             ^{:hello "world"}
             (+ x ^{:inner "meta"} (+ 1 y|))))`);
      });
    });

    it('metadata symbol', () => {
      expectBreakpointToBeFound(`;; 3, 2, 2
      (defn test-metadata-symbol
        [x]
        (let [y x]
          (+ ^String x #break ^String y|)))`);
    });

    it('ignored forms', () => {
      expectBreakpointToBeFound(`;; 3, 1, 1
      (defn test-ignore
        [x]
        (let [y #_#_#_2 3 4 #break x|]
          (+ x y)))`);
    });

    it('syntax quote', () => {
      expectBreakpointToBeFound(`;; 3, 2, 1, 2, 1, 2
      (defn test-syntax-quote
        [y]
        \`{:hello ~(+ 1 #break y|)})`);
    });

    describe('derefs', () => {
      it('atom', () => {
        expectBreakpointToBeFound(`;; 3, 1
        #dbg
        (defn boom
          []
          @!a|)`);
      });

      it('atom then something', () => {
        expectBreakpointToBeFound(`;; 4, 2, 1
          #dbg
          (defn boom
            []
            @!a
            (let [x 1]
              (inc x|)))`);
      });

      // TODO: Figure out why this test fails.
      // It works interactively.
      // And the coor given to us from cider-nrepl is really [3, 1]
      xit('deref call', () => {
        expectBreakpointToBeFound(`;; 3, 1
        #dbg
        (defn boom
          []
          @(f)|)`);
      });
    });
  });
});
