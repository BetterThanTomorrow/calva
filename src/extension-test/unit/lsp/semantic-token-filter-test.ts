import * as expect from 'expect';
import { filterCommentTokens } from '../../../lsp/client/semantic-token-filter';

describe('Semantic token filtering', () => {
  it('Handles empty token array', () => {
    expect(filterCommentTokens(new Uint32Array([]), 10)).toEqual([]);
  });

  it('Empties token array with only comments', () => {
    // Document:
    //   #[
    //   ]
    expect(
      filterCommentTokens(
        new Uint32Array([
          0,
          0,
          5,
          10,
          0, // the two-line comment, line 0, col 0, len 5, type comment
        ]),
        10
      )
    ).toEqual([]);
  });

  it('Leaves a token array with no comments alone', () => {
    // Document:
    //   (def x 1)
    //
    //   (f x)
    const tokens = [
      0,
      1,
      3,
      3,
      0, // [def], line 0, col 1, len 3, type macro
      0,
      4,
      1,
      2,
      1, // [x], line 0, col 4, len 1, type function
      2,
      3,
      1,
      2,
      0, // [x], line +2, col 3, len 1, type function
    ];
    expect(filterCommentTokens(new Uint32Array(tokens), 10)).toEqual(tokens);
  });

  it('Removes comment token between two non-comments', () => {
    // Document:
    //   (ns clojure-lsp.foo)
    //   #_
    //   f
    //   (defn)
    expect(
      filterCommentTokens(
        new Uint32Array([
          0,
          4,
          15,
          0,
          0, // [clojure-lsp.foo] line 0, col 4, len 15, type namespace
          1,
          0,
          4,
          10,
          0, // [#_ f] line +1, col 0, len 4, type comment
          2,
          1,
          4,
          3,
          0, // [defn] line +2, col 1, len 4, type macro
        ]),
        10
      )
    ).toEqual([
      0,
      4,
      15,
      0,
      0, // [ns] preserved position
      3,
      1,
      4,
      3,
      0, // [defn] line +3 (accumulated), col 1
    ]);
  });

  it('maintains token positioning with multiple comments', () => {
    // Document:
    //   (ns foo)
    //   #_ form1
    //   ; comment
    //   #_ form2
    //   (defn)
    expect(
      filterCommentTokens(
        new Uint32Array([
          0,
          0,
          7,
          0,
          0, // [ns] line 0, col 0, len 7, type namespace
          1,
          0,
          7,
          10,
          0, // [#_ form1] line +1, col 0, type comment
          1,
          0,
          7,
          10,
          0, // [#_ form2] line +1, col 0, type comment
          2,
          0,
          5,
          3,
          0, // [defn] line +1, col 0, type macro
        ]),
        10
      )
    ).toEqual([
      0,
      0,
      7,
      0,
      0, // [ns] preserved position
      4,
      0,
      5,
      3,
      0, // [defn] line +4 (accumulated), col 0
    ]);
  });

  it('handles complex nested reader conditionals and consecutive comments', () => {
    // Document:
    //   (ns clojure-lsp.foo
    //     (:require
    //       [sample-test.rename.b :as b]))
    //   #_
    //   f
    //   #_(defn foo [x y]
    //     (str x y))
    //   #_[
    //
    //   ]
    //
    //   (def f (fn [a b]
    //            {:a a
    //             :b b}))
    //
    //   #_ #_ [
    //          :a
    //   ]
    //   {:b 1}
    //
    //   q
    //
    //   {:a 1 #_:b #_[2
    //                 3
    //                 4
    //                 5] #_#_:c 3 :d 4 :e 5 :f 6 :g 7}
    //
    //   (defn bar [foo]
    //     (println foo))
    expect(
      filterCommentTokens(
        new Uint32Array([
          0,
          4,
          15,
          0,
          0, // [ns] line 0, col 4, len 15, type namespace
          1,
          4,
          7,
          4,
          0, // [require] line +1, col 4, len 7, type keyword
          1,
          27,
          2,
          4,
          0, // [b] line +1, col 27, len 2, type keyword
          1,
          0,
          4,
          10,
          0, // [#_ f] line +1, col 0, len 4, type comment
          2,
          0,
          30,
          10,
          0, // [#_(defn...)] line +2, col 0, len 30, type comment
          2,
          0,
          6,
          10,
          0, // [#_[] line +2, col 0, len 6, type comment
          4,
          1,
          3,
          3,
          0, // [def] line +4, col 1, len 3, type macro
          0,
          4,
          1,
          2,
          1, // [f] line +0, col 4, len 1, type function
          3,
          2,
          3,
          0,
          0, // [fn] line +3, col 2, len 3, type function
          0,
          4,
          1,
          2,
          1, // [a] line +0, col 4, len 1, type function
          3,
          2,
          3,
          0,
          0, // [b] line +3, col 2, len 3, type function
          2,
          0,
          26,
          10,
          0, // [#_ #_ [...]] line +2, col 0, len 26, type comment
          7,
          2,
          1,
          4,
          0, // [q] line +7, col 2, len 1, type keyword
          0,
          4,
          4,
          10,
          0, // [#_:b] line +0, col 4, len 4, type comment
          0,
          5,
          53,
          10,
          0, // [#_[2...5]] line +0, col 5, len 53, type comment
          3,
          17,
          8,
          10,
          0, // [#_#_:c 3] line +3, col 17, len 8, type comment
          0,
          10,
          1,
          4,
          0, // [:d] line +0, col 10, len 1, type keyword
          5,
          1,
          4,
          0,
          0, // [:e] line +5, col 1, len 4, type keyword
          5,
          1,
          4,
          0,
          0, // [:f] line +5, col 1, len 4, type keyword
          5,
          1,
          4,
          0,
          0, // [:g] line +5, col 1, len 4, type keyword
          2,
          1,
          4,
          3,
          0, // [defn] line +2, col 1, len 4, type macro
          0,
          5,
          3,
          2,
          1, // [bar] line +0, col 5, len 3, type function
          5,
          3,
          6,
          0,
          1, // [foo] line +5, col 3, len 6, type variable
          3,
          7,
          2,
          0,
          0, // [println] line +3, col 7, len 2, type function
          0,
          8,
          3,
          6,
          0, // [foo] line +0, col 8, len 3, type variable
        ]),
        10
      )
    ).toEqual([
      0,
      4,
      15,
      0,
      0, // [ns] preserved
      1,
      4,
      7,
      4,
      0, // [require] preserved
      1,
      27,
      2,
      4,
      0, // [b] preserved
      9,
      1,
      3,
      3,
      0, // [def] accumulated delta (1+2+2+4)
      0,
      4,
      1,
      2,
      1, // [f] preserved relative
      3,
      2,
      3,
      0,
      0, // [fn] preserved relative
      0,
      4,
      1,
      2,
      1, // [a] preserved relative
      3,
      2,
      3,
      0,
      0, // [b] preserved relative
      9,
      2,
      1,
      4,
      0, // [q] accumulated delta from removed comment block
      3,
      10,
      1,
      4,
      0, // [:d] delta from q (not accumulated from removed comments)
      5,
      1,
      4,
      0,
      0, // [:e] preserved relative
      5,
      1,
      4,
      0,
      0, // [:f] preserved relative
      5,
      1,
      4,
      0,
      0, // [:g] preserved relative
      2,
      1,
      4,
      3,
      0, // [defn] preserved relative
      0,
      5,
      3,
      2,
      1, // [bar] preserved relative
      5,
      3,
      6,
      0,
      1, // [foo] preserved relative
      3,
      7,
      2,
      0,
      0, // [println] preserved relative
      0,
      8,
      3,
      6,
      0, // [foo] preserved relative
    ]);
  });
});
