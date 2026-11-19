import * as expectLib from 'expect';
import * as model from '../../../../src/cursor-doc/model';
import {
  codeWithBreakpoints,
  type SourceBreakpointData,
} from '../../../../src/debugger/breakpoint-targets';

model.initScanner(20000);

function sent(
  documentText: string,
  breakpoints: SourceBreakpointData[],
  { codeStart = 0, code = documentText, canDebug = true } = {}
): string {
  return codeWithBreakpoints({ documentText, codeStart, code, breakpoints, canDebug });
}

function at(line: number, character = 0, more: Partial<SourceBreakpointData> = {}) {
  return { line, character, ...more };
}

describe('breakpoint targets', () => {
  describe('line breakpoints', () => {
    it('puts #break before the form on the line', () => {
      expectLib
        .expect(sent('(defn f [x]\n  (inc x))', [at(1)]))
        .toBe('(defn f [x]\n  #break (inc x))');
    });

    it('puts #break before the last list opening on the line', () => {
      expectLib
        .expect(sent('(defn g [x]\n  (let [y (inc x)]\n    (* y 2)))', [at(1)]))
        .toBe('(defn g [x]\n  (let [y #break (inc x)]\n    (* y 2)))');
    });

    it('puts #break before a symbol when the line has no list', () => {
      expectLib.expect(sent('(let [y 1]\n  y)', [at(1)])).toBe('(let [y 1]\n  #break y)');
    });

    it('leaves out binding names', () => {
      const text = '(let [x\n      (inc 1)\n      y\n      2]\n  x)';
      expectLib.expect(sent(text, [at(2)])).toBe(text);
      expectLib
        .expect(sent(text, [at(1)]))
        .toBe('(let [x\n      #break (inc 1)\n      y\n      2]\n  x)');
    });
  });

  describe('function definitions', () => {
    it('points the first line of a defn at the first body form', () => {
      expectLib
        .expect(sent('(defn f [x]\n  (inc x))', [at(0)]))
        .toBe('(defn f [x]\n  #break (inc x))');
    });

    it('points the first line of a defn- with a docstring and attribute map at the first body form', () => {
      const text = '(defn- f\n  "Increments."\n  {:added "1"}\n  [x]\n  (inc x))';
      const expected = '(defn- f\n  "Increments."\n  {:added "1"}\n  [x]\n  #break (inc x))';
      expectLib.expect(sent(text, [at(0)])).toBe(expected);
      expectLib.expect(sent(text, [at(3)])).toBe(expected);
    });

    it('points the first line of a fn at its first body form', () => {
      expectLib
        .expect(sent('(map (fn [x]\n       (inc x))\n     xs)', [at(0)]))
        .toBe('(map (fn [x]\n       #break (inc x))\n     xs)');
    });

    it('points an arity at its first body form, and the defn at its first arity', () => {
      const text = '(defn f\n  ([x] (f x 1))\n  ([x y] (+ x y)))';
      expectLib
        .expect(sent(text, [at(0)]))
        .toBe('(defn f\n  ([x] #break (f x 1))\n  ([x y] (+ x y)))');
      expectLib
        .expect(sent(text, [at(2)]))
        .toBe('(defn f\n  ([x] (f x 1))\n  ([x y] #break (+ x y)))');
    });

    it('points a letfn function at its first body form', () => {
      expectLib
        .expect(sent('(letfn [(g [y]\n          (* y 2))]\n  (g 1))', [at(0)]))
        .toBe('(letfn [(g [y]\n          #break (* y 2))]\n  (g 1))');
    });
  });

  describe('inline breakpoints', () => {
    const text = '(defn f [x]\n  (+ (inc x) 2))';

    it('puts #break before the form whose opening bracket the breakpoint is on', () => {
      expectLib.expect(sent(text, [at(1, 5)])).toBe('(defn f [x]\n  (+ #break (inc x) 2))');
    });

    it('puts #break before the enclosing list', () => {
      expectLib.expect(sent(text, [at(1, 9)])).toBe('(defn f [x]\n  (+ #break (inc x) 2))');
      expectLib.expect(sent(text, [at(1, 3)])).toBe('(defn f [x]\n  #break (+ (inc x) 2))');
    });
  });

  describe('conditions', () => {
    it('puts the condition in the #break metadata', () => {
      expectLib
        .expect(sent('(defn f [x]\n  (inc x))', [at(1, 0, { condition: '(= x 3)' })]))
        .toBe('(defn f [x]\n  #break ^{:break/when (= x 3)} (inc x))');
    });

    it('treats a blank condition as none', () => {
      expectLib
        .expect(sent('(defn f [x]\n  (inc x))', [at(1, 0, { condition: '  ' })]))
        .toBe('(defn f [x]\n  #break (inc x))');
    });

    it('puts nothing before a keyword, which cannot carry metadata', () => {
      const text = '(defn f [x]\n  (case x\n    :a\n    1))';
      expectLib.expect(sent(text, [at(2, 0, { condition: '(= x 1)' })])).toBe(text);
    });
  });

  describe('which breakpoints count', () => {
    const text = '(defn f [x]\n  (inc x))';

    it('skips logpoints and disabled breakpoints', () => {
      expectLib.expect(sent(text, [at(1, 0, { logMessage: 'x is {x}' })])).toBe(text);
      expectLib.expect(sent(text, [at(1, 0, { enabled: false })])).toBe(text);
    });

    it('ignores hit counts', () => {
      expectLib
        .expect(sent(text, [at(1, 0, { hitCondition: '3' })]))
        .toBe('(defn f [x]\n  #break (inc x))');
    });

    it('inserts one #break for breakpoints with the same target', () => {
      expectLib.expect(sent(text, [at(0), at(1)])).toBe('(defn f [x]\n  #break (inc x))');
    });
  });

  describe('lines without a target', () => {
    it('puts nothing on a line with only closing brackets', () => {
      const text = '(defn f [x]\n  (let [y (inc x)]\n    (* y 2)\n    ))';
      expectLib.expect(sent(text, [at(3)])).toBe(text);
    });

    it("puts nothing in a docstring's continuation line", () => {
      const text = '(defn f\n  "Does (things)\n  with (more) things"\n  [x]\n  (inc x))';
      expectLib.expect(sent(text, [at(2)])).toBe(text);
      expectLib.expect(sent(text, [at(2, 8)])).toBe(text);
    });

    it('puts nothing in a comment', () => {
      const text = '(defn f [x]\n  ;; (inc x)\n  (dec x))';
      expectLib.expect(sent(text, [at(1)])).toBe(text);
      expectLib.expect(sent(text, [at(1, 6)])).toBe(text);
    });

    it('puts nothing in a quoted form', () => {
      const text = "'(a\n  b)";
      expectLib.expect(sent(text, [at(1)])).toBe(text);
    });
  });

  describe('the code sent', () => {
    it('counts from where the code starts after a #_ marker', () => {
      const text = '#_(defn f [x]\n  (inc x))';
      expectLib
        .expect(sent(text, [at(1)], { codeStart: 2, code: text.slice(2) }))
        .toBe('(defn f [x]\n  #break (inc x))');
      const spaced = '#_ (defn f [x]\n  (inc x))';
      expectLib
        .expect(sent(spaced, [at(1)], { codeStart: 3, code: spaced.slice(3) }))
        .toBe('(defn f [x]\n  #break (inc x))');
    });

    it('leaves out breakpoints whose targets are outside the code', () => {
      const text = '(defn f [x]\n  (inc x))\n\n(defn g [x]\n  (dec x))';
      const code = '(defn g [x]\n  (dec x))';
      expectLib
        .expect(sent(text, [at(1), at(4)], { codeStart: text.indexOf(code), code }))
        .toBe('(defn g [x]\n  #break (dec x))');
    });

    it('leaves out targets that the code has only a part of', () => {
      const text = '(defn f [x]\n  (let [y (inc x)]\n    y))';
      const code = '(defn f [x]\n  (let [y (inc x)]))';
      expectLib.expect(sent(text, [at(0)], { code })).toBe(code);
    });

    it('sends the code as it is without breakpoints', () => {
      const text = '(defn f [x]\n  (inc x))';
      expectLib.expect(sent(text, [])).toBe(text);
    });

    it('sends the code as it is when the session cannot debug', () => {
      const text = '(defn f [x]\n  (inc x))';
      expectLib.expect(sent(text, [at(1)], { canDebug: false })).toBe(text);
    });
  });

  describe('forms the debugger never stops at', () => {
    it('puts nothing before a recur', () => {
      const text = '(loop [i 0]\n  (when (< i 3)\n    (recur (inc i))))';
      expectLib
        .expect(sent(text, [at(2, 6)]))
        .toBe('(loop [i 0]\n  #break (when (< i 3)\n    (recur (inc i))))');
      expectLib
        .expect(sent(text, [at(2)]))
        .toBe('(loop [i 0]\n  (when (< i 3)\n    (recur #break (inc i))))');
    });

    it('points a defn past its condition map to the next body form', () => {
      const text = '(defn f [x]\n  {:pre [(pos? x)]}\n  (inc x))';
      expectLib
        .expect(sent(text, [at(0)]))
        .toBe('(defn f [x]\n  {:pre [(pos? x)]}\n  #break (inc x))');
    });

    it('takes a map as the body when nothing follows it', () => {
      expectLib
        .expect(sent('(defn f [x]\n  {:x x})', [at(0)]))
        .toBe('(defn f [x]\n  #break {:x x})');
    });
  });

  describe('ignored forms', () => {
    it('counts two #_ markers as ignoring the next two forms', () => {
      const text = '(let [#_#_ [a] (g)\n      y (f)]\n  y)';
      expectLib.expect(sent(text, [at(1)])).toBe('(let [#_#_ [a] (g)\n      y #break (f)]\n  y)');
    });

    it('puts nothing in a form that a #_ in the code ignores', () => {
      const text = '(do #_(foo\n       (bar))\n  (baz))';
      expectLib.expect(sent(text, [at(1)])).toBe(text);
    });

    it('puts #break in a reader conditional branch', () => {
      const text = '(defn f [x]\n  #?(:clj (inc x)\n     :cljs (dec x)))';
      expectLib
        .expect(sent(text, [at(1)]))
        .toBe('(defn f [x]\n  #?(:clj #break (inc x)\n     :cljs (dec x)))');
    });
  });
});
