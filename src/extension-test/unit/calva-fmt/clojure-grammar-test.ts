import { expect } from 'chai';
import { createGrammarTestContext, type GrammarTestContext } from './grammar-test-helper';

describe('Clojure grammar', () => {
  let ctx: GrammarTestContext;

  before(async () => {
    ctx = await createGrammarTestContext();
  });

  it('parses the grammar', () => {
    expect(ctx.grammar).to.exist;
    expect(ctx.scopeName).to.equal('source.clojure');
  });

  it('tokenizes semicolon comments', () => {
    const { tokens } = ctx.tokenizeLine('; clojure');
    expect(tokens[0]).to.deep.equal({
      value: ';',
      scopes: [
        'source.clojure',
        'comment.line.semicolon.clojure',
        'punctuation.definition.comment.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: ' clojure',
      scopes: ['source.clojure', 'comment.line.semicolon.clojure'],
    });
  });

  it('does not tokenize escaped semicolons as comments', () => {
    const { tokens } = ctx.tokenizeLine('\\; clojure');
    expect(tokens[0]).to.deep.equal({ value: '\\; ', scopes: ['source.clojure'] });
    expect(tokens[1]).to.deep.equal({
      value: 'clojure',
      scopes: ['source.clojure', 'entity.name.variable.clojure'],
    });
  });

  it('tokenizes shebang comments', () => {
    const { tokens } = ctx.tokenizeLine('#!/usr/bin/env clojure');
    expect(tokens[0]).to.deep.equal({
      value: '#!',
      scopes: [
        'source.clojure',
        'comment.line.shebang.clojure',
        'punctuation.definition.comment.shebang.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '/usr/bin/env clojure',
      scopes: ['source.clojure', 'comment.line.shebang.clojure'],
    });
  });

  it('tokenizes strings', () => {
    const { tokens } = ctx.tokenizeLine('"foo bar"');
    expect(tokens[0]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: 'foo bar',
      scopes: ['source.clojure', 'string.quoted.double.clojure'],
    });
    expect(tokens[2]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.end.clojure',
      ],
    });
  });

  it('tokenizes character escape sequences', () => {
    const { tokens } = ctx.tokenizeLine('"\\n"');
    expect(tokens[0]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '\\n',
      scopes: [
        'source.clojure',
        'string.quoted.double.clojure',
        'constant.character.escape.clojure',
      ],
    });
    expect(tokens[2]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.end.clojure',
      ],
    });
  });

  it('tokenizes regexes', () => {
    const { tokens } = ctx.tokenizeLine('#"foo"');
    expect(tokens[0]).to.deep.equal({
      value: '#"',
      scopes: [
        'source.clojure',
        'string.regexp.clojure',
        'punctuation.definition.regexp.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: 'foo',
      scopes: ['source.clojure', 'string.regexp.clojure'],
    });
    expect(tokens[2]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.regexp.clojure',
        'punctuation.definition.regexp.end.clojure',
      ],
    });
  });

  it('tokenizes backslash escape character in regexes', () => {
    const { tokens } = ctx.tokenizeLine('#"\\\\" "/"');
    expect(tokens[0]).to.deep.equal({
      value: '#"',
      scopes: [
        'source.clojure',
        'string.regexp.clojure',
        'punctuation.definition.regexp.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '\\\\',
      scopes: ['source.clojure', 'string.regexp.clojure', 'constant.character.escape.clojure'],
    });
    expect(tokens[2]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.regexp.clojure',
        'punctuation.definition.regexp.end.clojure',
      ],
    });
    expect(tokens[4]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.begin.clojure',
      ],
    });
    expect(tokens[5]).to.deep.equal({
      value: '/',
      scopes: ['source.clojure', 'string.quoted.double.clojure'],
    });
    expect(tokens[6]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.end.clojure',
      ],
    });
  });

  it('tokenizes escaped double quote in regexes', () => {
    const { tokens } = ctx.tokenizeLine('#"\\""');
    expect(tokens[0]).to.deep.equal({
      value: '#"',
      scopes: [
        'source.clojure',
        'string.regexp.clojure',
        'punctuation.definition.regexp.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '\\"',
      scopes: ['source.clojure', 'string.regexp.clojure', 'constant.character.escape.clojure'],
    });
    expect(tokens[2]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'string.regexp.clojure',
        'punctuation.definition.regexp.end.clojure',
      ],
    });
  });

  it('tokenizes numerics', () => {
    const numbers: Record<string, string[]> = {
      'constant.numeric.ratio.clojure': ['1/2', '123/456', '+0/2', '-23/1'],
      'constant.numeric.arbitrary-radix.clojure': [
        '2R1011',
        '16rDEADBEEF',
        '16rDEADBEEFN',
        '36rZebra',
      ],
      'constant.numeric.hexadecimal.clojure': ['0xDEADBEEF', '0XDEADBEEF', '0xDEADBEEFN', '0x0'],
      'constant.numeric.octal.clojure': ['0123', '0123N', '00'],
      'constant.numeric.double.clojure': [
        '123.45',
        '123.45e6',
        '123.45E6',
        '123.456M',
        '42.',
        '42.M',
        '42E+9M',
        '42E-0',
        '0M',
        '+0M',
        '42.E-23M',
      ],
      'constant.numeric.long.clojure': ['123', '12321', '123N', '+123N', '-123', '0'],
      'constant.numeric.symbol.clojure': ['##Inf', '##-Inf', '##NaN'],
    };

    for (const [scope, nums] of Object.entries(numbers)) {
      for (const num of nums) {
        const { tokens } = ctx.tokenizeLine(num);
        expect(tokens[0]).to.deep.equal({ value: num, scopes: ['source.clojure', scope] });
      }
    }
  });

  it('tokenizes booleans', () => {
    const bools = ['true', 'false'];
    const scope = 'constant.language.boolean.clojure';

    for (const bool of bools) {
      expect(ctx.tokenizeLine(bool).tokens[0]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', scope],
      });
      expect(ctx.tokenizeLine(' ' + bool).tokens[1]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', scope],
      });
      expect(ctx.tokenizeLine(bool + ' ').tokens[0]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', scope],
      });
      expect(ctx.tokenizeLine(',' + bool).tokens[1]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', scope],
      });
      expect(ctx.tokenizeLine(bool + ',').tokens[0]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', scope],
      });
      expect(ctx.tokenizeLine('(not ' + bool + ')').tokens[3]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', 'meta.expression.clojure', scope],
      });
      expect(ctx.tokenizeLine('[' + bool + ']').tokens[1]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', 'meta.vector.clojure', scope],
      });
      expect(ctx.tokenizeLine('{:a ' + bool + '}').tokens[3]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', 'meta.map.clojure', scope],
      });
      expect(ctx.tokenizeLine(bool + '^{:hi 1}[]').tokens[0]).to.deep.equal({
        value: bool,
        scopes: ['source.clojure', scope],
      });
    }
  });

  it('tokenizes nil', () => {
    const scope = 'constant.language.nil.clojure';
    expect(ctx.tokenizeLine('nil').tokens[0]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', scope],
    });
    expect(ctx.tokenizeLine(' nil').tokens[1]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', scope],
    });
    expect(ctx.tokenizeLine('nil ').tokens[0]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', scope],
    });
    expect(ctx.tokenizeLine(',nil').tokens[1]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', scope],
    });
    expect(ctx.tokenizeLine('nil,').tokens[0]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', scope],
    });
    expect(ctx.tokenizeLine('(conj nil)').tokens[3]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', 'meta.expression.clojure', scope],
    });
    expect(ctx.tokenizeLine('[nil]').tokens[1]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', 'meta.vector.clojure', scope],
    });
    expect(ctx.tokenizeLine('{:a nil}').tokens[3]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', 'meta.map.clojure', scope],
    });
    expect(ctx.tokenizeLine('nil^{:hi 1}[]').tokens[0]).to.deep.equal({
      value: 'nil',
      scopes: ['source.clojure', scope],
    });
  });

  it('tokenizes keywords', () => {
    const tests: Record<string, string[]> = {
      'meta.expression.clojure': ['(:foo)'],
      'meta.map.clojure': ['{:foo}'],
      'meta.vector.clojure': ['[:foo]'],
      'meta.quoted-expression.clojure': ["'(:foo)", '`(:foo)'],
    };

    for (const [metaScope, lines] of Object.entries(tests)) {
      for (const line of lines) {
        expect(ctx.tokenizeLine(line).tokens[1]).to.deep.equal({
          value: ':foo',
          scopes: ['source.clojure', metaScope, 'constant.keyword.clojure'],
        });
      }
    }

    expect(ctx.tokenizeLine('(def foo :bar)').tokens[5]).to.deep.equal({
      value: ':bar',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.definition.global.clojure',
        'constant.keyword.clojure',
      ],
    });

    expect(ctx.tokenizeLine('(def foo :Öπ)').tokens[5]).to.deep.equal({
      value: ':Öπ',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.definition.global.clojure',
        'constant.keyword.clojure',
      ],
    });
  });

  it('tokenizes keyfns (keyword control)', () => {
    const keyfns = [
      'declare',
      'declare-',
      'ns',
      'in-ns',
      'import',
      'use',
      'require',
      'load',
      'compile',
      'def',
      'defn',
      'defn-',
      'defmacro',
      'defåπç',
    ];

    for (const keyfn of keyfns) {
      expect(ctx.tokenizeLine(`(${keyfn})`).tokens[1]).to.deep.equal({
        value: keyfn,
        scopes: ['source.clojure', 'meta.expression.clojure', 'storage.control.clojure'],
      });
    }
  });

  it('does not tokenize `default...`s as keyfn (keyword control)', () => {
    expect(ctx.tokenizeLine('(defnormal foo)').tokens[1].scopes).to.include(
      'storage.control.clojure'
    );
    expect(ctx.tokenizeLine('(foo/defnormal foo)').tokens[1].scopes).to.include(
      'storage.control.clojure'
    );
    expect(ctx.tokenizeLine('(normaldef foo)').tokens[1].scopes).to.not.include(
      'storage.control.clojure'
    );
    expect(ctx.tokenizeLine('(default foo)').tokens[1].scopes).to.not.include(
      'storage.control.clojure'
    );
    expect(ctx.tokenizeLine('(defaultfoo ba)').tokens[1].scopes).to.not.include(
      'storage.control.clojure'
    );
    expect(ctx.tokenizeLine('(foo/default foo)').tokens[1].scopes).to.not.include(
      'storage.control.clojure'
    );
    expect(ctx.tokenizeLine('(foo/defaultfoo ba)').tokens[1].scopes).to.not.include(
      'storage.control.clojure'
    );
  });

  it('tokenizes keyfns (storage control)', () => {
    const keyfns = [
      'if',
      'when',
      'for',
      'cond',
      'do',
      'let',
      'binding',
      'loop',
      'recur',
      'fn',
      'throw',
      'try',
      'catch',
      'finally',
      'case',
    ];

    for (const keyfn of keyfns) {
      expect(ctx.tokenizeLine(`(${keyfn})`).tokens[1]).to.deep.equal({
        value: keyfn,
        scopes: ['source.clojure', 'meta.expression.clojure', 'storage.control.clojure'],
      });
    }
  });

  it('tokenizes global definitions', () => {
    const macros = [
      'ns',
      'declare',
      'def',
      'defn',
      'defn-',
      'defroutes',
      'compojure/defroutes',
      'rum.core/defc123-',
      'some.nested-ns/def-nested->symbol!?*',
      'def+!.?abc8:<>',
      'ns/def+!.?abc8:<>',
      'ns/defåÄÖπç',
    ];

    for (const macro of macros) {
      const { tokens } = ctx.tokenizeLine(`(${macro} foo 'bar)`);
      expect(tokens[1]).to.deep.equal({
        value: macro,
        scopes: [
          'source.clojure',
          'meta.expression.clojure',
          'meta.definition.global.clojure',
          'storage.control.clojure',
        ],
      });
      expect(tokens[3]).to.deep.equal({
        value: 'foo',
        scopes: [
          'source.clojure',
          'meta.expression.clojure',
          'meta.definition.global.clojure',
          'entity.global.clojure',
        ],
      });
    }
  });

  it('tokenizes negative number values in global definitions as numbers', () => {
    const { tokens } = ctx.tokenizeLine('(def x -2000)');
    expect(tokens[3]).to.deep.equal({
      value: 'x',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.definition.global.clojure',
        'entity.global.clojure',
      ],
    });
    expect(tokens[5]).to.deep.equal({
      value: '-2000',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.definition.global.clojure',
        'constant.numeric.long.clojure',
      ],
    });
  });

  it('tokenizes dynamic variables', () => {
    const mutables = ['*ns*', '*foo-bar*', '*åÄÖπç*'];

    for (const mutable of mutables) {
      expect(ctx.tokenizeLine(mutable).tokens[0]).to.deep.equal({
        value: mutable,
        scopes: ['source.clojure', 'entity.name.variable.dynamic.clojure'],
      });
    }
  });

  it('tokenizes metadata', () => {
    let { tokens } = ctx.tokenizeLine('^Foo');
    expect(tokens[0]).to.deep.equal({
      value: '^',
      scopes: ['source.clojure', 'meta.metadata.simple.clojure'],
    });
    expect(tokens[1]).to.deep.equal({
      value: 'Foo',
      scopes: ['source.clojure', 'meta.metadata.simple.clojure', 'entity.name.variable.clojure'],
    });

    ({ tokens } = ctx.tokenizeLine('^Öπ'));
    expect(tokens[0]).to.deep.equal({
      value: '^',
      scopes: ['source.clojure', 'meta.metadata.simple.clojure'],
    });
    expect(tokens[1]).to.deep.equal({
      value: 'Öπ',
      scopes: ['source.clojure', 'meta.metadata.simple.clojure', 'entity.name.variable.clojure'],
    });

    ({ tokens } = ctx.tokenizeLine('^{:foo true}'));
    expect(tokens[0]).to.deep.equal({
      value: '^{',
      scopes: [
        'source.clojure',
        'meta.metadata.map.clojure',
        'punctuation.section.metadata.map.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: ':foo',
      scopes: ['source.clojure', 'meta.metadata.map.clojure', 'constant.keyword.clojure'],
    });
    expect(tokens[2]).to.deep.equal({
      value: ' ',
      scopes: ['source.clojure', 'meta.metadata.map.clojure'],
    });
    expect(tokens[3]).to.deep.equal({
      value: 'true',
      scopes: ['source.clojure', 'meta.metadata.map.clojure', 'constant.language.boolean.clojure'],
    });
    expect(tokens[4]).to.deep.equal({
      value: '}',
      scopes: [
        'source.clojure',
        'meta.metadata.map.clojure',
        'punctuation.section.metadata.map.end.trailing.clojure',
      ],
    });
  });

  it('tokenizes functions', () => {
    for (const expr of ['(foo)', '(foo 1 10)']) {
      expect(ctx.tokenizeLine(expr).tokens[1]).to.deep.equal({
        value: 'foo',
        scopes: ['source.clojure', 'meta.expression.clojure', 'entity.name.function.clojure'],
      });
    }

    for (const expr of ['(bar/foo)', '(bar/foo 1 10)']) {
      const { tokens } = ctx.tokenizeLine(expr);
      expect(tokens[1]).to.deep.equal({
        value: 'bar',
        scopes: ['source.clojure', 'meta.expression.clojure', 'entity.name.namespace.clojure'],
      });
      expect(tokens[2]).to.deep.equal({
        value: '/',
        scopes: ['source.clojure', 'meta.expression.clojure'],
      });
      expect(tokens[3]).to.deep.equal({
        value: 'foo',
        scopes: ['source.clojure', 'meta.expression.clojure', 'entity.name.function.clojure'],
      });
    }

    expect(ctx.tokenizeLine('(Öπ 2 20)').tokens[1]).to.deep.equal({
      value: 'Öπ',
      scopes: ['source.clojure', 'meta.expression.clojure', 'entity.name.function.clojure'],
    });
  });

  it('tokenizes vars', () => {
    let { tokens } = ctx.tokenizeLine("(func #'foo)");
    expect(tokens[2]).to.deep.equal({
      value: ' #',
      scopes: ['source.clojure', 'meta.expression.clojure'],
    });
    expect(tokens[3]).to.deep.equal({
      value: "'foo",
      scopes: ['source.clojure', 'meta.expression.clojure', 'meta.var.clojure'],
    });

    ({ tokens } = ctx.tokenizeLine("(func #'Öπ)"));
    expect(tokens[2]).to.deep.equal({
      value: ' #',
      scopes: ['source.clojure', 'meta.expression.clojure'],
    });
    expect(tokens[3]).to.deep.equal({
      value: "'Öπ",
      scopes: ['source.clojure', 'meta.expression.clojure', 'meta.var.clojure'],
    });
  });

  it('tokenizes symbols', () => {
    expect(ctx.tokenizeLine('x').tokens[0]).to.deep.equal({
      value: 'x',
      scopes: ['source.clojure', 'entity.name.variable.clojure'],
    });
    expect(ctx.tokenizeLine('Öπ').tokens[0]).to.deep.equal({
      value: 'Öπ',
      scopes: ['source.clojure', 'entity.name.variable.clojure'],
    });
    expect(ctx.tokenizeLine('1foobar').tokens[0]).to.deep.equal({
      value: '1',
      scopes: ['source.clojure', 'constant.numeric.long.clojure'],
    });
  });

  it('tokenizes namespaces', () => {
    let { tokens } = ctx.tokenizeLine('foo/bar');
    expect(tokens[0]).to.deep.equal({
      value: 'foo',
      scopes: ['source.clojure', 'entity.name.namespace.clojure'],
    });
    expect(tokens[1]).to.deep.equal({ value: '/', scopes: ['source.clojure'] });
    expect(tokens[2]).to.deep.equal({
      value: 'bar',
      scopes: ['source.clojure', 'entity.name.variable.clojure'],
    });

    ({ tokens } = ctx.tokenizeLine('Öπ/Åä'));
    expect(tokens[0]).to.deep.equal({
      value: 'Öπ',
      scopes: ['source.clojure', 'entity.name.namespace.clojure'],
    });
    expect(tokens[1]).to.deep.equal({ value: '/', scopes: ['source.clojure'] });
    expect(tokens[2]).to.deep.equal({
      value: 'Åä',
      scopes: ['source.clojure', 'entity.name.variable.clojure'],
    });
  });

  function testMetaSection(
    metaScope: string,
    puncScope: string,
    startsWith: string,
    endsWith: string
  ): void {
    const line = `${startsWith}foo, bar${endsWith}`;
    const { tokens } = ctx.tokenizeLine(line);
    const start = tokens[0];
    const end = tokens[tokens.length - 1];
    const mid = tokens.slice(1, -1);

    expect(start).to.deep.equal({
      value: startsWith,
      scopes: [
        'source.clojure',
        `meta.${metaScope}.clojure`,
        `punctuation.section.${puncScope}.begin.clojure`,
      ],
    });
    expect(end).to.deep.equal({
      value: endsWith,
      scopes: [
        'source.clojure',
        `meta.${metaScope}.clojure`,
        `punctuation.section.${puncScope}.end.trailing.clojure`,
      ],
    });
    for (const token of mid) {
      expect(token.scopes.slice(0, 2)).to.deep.equal([
        'source.clojure',
        `meta.${metaScope}.clojure`,
      ]);
    }

    const multiline = `${startsWith}foo\n bar${endsWith}`;
    const lineTokens = ctx.tokenizeLines(multiline);
    const start0 = lineTokens[0][0];
    const mid0 = lineTokens[0].slice(1);
    const end1 = lineTokens[1][lineTokens[1].length - 1];
    const mid1 = lineTokens[1].slice(0, -1);

    expect(start0).to.deep.equal({
      value: startsWith,
      scopes: [
        'source.clojure',
        `meta.${metaScope}.clojure`,
        `punctuation.section.${puncScope}.begin.clojure`,
      ],
    });
    for (const token of mid0) {
      expect(token.scopes.slice(0, 2)).to.deep.equal([
        'source.clojure',
        `meta.${metaScope}.clojure`,
      ]);
    }
    expect(end1).to.deep.equal({
      value: endsWith,
      scopes: [
        'source.clojure',
        `meta.${metaScope}.clojure`,
        `punctuation.section.${puncScope}.end.trailing.clojure`,
      ],
    });
    for (const token of mid1) {
      expect(token.scopes.slice(0, 2)).to.deep.equal([
        'source.clojure',
        `meta.${metaScope}.clojure`,
      ]);
    }
  }

  it('tokenizes expressions', () => {
    testMetaSection('expression', 'expression', '(', ')');
  });

  it('tokenizes quoted expressions', () => {
    testMetaSection('quoted-expression', 'expression', "'(", ')');
    testMetaSection('quoted-expression', 'expression', '`(', ')');
  });

  it('tokenizes vectors', () => {
    testMetaSection('vector', 'vector', '[', ']');
  });

  it('tokenizes maps', () => {
    testMetaSection('map', 'map', '{', '}');
  });

  it('tokenizes sets', () => {
    testMetaSection('set', 'set', '#{', '}');
  });

  it('tokenizes functions in nested sexp', () => {
    const { tokens } = ctx.tokenizeLine('((foo bar) baz)');
    expect(tokens[0]).to.deep.equal({
      value: '(',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '(',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.begin.clojure',
      ],
    });
    expect(tokens[2]).to.deep.equal({
      value: 'foo',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.expression.clojure',
        'entity.name.function.clojure',
      ],
    });
    expect(tokens[3]).to.deep.equal({
      value: ' ',
      scopes: ['source.clojure', 'meta.expression.clojure', 'meta.expression.clojure'],
    });
    expect(tokens[4]).to.deep.equal({
      value: 'bar',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.expression.clojure',
        'entity.name.variable.clojure',
      ],
    });
    expect(tokens[5]).to.deep.equal({
      value: ')',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.end.clojure',
      ],
    });
    expect(tokens[6]).to.deep.equal({
      value: ' ',
      scopes: ['source.clojure', 'meta.expression.clojure'],
    });
    expect(tokens[7]).to.deep.equal({
      value: 'baz',
      scopes: ['source.clojure', 'meta.expression.clojure', 'entity.name.variable.clojure'],
    });
    expect(tokens[8]).to.deep.equal({
      value: ')',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.end.trailing.clojure',
      ],
    });
  });

  it('tokenizes maps used as functions', () => {
    const { tokens } = ctx.tokenizeLine('({:foo bar} :foo)');
    expect(tokens[0]).to.deep.equal({
      value: '(',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '{',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.map.clojure',
        'punctuation.section.map.begin.clojure',
      ],
    });
    expect(tokens[2]).to.deep.equal({
      value: ':foo',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.map.clojure',
        'constant.keyword.clojure',
      ],
    });
    expect(tokens[3]).to.deep.equal({
      value: ' ',
      scopes: ['source.clojure', 'meta.expression.clojure', 'meta.map.clojure'],
    });
    expect(tokens[4]).to.deep.equal({
      value: 'bar',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.map.clojure',
        'entity.name.variable.clojure',
      ],
    });
    expect(tokens[5]).to.deep.equal({
      value: '}',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.map.clojure',
        'punctuation.section.map.end.clojure',
      ],
    });
    expect(tokens[6]).to.deep.equal({
      value: ' ',
      scopes: ['source.clojure', 'meta.expression.clojure'],
    });
    expect(tokens[7]).to.deep.equal({
      value: ':foo',
      scopes: ['source.clojure', 'meta.expression.clojure', 'constant.keyword.clojure'],
    });
    expect(tokens[8]).to.deep.equal({
      value: ')',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.end.trailing.clojure',
      ],
    });
  });

  it('tokenizes sets used in functions', () => {
    const { tokens } = ctx.tokenizeLine('(#{:foo :bar})');
    expect(tokens[0]).to.deep.equal({
      value: '(',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '#{',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.set.clojure',
        'punctuation.section.set.begin.clojure',
      ],
    });
    expect(tokens[2]).to.deep.equal({
      value: ':foo',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.set.clojure',
        'constant.keyword.clojure',
      ],
    });
    expect(tokens[3]).to.deep.equal({
      value: ' ',
      scopes: ['source.clojure', 'meta.expression.clojure', 'meta.set.clojure'],
    });
    expect(tokens[4]).to.deep.equal({
      value: ':bar',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.set.clojure',
        'constant.keyword.clojure',
      ],
    });
    expect(tokens[5]).to.deep.equal({
      value: '}',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'meta.set.clojure',
        'punctuation.section.set.end.trailing.clojure',
      ],
    });
    expect(tokens[6]).to.deep.equal({
      value: ')',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.end.trailing.clojure',
      ],
    });
  });

  it('tokenize strings (wrongly) used as functions', () => {
    const { tokens } = ctx.tokenizeLine('("foo)")');
    expect(tokens[0]).to.deep.equal({
      value: '(',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.begin.clojure',
      ],
    });
    expect(tokens[1]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.begin.clojure',
      ],
    });
    expect(tokens[2]).to.deep.equal({
      value: 'foo)',
      scopes: ['source.clojure', 'meta.expression.clojure', 'string.quoted.double.clojure'],
    });
    expect(tokens[3]).to.deep.equal({
      value: '"',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'string.quoted.double.clojure',
        'punctuation.definition.string.end.clojure',
      ],
    });
    expect(tokens[4]).to.deep.equal({
      value: ')',
      scopes: [
        'source.clojure',
        'meta.expression.clojure',
        'punctuation.section.expression.end.trailing.clojure',
      ],
    });
  });

  describe('replPrompt', () => {
    const hardSpace = '\u00a0';

    it('tokenizes repl prompt', () => {
      const { tokens } = ctx.tokenizeLine(`foo꞉bar.baz-2꞉>${hardSpace}`);
      expect(tokens[0]).to.deep.equal({
        value: 'foo',
        scopes: ['source.clojure', 'keyword.control.prompt.clojure'],
      });
      expect(tokens[1]).to.deep.equal({
        value: '꞉',
        scopes: ['source.clojure', 'keyword.control.prompt.clojure'],
      });
      expect(tokens[2]).to.deep.equal({
        value: 'bar.baz-2',
        scopes: ['source.clojure', 'entity.name.namespace.prompt.clojure'],
      });
      expect(tokens[3]).to.deep.equal({
        value: '꞉>',
        scopes: ['source.clojure', 'keyword.control.prompt.clojure'],
      });
    });

    it('does not tokenize repl prompt when prepended with anything', () => {
      const { tokens } = ctx.tokenizeLine(` foo꞉bar.baz-2꞉>${hardSpace}`);
      expect(tokens[0]).to.deep.equal({ value: ' ', scopes: ['source.clojure'] });
      expect(tokens[1]).to.deep.equal({
        value: 'foo',
        scopes: ['source.clojure', 'entity.name.variable.clojure'],
      });
    });

    it('does not tokenize repl prompt when not followed by hard space', () => {
      expect(ctx.tokenizeLine('foo꞉bar.baz-2꞉>').tokens[0]).to.deep.equal({
        value: 'foo',
        scopes: ['source.clojure', 'entity.name.variable.clojure'],
      });
    });

    it('tokenizes repl prompt with session suffix', () => {
      const { tokens } = ctx.tokenizeLine(`foo:s_u-f2fix꞉bar.baz-2꞉>${hardSpace}`);
      expect(tokens[0]).to.deep.equal({
        value: 'foo:s_u-f2fix',
        scopes: ['source.clojure', 'keyword.control.prompt.clojure'],
      });
      expect(tokens[1]).to.deep.equal({
        value: '꞉',
        scopes: ['source.clojure', 'keyword.control.prompt.clojure'],
      });
      expect(tokens[2]).to.deep.equal({
        value: 'bar.baz-2',
        scopes: ['source.clojure', 'entity.name.namespace.prompt.clojure'],
      });
      expect(tokens[3]).to.deep.equal({
        value: '꞉>',
        scopes: ['source.clojure', 'keyword.control.prompt.clojure'],
      });
    });

    it('does not tokenize as repl prompt when suffix contains invalid characters', () => {
      expect(ctx.tokenizeLine(`foo:suf%fix꞉bar.baz-2꞉>${hardSpace}`).tokens[0]).to.deep.equal({
        value: 'foo:suf',
        scopes: ['source.clojure', 'entity.name.variable.clojure'],
      });
    });
  });

  describe('firstLineMatch', () => {
    /** Strip template indent only; preserve leading space/tab for negative cases. */
    function lines(block: string): string[] {
      return block
        .split('\n')
        .map((l) => l.replace(/^\s{8}/, ''))
        .filter((l) => l.trim().length > 0);
    }

    it('recognises interpreter directives', () => {
      const valid = `
        #!/usr/sbin/boot foo
        #!/usr/bin/boot foo=bar/
        #!/usr/sbin/boot
        #!/usr/sbin/boot foo bar baz
        #!/usr/bin/boot perl
        #!/usr/bin/boot bin/perl
        #!/usr/bin/boot
        #!/bin/boot
        #!/usr/bin/boot --script=usr/bin
        #! /usr/bin/env A=003 B=149 C=150 D=xzd E=base64 F=tar G=gz H=head I=tail boot
        #!\t/usr/bin/env --foo=bar boot --quu=quux
        #! /usr/bin/boot
        #!/usr/bin/env boot
      `;
      for (const line of lines(valid)) {
        expect(ctx.firstLineMatches(line), line).to.be.true;
      }

      const invalid = `
         #!/usr/sbin/boot
        \t#!/usr/sbin/boot
        #!/usr/bin/env-boot/node-env/
        #!/usr/bin/das-boot
        #! /usr/binboot
        #!\t/usr/bin/env --boot=bar
      `;
      for (const line of lines(invalid)) {
        expect(ctx.firstLineMatches(line), line).to.be.false;
      }
    });

    it('recognises Emacs modelines', () => {
      const valid = `
        #-*- Clojure -*-
        #-*- mode: ClojureScript -*-
        /* -*-clojureScript-*- */
        // -*- Clojure -*-
        /* -*- mode:Clojure -*- */
        // -*- font:bar;mode:Clojure -*-
        // -*- font:bar;mode:Clojure;foo:bar; -*-
        // -*-font:mode;mode:Clojure-*-
        // -*- foo:bar mode: clojureSCRIPT bar:baz -*-
        " -*-foo:bar;mode:clojure;bar:foo-*- ";
        " -*-font-mode:foo;mode:clojure;foo-bar:quux-*-"
        "-*-font:x;foo:bar; mode : clojure; bar:foo;foooooo:baaaaar;fo:ba;-*-";
        "-*- font:x;foo : bar ; mode : ClojureScript ; bar : foo ; foooooo:baaaaar;fo:ba-*-";
      `;
      for (const line of lines(valid)) {
        expect(ctx.firstLineMatches(line), line).to.be.true;
      }

      const invalid = `
        /* --*clojure-*- */
        /* -*-- clojure -*-
        /* -*- -- Clojure -*-
        /* -*- Clojure -;- -*-
        // -*- iClojure -*-
        // -*- Clojure; -*-
        // -*- clojure-door -*-
        /* -*- model:clojure -*-
        /* -*- indent-mode:clojure -*-
        // -*- font:mode;Clojure -*-
        // -*- mode: -*- Clojure
        // -*- mode: das-clojure -*-
        // -*-font:mode;mode:clojure--*-
      `;
      for (const line of lines(invalid)) {
        expect(ctx.firstLineMatches(line), line).to.be.false;
      }
    });

    it('recognises Vim modelines', () => {
      const valid = `
        vim: se filetype=clojure:
        # vim: se ft=clojure:
        # vim: set ft=Clojure:
        # vim: set filetype=Clojure:
        # vim: ft=Clojure
        # vim: syntax=Clojure
        # vim: se syntax=Clojure:
        # ex: syntax=Clojure
        # vim:ft=clojure
        # vim600: ft=clojure
        # vim>600: set ft=clojure:
        # vi:noai:sw=3 ts=6 ft=clojure
        # vi::::::::::noai:::::::::::: ft=clojure
        # vim:ts=4:sts=4:sw=4:noexpandtab:ft=clojure
        # vi:: noai : : : : sw   =3 ts   =6 ft  =clojure
        # vim: ts=4: pi sts=4: ft=clojure: noexpandtab: sw=4:
        # vim: ts=4 sts=4: ft=clojure noexpandtab:
        # vim:noexpandtab sts=4 ft=clojure ts=4
        # vim:noexpandtab:ft=clojure
        # vim:ts=4:sts=4 ft=clojure:noexpandtab: 
        # vim:noexpandtab titlestring=hi|there\\\\ ft=clojure ts=4
      `;
      for (const line of lines(valid)) {
        expect(ctx.firstLineMatches(line), line).to.be.true;
      }

      const invalid = `
        ex: se filetype=clojure:
        _vi: se filetype=clojure:
         vi: se filetype=clojure
        # vim set ft=klojure
        # vim: soft=clojure
        # vim: clean-syntax=clojure:
        # vim set ft=clojure:
        # vim: setft=clojure:
        # vim: se ft=clojure backupdir=tmp
        # vim: set ft=clojure set cmdheight=1
        # vim:noexpandtab sts:4 ft:clojure ts:4
        # vim:noexpandtab titlestring=hi\\|there\\ ft=clojure ts=4
        # vim:noexpandtab titlestring=hi\\|there\\\\\\ ft=clojure ts=4
      `;
      for (const line of lines(invalid)) {
        expect(ctx.firstLineMatches(line), line).to.be.false;
      }
    });
  });
});
