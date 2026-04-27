import * as expectLib from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as pareditConfig from '../../../cursor-doc/paredit-config';
import * as model from '../../../cursor-doc/model';
import * as textNotation from '../common/text-notation';

model.initScanner(20000);

describe('paredit-config', () => {
  describe('createPareditConfig', () => {
    it('returns default config when no custom forms provided', () => {
      const config = pareditConfig.createPareditConfig();
      expectLib.expect(config.pairForms['vector-binding'].length).toBeGreaterThan(0);
      expectLib.expect(config.pairForms.keyword.length).toBeGreaterThan(0);
      expectLib.expect(config.pairForms.flat.length).toBeGreaterThan(0);
      expectLib.expect(config.threadingMacros.firstArg).toContain('->');
      expectLib.expect(config.threadingMacros.lastArg).toContain('->>');
    });

    it('appends custom vector-binding forms to defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'vector-binding', name: 'my.ns/custom-let' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const names = config.pairForms['vector-binding'].map((f) => f.name);
      expectLib.expect(names).toContain('my.ns/custom-let');
      expectLib.expect(names).toContain('let'); // default still present
    });

    it('appends custom flat forms to defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const names = config.pairForms.flat.map((f) => f.name);
      expectLib.expect(names).toContain('match');
      expectLib.expect(names).toContain('cond'); // default still present
    });

    it('filters out duplicate custom forms that match defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'cond', offset: 2 }, // duplicate of default (offset: 1)
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const condForms = config.pairForms.flat.filter((f) => f.name === 'cond');
      expectLib.expect(condForms.length).toBe(1); // only default present, no duplicate
      expectLib.expect(condForms[0].offset).toBe(1); // default offset preserved
    });

    it('appends custom keyword forms to defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'keyword', keyword: ':when', validParents: ['for'] },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const keywords = config.pairForms.keyword.map((f) => f.keyword);
      expectLib.expect(keywords).toContain(':when');
      expectLib.expect(keywords).toContain(':let'); // default still present
    });

    it('appends custom threading macros to defaults', () => {
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['as->', 'my-custom->'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      expectLib.expect(config.threadingMacros.firstArg).toContain('as->');
      expectLib.expect(config.threadingMacros.firstArg).toContain('my-custom->');
      expectLib.expect(config.threadingMacros.firstArg).toContain('->'); // default still present
    });

    it('handles forms with tripleMarker', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'my-condp', offset: 3, tripleMarker: ':custom' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const form = config.pairForms.flat.find((f) => f.name === 'my-condp');
      expectLib.expect(form?.tripleMarker).toBe(':custom');
    });
  });

  describe('groupPairForms', () => {
    it('groups forms by type', () => {
      const forms: pareditConfig.PairFormConfig[] = [
        { type: 'vector-binding', name: 'let' },
        { type: 'flat', name: 'cond', offset: 1 },
        { type: 'keyword', keyword: ':let' },
      ];
      const grouped = pareditConfig.groupPairForms(forms);
      expectLib.expect(grouped['vector-binding'].length).toBe(1);
      expectLib.expect(grouped.flat.length).toBe(1);
      expectLib.expect(grouped.keyword.length).toBe(1);
    });

    it('handles empty array', () => {
      const grouped = pareditConfig.groupPairForms([]);
      expectLib.expect(grouped['vector-binding'].length).toBe(0);
      expectLib.expect(grouped.flat.length).toBe(0);
      expectLib.expect(grouped.keyword.length).toBe(0);
    });
  });

  describe('Custom pair forms in paredit operations', () => {
    it('growSelection works with custom vector-binding form', () => {
      const a = textNotation.docFromTextNotation('(my-ns/let [x| 1])');
      const b = textNotation.docFromTextNotation('(my-ns/let [|x 1|])');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'vector-binding', name: 'my-ns/let' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });

    it('growSelection works with custom flat form', () => {
      const a = textNotation.docFromTextNotation('(match x| 1 :one 2 :two)');
      const b = textNotation.docFromTextNotation('(match |x 1| :one 2 :two)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });

    it('growSelection works with custom keyword form', () => {
      const a = textNotation.docFromTextNotation('(for [x xs :when| true] x)');
      const b = textNotation.docFromTextNotation('(for [x xs |:when true|] x)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'keyword', keyword: ':when', validParents: ['for'] },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });

    it('dragSexprForward works with custom flat form', async () => {
      const a = textNotation.docFromTextNotation('(match |x 1 :a 2)');
      const b = textNotation.docFromTextNotation('(match :a 2 |x 1)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      await paredit.dragSexprForward(a, a.selections[0].anchor, a.selections[0].active, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });

    it('dragSexprBackward works with custom flat form', async () => {
      const a = textNotation.docFromTextNotation('(match x 1 |:a 2)');
      const b = textNotation.docFromTextNotation('(match |:a 2 x 1)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      await paredit.dragSexprBackward(a, a.selections[0].anchor, a.selections[0].active, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });
  });

  describe('Custom threading macros', () => {
    it('detects custom firstArg threading macro', () => {
      const a = textNotation.docFromTextNotation('(as-> x $ (|assoc :a 1 :b 2))');
      const b = textNotation.docFromTextNotation('(as-> x $ (|assoc :a 1| :b 2))');
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['as->'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });

    it('detects custom lastArg threading macro', () => {
      const a = textNotation.docFromTextNotation('(my->> x (|assoc {} :a 1 :b))');
      const b = textNotation.docFromTextNotation('(my->> x (|assoc {} :a 1| :b))');
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        lastArg: ['my->>'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });

    it('applies offset reduction in -> style custom macro', () => {
      const a = textNotation.docFromTextNotation('(my-> {} (|assoc :a 1 :b 2))');
      const b = textNotation.docFromTextNotation('(my-> {} (|assoc :a 1| :b 2))');
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['my->'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });
  });

  describe('Combined custom forms and threading', () => {
    it('works with custom form inside custom threading macro', () => {
      const a = textNotation.docFromTextNotation('(my-> x (match |1 :one 2 :two))');
      const b = textNotation.docFromTextNotation('(my-> x (match |1 :one| 2 :two))');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['my->'],
      };
      const config = pareditConfig.createPareditConfig(customForms, customThreading);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });

    it('respects namespace-qualified custom binding form', () => {
      const a = textNotation.docFromTextNotation('(my.ns/let [x| 1 y 2] (+ x y))');
      const b = textNotation.docFromTextNotation('(my.ns/let [|x 1| y 2] (+ x y))');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'vector-binding', name: 'my.ns/let' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
    });
  });

  it('drags individual sexp when pair behavior is disabled for assoc', async () => {
    const a = textNotation.docFromTextNotation('(assoc m |:a "one" :b "two")');
    const b = textNotation.docFromTextNotation('(assoc m "one" |:a :b "two")');
    // Create config without assoc in flat pair forms
    const customConfig = {
      pairForms: {
        'vector-binding': [],
        keyword: [],
        flat: [],
      },
      threadingMacros: {
        firstArg: ['->', 'some->'],
        lastArg: ['->>', 'some->>'],
      },
      aliasMap: {},
    };
    await paredit.dragSexprForward(a, undefined, undefined, customConfig);
    expectLib.expect(textNotation.textAndSelection(a)).toEqual(textNotation.textAndSelection(b));
  });

  describe('Alias resolution', () => {
    describe('resolveAliasedSymbol', () => {
      it('resolves aliased namespace', () => {
        expectLib
          .expect(pareditConfig.resolveAliasedSymbol('p/let', { p: 'promesa.core' }))
          .toBe('promesa.core/let');
      });

      it('resolves multiple aliases', () => {
        const aliasMap = { p: 'promesa.core', r: 'reagent.core' };
        expectLib
          .expect(pareditConfig.resolveAliasedSymbol('p/let', aliasMap))
          .toBe('promesa.core/let');
        expectLib
          .expect(pareditConfig.resolveAliasedSymbol('r/with-let', aliasMap))
          .toBe('reagent.core/with-let');
      });

      it('preserves unaliased symbols', () => {
        expectLib
          .expect(pareditConfig.resolveAliasedSymbol('let', { p: 'promesa.core' }))
          .toBe('let');
      });

      it('preserves fully qualified symbols when no alias match', () => {
        expectLib
          .expect(pareditConfig.resolveAliasedSymbol('promesa.core/let', { p: 'other.ns' }))
          .toBe('promesa.core/let');
      });

      it('returns original symbol when alias not in map', () => {
        expectLib
          .expect(pareditConfig.resolveAliasedSymbol('x/let', { p: 'promesa.core' }))
          .toBe('x/let');
      });

      it('handles empty alias map', () => {
        expectLib.expect(pareditConfig.resolveAliasedSymbol('p/let', {})).toBe('p/let');
      });
    });

    describe('Aliased pair forms in paredit operations', () => {
      it('growSelection works with aliased vector-binding form', () => {
        const a = textNotation.docFromTextNotation('(p/let [x| 1 y 2])');
        const b = textNotation.docFromTextNotation('(p/let [|x 1| y 2])');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'vector-binding', name: 'promesa.core/let' },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('growSelection works with aliased flat form', () => {
        const a = textNotation.docFromTextNotation('(m/match x| 1 :one 2 :two)');
        const b = textNotation.docFromTextNotation('(m/match |x 1| :one 2 :two)');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('dragSexprForward works with aliased flat form', async () => {
        const a = textNotation.docFromTextNotation('(m/match |x 1 :a 2)');
        const b = textNotation.docFromTextNotation('(m/match :a 2 |x 1)');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        await paredit.dragSexprForward(a, a.selections[0].anchor, a.selections[0].active, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('dragSexprBackward works with aliased flat form', async () => {
        const a = textNotation.docFromTextNotation('(m/match x 1 |:a 2)');
        const b = textNotation.docFromTextNotation('(m/match |:a 2 x 1)');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        await paredit.dragSexprBackward(a, a.selections[0].anchor, a.selections[0].active, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('works with multiple aliases', () => {
        const a = textNotation.docFromTextNotation('(p/let [x 1] (r/with-let [y| 2] y))');
        const b = textNotation.docFromTextNotation('(p/let [x 1] (r/with-let [|y 2|] y))');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'vector-binding', name: 'promesa.core/let' },
          { type: 'vector-binding', name: 'reagent.core/with-let' },
        ];
        const config = pareditConfig.createPareditConfig(
          customForms,
          {},
          { p: 'promesa.core', r: 'reagent.core' }
        );
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('still works with fully qualified names when alias map provided', () => {
        const a = textNotation.docFromTextNotation('(promesa.core/let [x| 1])');
        const b = textNotation.docFromTextNotation('(promesa.core/let [|x 1|])');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'vector-binding', name: 'promesa.core/let' },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('works with aliased form inside threading macro', () => {
        const a = textNotation.docFromTextNotation('(-> x (m/match |1 :one 2 :two))');
        const b = textNotation.docFromTextNotation('(-> x (m/match |1 :one| 2 :two))');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });
    });

    describe('js-interop/let vector-binding form', () => {
      it('applied-science.js-interop/let - grows selection to binding pairs', () => {
        const a = textNotation.docFromTextNotation('(applied-science.js-interop/let [a b |c| d])');
        const aSelection = a.selections[0];
        const b = textNotation.docFromTextNotation('(applied-science.js-interop/let [a b |c d|])');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expectLib.expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });

    describe('js-interop flat pair forms', () => {
      it('applied-science.js-interop/assoc! - grows selection to key-value pairs', () => {
        const a = textNotation.docFromTextNotation(
          '(applied-science.js-interop/assoc! obj :a 1 |:b| 2)'
        );
        const aSelection = a.selections[0];
        const b = textNotation.docFromTextNotation(
          '(applied-science.js-interop/assoc! obj :a 1 |:b 2|)'
        );
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expectLib.expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });

      it('applied-science.js-interop/obj - grows selection to key-value pairs starting at offset 1', () => {
        const a = textNotation.docFromTextNotation('(applied-science.js-interop/obj |:a| 1 :b 2)');
        const aSelection = a.selections[0];
        const b = textNotation.docFromTextNotation('(applied-science.js-interop/obj |:a 1| :b 2)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expectLib.expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });

      it('applied-science.js-interop/assoc! - does not treat object argument as part of pair', () => {
        const a = textNotation.docFromTextNotation(
          '(applied-science.js-interop/assoc! |obj| :a 1 :b 2)'
        );
        const aSelection = a.selections[0];
        const b = textNotation.docFromTextNotation(
          '(|applied-science.js-interop/assoc! obj :a 1 :b 2|)'
        );
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expectLib.expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });

      it('j/assoc! - works with alias map configuration', () => {
        const a = textNotation.docFromTextNotation('(j/assoc! obj :a 1 |:b| 2)');
        const aSelection = a.selections[0];
        const b = textNotation.docFromTextNotation('(j/assoc! obj :a 1 |:b 2|)');
        const bSelection = b.selections[0];
        const config = pareditConfig.createPareditConfig(
          [],
          {},
          { j: 'applied-science.js-interop' }
        );
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });

    describe('Aliased threading macros', () => {
      it('applies offset reduction for aliased thread-first macro', () => {
        const a = textNotation.docFromTextNotation('(m/-> {} (assoc :a 1| :b 2))');
        const b = textNotation.docFromTextNotation('(m/-> {} (assoc |:a 1| :b 2))');
        const customThreading = {
          firstArg: ['my.lib/thread-through'],
        };
        const config = pareditConfig.createPareditConfig([], customThreading, {
          m: 'my.lib',
        });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('works with default promesa thread-first using alias', () => {
        const a = textNotation.docFromTextNotation('(p/-> {} (|assoc :a 1 :b 2))');
        const b = textNotation.docFromTextNotation('(p/-> {} (|assoc :a 1| :b 2))');
        const config = pareditConfig.createPareditConfig([], {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('works with multiple aliased threading macros', () => {
        const a = textNotation.docFromTextNotation(
          '(p/-> x (m/thread-through (assoc |:a 1 :b 2)))'
        );
        const b = textNotation.docFromTextNotation(
          '(p/-> x (m/thread-through (assoc |:a 1| :b 2)))'
        );
        const customThreading = {
          firstArg: ['my.lib/thread-through'],
        };
        const config = pareditConfig.createPareditConfig([], customThreading, {
          p: 'promesa.core',
          m: 'my.lib',
        });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('works with aliased threading macro containing aliased pair form', () => {
        const a = textNotation.docFromTextNotation('(p/-> x (m/match |1 :one 2 :two))');
        const b = textNotation.docFromTextNotation('(p/-> x (m/match |1 :one| 2 :two))');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(
          customForms,
          {},
          {
            p: 'promesa.core',
            m: 'my.ns',
          }
        );
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('dragSexprForward works inside aliased threading macro', async () => {
        const a = textNotation.docFromTextNotation('(m/-> {} (assoc |:a 1 :b 2))');
        const b = textNotation.docFromTextNotation('(m/-> {} (assoc :b 2 |:a 1))');
        const config = pareditConfig.createPareditConfig(
          [],
          { firstArg: ['my-ns/->'] },
          {
            m: 'my-ns',
          }
        );
        await paredit.dragSexprForward(a, a.selections[0].anchor, a.selections[0].active, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('dragSexprBackward works inside aliased threading macro', async () => {
        const a = textNotation.docFromTextNotation('(m/-> {} (assoc :a 1 |:b 2))');
        const b = textNotation.docFromTextNotation('(m/-> {} (assoc |:b 2 :a 1))');
        const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
          firstArg: ['my-ns/->'],
        };
        const config = pareditConfig.createPareditConfig([], customThreading, {
          m: 'my-ns',
        });
        await paredit.dragSexprBackward(a, a.selections[0].anchor, a.selections[0].active, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });

      it('works with default promesa thread-last using alias', () => {
        const a = textNotation.docFromTextNotation('(p/->> x (assoc {} :a 1 :b|))');
        const b = textNotation.docFromTextNotation('(p/->> x (|assoc {} :a 1 :b|))');
        const config = pareditConfig.createPareditConfig([], {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expectLib.expect(textNotation.getText(a)).toBe(textNotation.getText(b));
      });
    });
  });

  describe('isCommentFormHead', () => {
    it('returns true for "comment"', () => {
      expectLib.expect(pareditConfig.isCommentFormHead('comment')).toBe(true);
    });

    it('returns false for undefined', () => {
      expectLib.expect(pareditConfig.isCommentFormHead(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expectLib.expect(pareditConfig.isCommentFormHead(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expectLib.expect(pareditConfig.isCommentFormHead('')).toBe(false);
    });

    it('returns false for non-comment symbol without config', () => {
      expectLib.expect(pareditConfig.isCommentFormHead('defn')).toBe(false);
    });

    it('returns true for custom comment form', () => {
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expectLib.expect(pareditConfig.isCommentFormHead('my-comment', config)).toBe(true);
    });

    it('returns false for non-matching symbol with config', () => {
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expectLib.expect(pareditConfig.isCommentFormHead('defn', config)).toBe(false);
    });

    it('resolves aliased custom comment form', () => {
      const config = {
        customCommentForms: ['my.ns/dev-comment'],
        aliasMap: { m: 'my.ns' },
      };
      expectLib.expect(pareditConfig.isCommentFormHead('m/dev-comment', config)).toBe(true);
    });

    it('returns false for aliased symbol that does not match custom forms', () => {
      const config = {
        customCommentForms: ['my.ns/dev-comment'],
        aliasMap: { m: 'my.ns' },
      };
      expectLib.expect(pareditConfig.isCommentFormHead('m/other', config)).toBe(false);
    });

    it('still recognizes "comment" even with config provided', () => {
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expectLib.expect(pareditConfig.isCommentFormHead('comment', config)).toBe(true);
    });
  });

  describe('atTopLevel with custom comment forms', () => {
    it('treats custom comment form as top level', () => {
      const a = textNotation.docFromTextNotation('(my-comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expectLib.expect(cursor.atTopLevel(true, config)).toBe(true);
    });

    it('does not treat custom comment form as top level without config', () => {
      const a = textNotation.docFromTextNotation('(my-comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib.expect(cursor.atTopLevel(true)).toBe(false);
    });

    it('treats aliased custom comment form as top level', () => {
      const a = textNotation.docFromTextNotation('(m/dev-comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      const config = {
        customCommentForms: ['my.ns/dev-comment'],
        aliasMap: { m: 'my.ns' },
      };
      expectLib.expect(cursor.atTopLevel(true, config)).toBe(true);
    });

    it('still treats built-in comment as top level', () => {
      const a = textNotation.docFromTextNotation('(comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      expectLib.expect(cursor.atTopLevel(true)).toBe(true);
    });
  });
});
