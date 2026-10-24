import * as expectLib from 'expect';
import * as catalog from '../../custom-snippets-catalog';
import * as textNotation from './common/text-notation';

describe('customREPLCommandSnippets resolution (#3283)', () => {
  const editorNS = 'my.app.core';
  const editorRepl = 'clj';

  const resetSnippet: catalog.CustomREPLCommandSnippet = {
    name: 'Reset',
    key: 'r',
    snippet: '(reset)',
    ns: 'user',
  };

  it('keeps configured ns when filling editor defaults', () => {
    const entry = catalog.withEditorDefaults(resetSnippet, editorNS, editorRepl);
    expectLib.expect(entry.ns).toBe('user');
    expectLib.expect(entry.repl).toBe('clj');
  });

  it('preserves empty string ns and repl without overwriting with editor defaults', () => {
    const emptyNsSnippet: catalog.CustomREPLCommandSnippet = {
      name: 'Empty NS',
      snippet: '(foo)',
      ns: '',
      repl: '',
    };
    const entry = catalog.withEditorDefaults(emptyNsSnippet, editorNS, editorRepl);
    expectLib.expect(entry.ns).toBe('');
    expectLib.expect(entry.repl).toBe('');
  });

  it('menu and key paths resolve to the same catalog entry (including ns)', () => {
    const { snippetsDict, snippetsMenuItems } = catalog.buildSnippetCatalog(
      [resetSnippet],
      editorNS,
      editorRepl
    );

    const fromMenu = catalog.resolveCustomSnippetDefinition({
      snippetsDict,
      menuSnippetDefinition: snippetsMenuItems[0].snippetDefinition,
    });
    const fromKey = catalog.resolveCustomSnippetDefinition({
      codeOrKey: 'r',
      snippetsDict,
    });

    expectLib.expect(fromMenu).toEqual(fromKey);
    expectLib.expect(fromMenu).toMatchObject({
      name: 'Reset',
      snippet: '(reset)',
      ns: 'user',
      repl: 'clj',
      key: 'r',
    });
  });

  it('does not treat a slim QuickPick facade as the definition', () => {
    const { snippetsDict, snippetsMenuItems } = catalog.buildSnippetCatalog(
      [resetSnippet],
      editorNS,
      editorRepl
    );
    const slimFacade = {
      label: snippetsMenuItems[0].label,
      detail: snippetsMenuItems[0].detail,
      description: snippetsMenuItems[0].description,
      repl: 'clj',
      snippet: '(reset)',
    };

    const wrongIfUsedAsDefinition = catalog.resolveCustomSnippetDefinition({
      snippetsDict,
      menuSnippetDefinition: slimFacade as unknown as catalog.CustomREPLCommandSnippet,
    });
    const fromCatalog = catalog.resolveCustomSnippetDefinition({
      snippetsDict,
      menuSnippetDefinition: snippetsMenuItems[0].snippetDefinition,
    });

    expectLib
      .expect((wrongIfUsedAsDefinition as catalog.CustomREPLCommandSnippet).ns)
      .toBeUndefined();
    expectLib.expect((fromCatalog as catalog.CustomREPLCommandSnippet).ns).toBe('user');
  });

  it('keyless snippets still carry ns via the menu catalog entry', () => {
    const keyless: catalog.CustomREPLCommandSnippet = {
      name: 'Reset',
      snippet: '(reset)',
      ns: 'user',
    };
    const { snippetsDict, snippetsMenuItems } = catalog.buildSnippetCatalog(
      [keyless],
      editorNS,
      editorRepl
    );

    expectLib.expect(Object.keys(snippetsDict)).toHaveLength(0);
    const fromMenu = catalog.resolveCustomSnippetDefinition({
      snippetsDict,
      menuSnippetDefinition: snippetsMenuItems[0].snippetDefinition,
    }) as catalog.CustomREPLCommandSnippet;
    expectLib.expect(fromMenu.ns).toBe('user');
  });
});

describe('custom REPL commands in the REPL Input', () => {
  const context = { ns: 'my.app', nsForm: '(ns my.app)', sessionKey: 'clj' };
  const evaluation = (snippet: catalog.SnippetDefinition, notation: string) =>
    catalog.replInputSnippetEvaluation(
      snippet,
      textNotation.docFromTextNotation(notation),
      context
    );

  it("substitutes the forms, the cursor and the namespace from the REPL Input's text and context", () => {
    expectLib
      .expect(
        evaluation(
          { snippet: '[$current-form $enclosing-form $top-level-form $ns $repl $line $column]' },
          '(def a 1)•(foo (bar |b) [x y])'
        )
      )
      .toEqual({
        code: '[b (bar b) (foo (bar b) [x y]) my.app clj 1 10]',
        ns: 'my.app',
        nsForm: '(ns my.app)',
        sessionKey: 'clj',
        sendCode: true,
      });
  });

  it('substitutes the selection, and the REPL Input text for the file text, and no file', () => {
    expectLib
      .expect(
        evaluation(
          { snippet: '[$selection $selection-closing-brackets "$file" $file-text]' },
          '(a |(b c|) d)'
        ).code
      )
      .toBe('[(b c (b c) "" (a (b c) d)]');
  });

  it("evaluates in the snippet's own namespace and session", () => {
    expectLib
      .expect(evaluation({ snippet: '(x)', ns: 'other.ns' }, '|(x)'))
      .toMatchObject({ ns: 'other.ns', nsForm: "(in-ns 'other.ns)", sessionKey: 'clj' });
    expectLib
      .expect(evaluation({ snippet: '(x)', repl: 'cljs' }, '|(x)'))
      .toMatchObject({ ns: undefined, nsForm: undefined, sessionKey: 'cljs' });
  });

  it('leaves the code out of the output when the snippet says so', () => {
    expectLib
      .expect(evaluation({ snippet: '(x)', evaluationSendCodeToOutputWindow: false }, '|(x)'))
      .toMatchObject({ sendCode: false });
  });
});
