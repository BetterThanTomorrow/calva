import * as expect from 'expect';
import { formatIndex } from '../../calva-fmt/src/format-index';
import { backspaceOnWhitespace } from '../../cursor-doc/backspace-on-whitespace';
import * as indent from '../../cursor-doc/indent';
import { docFromTextNotation, textAndSelection } from './common/text-notation';

describe('formatter, indenter and paredit comparison', () => {
  const configs = [
    mkConfig({
      '#"\\S+"': [['inner', 0]],
    }),
    mkConfig({
      '#"\\S+"': [['block', 0]],
    }),
    mkConfig({
      '#"\\S+"': [['inner', 1]],
    }),
  ];

  describe('indents `and` form the same with formatter, indenter, and paredit', () => {
    configs.forEach((config) => {
      it(`indents 'and' form the same with formatter, indenter, and paredit, using config: ${config['cljfmt-options-string']}`, () => {
        const formatterIndent = getFormatterIndent('(and x\n|y)', config);
        const indenterIndent = getIndenterIndent('(and x\n|y)', config);
        const pareditIndent = getPareditIndent('(and x\n\n  |y)', config);
        expect(formatterIndent).toEqual(indenterIndent);
        expect(formatterIndent).toEqual(pareditIndent);
      });
    });
  });

  describe('indents keyword form the same with formatter, indenter and paredit', () => {
    configs.forEach((config) => {
      it(`indents keyword form the same with formatter, indenter, and paredit, using config: ${config['cljfmt-options-string']}`, () => {
        const formatterIndent = getFormatterIndent('(:kw x\n|y)', config);
        const indenterIndent = getIndenterIndent('(:kw x\n|y)', config);
        const pareditIndent = getPareditIndent('(:kw x\n\n  |y)', config);
        expect(formatterIndent).toEqual(indenterIndent);
        expect(formatterIndent).toEqual(pareditIndent);
      });
    });
  });
});

function getIndenterIndent(form: string, config: ReturnType<typeof mkConfig>) {
  const doc = docFromTextNotation(form);
  const p = textAndSelection(doc)[1][0];
  return indent.getIndent(doc.model, p, config);
}

function getFormatterIndent(notation: string, config: ReturnType<typeof mkConfig>) {
  const doc = docFromTextNotation(notation);
  const form = textAndSelection(doc)[0];
  const p = textAndSelection(doc)[1][0];
  const formatterResult = formatIndex(form, [0, notation.length], p, '\n', false, config);
  return formatterResult['new-index'] - formatterResult.idx;
}

function getPareditIndent(notation: string, config: ReturnType<typeof mkConfig>) {
  const doc = docFromTextNotation(notation);
  const p = textAndSelection(doc)[1][0];
  return backspaceOnWhitespace(doc, doc.getTokenCursor(p), config).indent;
}

function mkConfig(rules: indent.IndentRules) {
  const cljRules = jsRulesToCljsRulesString(rules);
  return {
    'cljfmt-options-string': `{:indents {${cljRules}}}`,
    'cljfmt-options': {
      indents: rules,
    },
  };
}

function jsRulesToCljsRulesString(rules: indent.IndentRules) {
  return Object.entries(rules).reduce((acc, [k, v], i) => {
    return acc + `${k} ${jsRuleToCljRuleString(v)} `;
  }, '');
}

function jsRuleToCljRuleString(value: indent.IndentRule[]) {
  return '[' + value.map((a) => `[:${a[0]} ${a[1]}]`).join('') + ']';
}
