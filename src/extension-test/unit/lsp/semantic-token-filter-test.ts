import * as expect from 'expect';
import { filterCommentTokens } from '../../../lsp/client/semantic-token-filter';

describe('Semantic token filtering', () => {
  it('handles a simple document with namespace and defn', () => {
    // Document:
    //   (ns clojure-lsp.foo)
    //   #_
    //   f
    //   (defn)
    const tokens = new Uint32Array([
      0,
      4,
      15,
      0,
      0, // [ns] line 0, col 4, len 15, type namespace
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
    ]);

    const filtered = filterCommentTokens(tokens);

    expect(filtered).toEqual([
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
    const tokens = new Uint32Array([
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
      8,
      10,
      0, // [; comment] line +1, col 0, type comment
      1,
      0,
      7,
      10,
      0, // [#_ form2] line +1, col 0, type comment
      1,
      0,
      5,
      3,
      0, // [defn] line +1, col 0, type macro
    ]);

    const filtered = filterCommentTokens(tokens);

    expect(filtered).toEqual([
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
});
