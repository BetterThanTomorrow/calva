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
      const formatterIndent = getFormatterIndent('(and x\ny)', 7, config);
      const indenterIndent = getIndenterIndent('(and x\n|y)', config);
      const pareditIndent = getPareditIndent('(and x\n\n  |y)', 10, config);

      expect(formatterIndent).toEqual(indenterIndent);
      expect(formatterIndent).toEqual(pareditIndent);
    });
  });
});

function getIndenterIndent(form: string, config: ReturnType<typeof mkConfig>) {
  const indenterDoc = docFromTextNotation(form);
  return indent.getIndent(indenterDoc.model, textAndSelection(indenterDoc)[1][0], config);
}

function getFormatterIndent(form: string, cursor: number, config: ReturnType<typeof mkConfig>) {
  const formatterResult = formatIndex(form, [0, form.length], cursor, '\n', false, config);
  return formatterResult['new-index'] - formatterResult.idx;
}

function getPareditIndent(form: string, cursor: number, config: ReturnType<typeof mkConfig>) {
  const pareditDoc = docFromTextNotation(form);
  return backspaceOnWhitespace(pareditDoc, pareditDoc.getTokenCursor(cursor), config).indent;
}

function mkConfig(rules: indent.IndentRules, rulesString: string) {
  return {
    'cljfmt-options-string': rulesString,
    'cljfmt-options': {
      indents: rules,
    },
  };
}
