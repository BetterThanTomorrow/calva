import * as expectLib from 'expect';
import * as catalog from '../../custom-snippets-catalog';

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
