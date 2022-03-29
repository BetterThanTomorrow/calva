import * as expect from 'expect';
import * as model from '../../../cursor-doc/model';
import * as indent from '../../../cursor-doc/indent';
import { docFromTextNotation, textAndSelection, text } from '../common/text-notation';
import { ModelEditSelection } from '../../../cursor-doc/model';

model.initScanner(20000);

describe('indent', () => {
  describe('getIndent', () => {
    describe('lists', () => {
      it('calculates indents for cursor in empty list', () => {
        const doc = docFromTextNotation('(|)');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(1);
      });
      it('calculates indents for cursor in empty list prepended by text', () => {
        const doc = docFromTextNotation('  a b (|)');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(7);
      });
      it('calculates indents for empty list inside vector', () => {
        const doc = docFromTextNotation('[(|)]');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(2);
      });
      it("calculates indents for cursor in at arg 0 in `[['inner' 0]]`", () => {
        const doc = docFromTextNotation('(foo|)');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"^\\w"': [['inner', 0]],
            })
          )
        ).toEqual(2);
      });
      it("calculates indents for arg 1 in `[['inner' 0]]`", () => {
        const doc = docFromTextNotation('(foo x|)');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"^\\w"': [['inner', 0]],
            })
          )
        ).toEqual(2);
      });
      it("calculates indents for cursor at arg 0 in `[['block' 1]]`", () => {
        const doc = docFromTextNotation('(foo|)');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"^\\w"': [['block', 1]],
            })
          )
        ).toEqual(1);
      });
      it("calculates indents for cursor at arg 1 in `[['block' 1]]`", () => {
        const doc = docFromTextNotation('(foo x|)');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"^\\w"': [['block', 1]],
            })
          )
        ).toEqual(2);
      });
    });

    describe('vectors', () => {
      it('calculates indents for cursor in empty vector', () => {
        const doc = docFromTextNotation('[|]');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(1);
      });
      it('calculates indents for cursor in empty vector inside list', () => {
        const doc = docFromTextNotation('([|])');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(2);
      });
      it('does not use indent rules for vectors with symbols at ”call” position', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1622
        const doc = docFromTextNotation('[foo|]');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"^\\w"': [['inner', 0]],
            })
          )
        ).toEqual(1);
      });
    });

    describe('maps', () => {
      it('calculates indents for cursor in empty map', () => {
        const doc = docFromTextNotation('{|}');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(1);
      });
      it('calculates indents for cursor in empty map inside list inside a vector', () => {
        const doc = docFromTextNotation('([{|}])');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(3);
      });
      it('does not use indent rules for maps with symbols at ”call” position', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1622
        const doc = docFromTextNotation('{foo|}');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"^\\w"': [['inner', 0]],
            })
          )
        ).toEqual(1);
      });
    });

    describe('sets', () => {
      it('calculates indents for cursor in empty set', () => {
        const doc = docFromTextNotation('#{|}');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(2);
      });
      it('calculates indents for cursor in empty set inside list inside a vector', () => {
        const doc = docFromTextNotation('([#{|}])');
        expect(indent.getIndent(doc.model, textAndSelection(doc)[1][0])).toEqual(4);
      });
      it('does not use indent rules for maps with symbols at ”call” position', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1622
        const doc = docFromTextNotation('#{foo|}');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"^\\w"': [['inner', 0]],
            })
          )
        ).toEqual(2);
      });
    });
  });

  describe('collectIndents', () => {
    describe('lists', () => {
      it('collects indents for cursor in empty list', () => {
        const doc = docFromTextNotation('(|)');
        const rules: indent.IndentRules = {
          '#"^\\w"': [['inner', 0]],
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual([]);
      });
      it('collects indents for cursor in empty list with structure around', () => {
        const doc = docFromTextNotation('[](|)(foo)');
        const rules: indent.IndentRules = {
          '#"^\\w"': [['inner', 0]],
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual([]);
      });
      it('collects indents for cursor in nested structure', () => {
        const doc = docFromTextNotation('[]•(aa []•(bb•(cc :dd|)))•[]');
        const rule1: indent.IndentRule[] = [['inner', 0], ['block', 1]];
        const rules: indent.IndentRules = {
          '#"^\\w"': rule1,
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual(rule1);
      });
      it('collects indents for empty list inside vector', () => {
        const doc = docFromTextNotation('[(|)]');
        const rules: indent.IndentRules = {
          '#"^\\w"': [['inner', 0]],
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual([]);
      });
      it('collects indents for arg 0', () => {
        const doc = docFromTextNotation('(foo|)');
        const rule1: indent.IndentRule[] = [['inner', 0]];
        const rules: indent.IndentRules = {
          '#"^\\w"': rule1,
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual(rule1);
      });
    });

    describe('vectors', () => {
      it('ignores rule arg 0', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1622
        const doc = docFromTextNotation('[foo|]');
        const rule1: indent.IndentRule[] = [['inner', 0]];
        const rules: indent.IndentRules = {
          '#"^\\w"': rule1,
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual([]);
      });
    });

    describe('maps', () => {
      it('ignores rule arg 0', () => {
        // https://github.com/BetterThanTomorrow/calva/issues/1622
        const doc = docFromTextNotation('{foo|}');
        const rule1: indent.IndentRule[] = [['inner', 0]];
        const rules: indent.IndentRules = {
          '#"^\\w"': rule1,
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual([]);
      });
    });
  });
});

function mkConfig(rules: indent.IndentRules) {
  return {
    'cljfmt-options': {
      indents: rules,
    },
  };
}
