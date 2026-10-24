import * as expectLib from 'expect';
import * as model from '../../../cursor-doc/model';
import * as rainbowBrackets from '../../../highlight/src/rainbow-brackets';
import * as textNotation from '../common/text-notation';

const options: rainbowBrackets.RainbowOptions = {
  colorCount: 3,
  cycleBracketColors: true,
  guides: false,
};

function rainbowOf(text: string, opts: Partial<rainbowBrackets.RainbowOptions> = {}) {
  const doc = new model.StringDocument(text);
  return rainbowBrackets.rainbowBrackets(doc.model, [[0, text.length]], { ...options, ...opts });
}

describe('Rainbow brackets', () => {
  describe('brackets', () => {
    it('colors nested forms by depth', () => {
      expectLib.expect(rainbowOf('(a [b {c}])').brackets).toEqual([
        { range: [0, 1], colorIndex: 0 },
        { range: [3, 4], colorIndex: 1 },
        { range: [6, 7], colorIndex: 2 },
        { range: [8, 9], colorIndex: 2 },
        { range: [9, 10], colorIndex: 1 },
        { range: [10, 11], colorIndex: 0 },
      ]);
    });
    it('cycles the colors when the forms nest deeper than there are colors', () => {
      expectLib
        .expect(rainbowOf('(((a)))', { colorCount: 2 }).brackets.map((b) => b.colorIndex))
        .toEqual([0, 1, 0, 0, 1, 0]);
    });
    it('keeps the last color for deeper forms when not cycling', () => {
      expectLib
        .expect(
          rainbowOf('(((a)))', { colorCount: 2, cycleBracketColors: false }).brackets.map(
            (b) => b.colorIndex
          )
        )
        .toEqual([0, 1, 1, 1, 1, 0]);
    });
    it('colors reader brackets as one bracket', () => {
      expectLib.expect(rainbowOf('#{1 #(inc %)}').brackets).toEqual([
        { range: [0, 2], colorIndex: 0 },
        { range: [4, 6], colorIndex: 1 },
        { range: [11, 12], colorIndex: 1 },
        { range: [12, 13], colorIndex: 0 },
      ]);
    });
    it('skips brackets in strings', () => {
      expectLib.expect(rainbowOf('("a)b")').brackets).toEqual([
        { range: [0, 1], colorIndex: 0 },
        { range: [6, 7], colorIndex: 0 },
      ]);
    });
  });

  describe('misplaced brackets', () => {
    it('finds a closing bracket that does not match', () => {
      const rainbow = rainbowOf('(a] b)');
      expectLib.expect(rainbow.misplaced).toEqual([[2, 3]]);
      expectLib.expect(rainbow.brackets).toEqual([
        { range: [0, 1], colorIndex: 0 },
        { range: [5, 6], colorIndex: 0 },
      ]);
    });
    it('finds a closing bracket without an opening bracket', () => {
      expectLib.expect(rainbowOf('(a) b)').misplaced).toEqual([[5, 6]]);
    });
  });

  describe('ignored forms', () => {
    it('separates top level ignored forms from ignored forms inside forms', () => {
      const rainbow = rainbowOf('#_(a) b (c #_d)');
      expectLib.expect(rainbow.topLevelIgnoredForms).toEqual([[0, 5]]);
      expectLib.expect(rainbow.ignoredForms).toEqual([[11, 14]]);
    });
  });

  describe('comment forms', () => {
    it('finds comment forms, at the top level and inside forms', () => {
      expectLib.expect(rainbowOf('(comment (a)) (b (comment c))').commentForms).toEqual([
        [0, 13],
        [17, 28],
      ]);
    });
    it('finds custom comment forms', () => {
      expectLib
        .expect(
          rainbowOf('(rich 1) (comment 2)', {
            commentFormConfig: { customCommentForms: ['rich'], aliasMap: {} },
          }).commentForms
        )
        .toEqual([
          [0, 8],
          [9, 20],
        ]);
    });
  });

  describe('guides', () => {
    const text = '(a\n (b\n  c)\n d)';
    it('places a guide on each line of a form indented at least to its opening bracket', () => {
      expectLib.expect(rainbowOf(text, { guides: true }).guides).toEqual([
        { range: [8, 8], colorIndex: 1 },
        { range: [3, 3], colorIndex: 0 },
        { range: [7, 7], colorIndex: 0 },
        { range: [12, 12], colorIndex: 0 },
      ]);
    });
    it('places no guides when not asked to', () => {
      expectLib.expect(rainbowOf(text).guides).toEqual([]);
    });
    it('finds the active guide of the innermost form with a guide around the cursor', () => {
      const doc = new model.StringDocument(text);
      const rainbow = rainbowBrackets.rainbowBrackets(doc.model, [[0, text.length]], {
        ...options,
        guides: true,
      });
      expectLib
        .expect(rainbowBrackets.activeGuides(doc.model, rainbow, [[9, 9]]))
        .toEqual([{ range: [8, 8], colorIndex: 1 }]);
    });
  });

  describe('matching bracket', () => {
    function matchedAt(notation: string) {
      const doc = textNotation.docFromTextNotation(notation);
      const rainbow = rainbowBrackets.rainbowBrackets(
        doc.model,
        [[0, doc.model.maxOffset]],
        options
      );
      return rainbowBrackets.matchedBrackets(
        rainbow,
        doc.selections.map((s): model.ModelEditDirectedRange => [s.anchor, s.active])
      );
    }
    it('matches the opening bracket of the bracket before the cursor', () => {
      expectLib.expect(matchedAt('(a [b])|')).toEqual([
        [0, 1],
        [6, 7],
      ]);
    });
    it('matches the closing bracket of a reader bracket after the cursor', () => {
      expectLib.expect(matchedAt('|#{a}')).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
    it('matches both brackets around the cursor', () => {
      expectLib.expect(matchedAt('(a)|(b)')).toEqual([
        [0, 1],
        [2, 3],
        [3, 4],
        [5, 6],
      ]);
    });
    it('matches nothing away from brackets', () => {
      expectLib.expect(matchedAt('(a |b)')).toEqual([]);
    });
  });
});
