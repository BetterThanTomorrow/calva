import * as expect from 'expect';
import { formatIndexes } from '../../calva-fmt/src/format-index';
import { backspaceOnWhitespace } from '../../cursor-doc/backspace-on-whitespace';
import * as indent from '../../cursor-doc/indent';
import { docFromTextNotation, textAndSelection } from './common/text-notation';

describe('formatter, indenter and paredit comparison', () => {
  const configs = [
    mkConfig({
      indents: {
        '#"\\S+"': [['inner', 0]],
      },
    }),
    mkConfig({
      indents: {
        '#"\\S+"': [['block', 0]],
      },
    }),
    mkConfig({
      indents: {
        '#"\\S+"': [['inner', 1]],
      },
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

describe('formatter trimming', () => {
  const config = mkConfig({
    'remove-surrounding-whitespace?': false,
    'remove-trailing-whitespace?': false,
    indents: {
      '#"\\S+"': [['inner', 0]],
    },
  });

  it('formatter does not trim surrounding space when config disables that', () => {
    const formattedText = getFormattedText(' |(and x\ny) ', config);
    expect(formattedText).toEqual(' (and x\n   y) ');
  });
});

function getIndenterIndent(form: string, config: ReturnType<typeof mkConfig>) {
  const doc = docFromTextNotation(form);
  const p = textAndSelection(doc)[1][0];
  return indent.getIndent(doc.model, p, config);
}

function getFormattedText(notation: string, config: ReturnType<typeof mkConfig>) {
  const doc = docFromTextNotation(notation);
  const form = textAndSelection(doc)[0];
  const p = textAndSelection(doc)[1][0];
  const docText = doc.model.getText(0, 999, false);

  const formatterResult = formatIndexes(form, [0, notation.length], [p], '\n', false, config);
  return (
    docText.substring(0, formatterResult.range[0]) +
    formatterResult['range-text'] +
    docText.substring(formatterResult.range[1])
  );
}

function getFormatterIndent(notation: string, config: ReturnType<typeof mkConfig>) {
  const formattedText = getFormattedText(notation, config);

  // (1) Find point p in the formatted result by counting nonspace chars to the left.
  //     Overshoot to the next substantive character because the tests all
  //     concern a cursor at the end of a run of spaces.
  // (2) Count spaces to its left.

  // Non-space chars before p:
  const doc = docFromTextNotation(notation);
  const p = textAndSelection(doc)[1][0];
  const docTextBeforeP = doc.model.getText(0, p, false);
  const rxSpace = new RegExp(/[\s,]/, 'g');
  const nSolidsBeforeP = docTextBeforeP.replace(rxSpace, '').length;

  let pFormatted = 0;
  while (nSolidsBeforeP >= formattedText.substring(0, pFormatted).replace(rxSpace, '').length) {
    pFormatted++;
    if (pFormatted > 999) {
      throw 'Terrible';
    }
  }
  pFormatted--; // point to the substantive character at the cursor
  const pSpacesLeft = formattedText.substring(0, pFormatted).match(/ +$/)[0].length;
  return pSpacesLeft;
}

function getPareditIndent(notation: string, config: ReturnType<typeof mkConfig>) {
  const doc = docFromTextNotation(notation);
  const p = textAndSelection(doc)[1][0];
  return backspaceOnWhitespace(doc, doc.getTokenCursor(p), config).indent;
}

function mkConfig(options: { indents?: indent.IndentRules } & Record<string, any>) {
  const indentRules = options.indents || {};
  const cljRules = jsRulesToCljsRulesString(indentRules);
  const fullOptions = {
    ...options,
    ...(options.indents && { indents: undefined }),
  };
  const optionsString = `{:indents {${cljRules}} ${Object.entries(fullOptions)
    .filter(([key, value]) => key !== 'indents' && value !== undefined)
    .map(([key, value]) => `:${key} ${JSON.stringify(value)}`)
    .join(' ')}}`;

  return {
    'cljfmt-options-string': optionsString.trim(),
    'cljfmt-options': {
      ...fullOptions,
      indents: indentRules,
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
