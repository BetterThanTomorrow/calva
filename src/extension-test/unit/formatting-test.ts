import * as expect from 'expect';
import { formatIndex } from '../../calva-fmt/src/format-index';
import { backspaceOnWhitespace } from '../../cursor-doc/backspace-on-whitespace';
import * as indent from '../../cursor-doc/indent';

import { docFromTextNotation, textAndSelection } from './common/text-notation';

describe('formatter, indenter and paredit comparison', () => {
  const configs = [
    mkConfig(
      {
        '/\\S+/': [['inner', 0]],
      },
      '{:indents {#"\\S+" [[:inner 0]]}}'
    ),
    mkConfig(
      {
        '/\\S+/': [['inner', 1]],
      },
      '{:indents {#"\\S+" [[:inner 1]]}}'
    ),
  ];

  configs.forEach((config) => {
    it(`correctly formats 'and' form with formatter, indenter and paredit using config: ${config['cljfmt-options-string']}`, () => {
      const formatterIndent = getFormatterIndent('(and x\n|y)', config);
      const indenterIndent = getIndenterIndent('(and x\n|y)', config);
      const pareditIndent = getPareditIndent('(and x\n\n  |y)', config);

      expect(formatterIndent).toEqual(indenterIndent);
      expect(formatterIndent).toEqual(pareditIndent);
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

function mkConfig(rules: indent.IndentRules, rulesString: string) {
  return {
    'cljfmt-options-string': rulesString,
    'cljfmt-options': {
      indents: rules,
    },
  };
}
