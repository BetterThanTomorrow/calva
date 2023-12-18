import * as expect from 'expect';
import * as model from '../../../cursor-doc/model';
import * as indent from '../../../cursor-doc/indent';
import { docFromTextNotation, textAndSelection } from '../common/text-notation';

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
      it('calculates indents for `foo` given different rules for `fo` and `foo`', () => {
        const doc = docFromTextNotation('(foo [] |x)');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              fo: [['block', 0]],
              foo: [['block', 1]],
            })
          )
        ).toEqual(2);
      });
      it('custom config does not override indents for default `defn`', () => {
        const doc = docFromTextNotation('(defn foo [] |x)');
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              foo: [['block', 0]],
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

    describe('deftype', () => {
      it('calculates indents for cursor on the new line of a method implementation', () => {
        const doc = docFromTextNotation(`
(deftype MyType [arg1 arg2]
  IMyProto
  (method1 [this]
|(print "hello")))`);

        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              deftype: [
                ['block', 2],
                ['inner', 1],
              ],
              '#"^def(?!ault)(?!late)(?!er)"': [['inner', 0]],
            })
          )
        ).toEqual(4);
      });
    });
    describe('and', () => {
      it('calculates indents for cursor on the new line before the second argument with clojure regex config', () => {
        const doc = docFromTextNotation(`
(and x
|y)`);
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '#"\\S+"': [['inner', 0]],
            })
          )
        ).toEqual(2);
      });
      it('calculates indents for cursor on the new line before the second argument with js regex config', () => {
        const doc = docFromTextNotation(`
(and x
|y)`);
        expect(
          indent.getIndent(
            doc.model,
            textAndSelection(doc)[1][0],
            mkConfig({
              '/\\S+/': [['inner', 0]],
            })
          )
        ).toEqual(2);
      });
    });
    describe('cljfmt defaults', () => {
      const doc = docFromTextNotation('(let []\n|x)');
      const defndoc = docFromTextNotation('(defn []\n|x)');
      const p = textAndSelection(doc)[1][0];
      const emptyConfig = mkConfig({});
      it('with empty config, uses the built-in rule for the `let` body', () => {
        expect(indent.getIndent(doc.model, p, emptyConfig)).toEqual(2);
      });
      const someConfig = mkConfig({
        '/foo+/': [['inner', 0]],
      });
      it('with some config, still uses the built-in rule for the `let` body', () => {
        expect(indent.getIndent(doc.model, p, someConfig)).toEqual(2);
      });
      const blockConfig = mkConfig({
        '/\\S+/': [['block', 0]],
      });
      it('catch-all does not override the built-in rule for the `let` body', () => {
        expect(indent.getIndent(doc.model, p, blockConfig)).toEqual(2);
      });
      const letBlockConfig = mkConfig({
        let: [['block', 0]],
      });
      it('symbol let overrides the built-in rule for the `let` body', () => {
        expect(indent.getIndent(doc.model, p, letBlockConfig)).toEqual(5);
      });
      it('does not overrides the built-in rule for the `defn` body', () => {
        expect(indent.getIndent(defndoc.model, p, letBlockConfig)).toEqual(2);
      });
    });
    describe('replacing cljfmt defaults', () => {
      // TODO: We probably need more test cases here
      const doc = docFromTextNotation('(let []\n|x)');
      const defndoc = docFromTextNotation('(defn []\n|x)');
      const p = textAndSelection(doc)[1][0];
      const emptyConfig = mkConfig({}, {});
      it('with empty replace config, does not use the built-in rule for the `let` body', () => {
        expect(indent.getIndent(doc.model, p, emptyConfig)).toEqual(5);
      });
      const someConfig = mkConfig(
        {
          '/foo+/': [['inner', 0]],
        },
        {}
      );
      it('with some config, still uses the built-in the built-in rule for the `let` body', () => {
        expect(indent.getIndent(doc.model, p, someConfig)).toEqual(5);
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
        const rule1: indent.IndentRule[] = [
          ['inner', 0],
          ['block', 1],
        ];
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
      it('collects indents for `foo` given different rules for `fo` and `foo`', () => {
        const doc = docFromTextNotation('(foo|)');
        const rule1: indent.IndentRule[] = [['inner', 0]];
        const rule2: indent.IndentRule[] = [['block', 0]];
        const rules: indent.IndentRules = {
          fo: rule1,
          foo: rule2,
        };
        const state: indent.IndentInformation[] = indent.collectIndents(
          doc.model,
          textAndSelection(doc)[1][0],
          mkConfig(rules)
        );
        expect(state.length).toEqual(1);
        expect(state[0].rules).toEqual(rule2);
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

function mkConfig(extraRules: indent.IndentRules, replaceRules?: indent.IndentRules) {
  return {
    'cljfmt-options': {
      'extra-indents': extraRules,
      ...(replaceRules ? { indents: replaceRules } : {}),
    },
  };
}
