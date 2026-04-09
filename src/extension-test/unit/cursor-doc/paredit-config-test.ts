import { expect } from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as pareditConfig from '../../../cursor-doc/paredit-config';
import * as model from '../../../cursor-doc/model';
import { docFromTextNotation, getText, textAndSelection } from '../common/text-notation';

model.initScanner(20000);

describe('paredit-config', () => {
  describe('createPareditConfig', () => {
    it('returns default config when no custom forms provided', () => {
      const config = pareditConfig.createPareditConfig();
      expect(config.pairForms['vector-binding'].length).toBeGreaterThan(0);
      expect(config.pairForms.keyword.length).toBeGreaterThan(0);
      expect(config.pairForms.flat.length).toBeGreaterThan(0);
      expect(config.threadingMacros.firstArg).toContain('->');
      expect(config.threadingMacros.lastArg).toContain('->>');
    });

    it('appends custom vector-binding forms to defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'vector-binding', name: 'my.ns/custom-let' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const names = config.pairForms['vector-binding'].map((f) => f.name);
      expect(names).toContain('my.ns/custom-let');
      expect(names).toContain('let'); // default still present
    });

    it('appends custom flat forms to defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const names = config.pairForms.flat.map((f) => f.name);
      expect(names).toContain('match');
      expect(names).toContain('cond'); // default still present
    });

    it('filters out duplicate custom forms that match defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'cond', offset: 2 }, // duplicate of default (offset: 1)
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const condForms = config.pairForms.flat.filter((f) => f.name === 'cond');
      expect(condForms.length).toBe(1); // only default present, no duplicate
      expect(condForms[0].offset).toBe(1); // default offset preserved
    });

    it('appends custom keyword forms to defaults', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'keyword', keyword: ':when', validParents: ['for'] },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const keywords = config.pairForms.keyword.map((f) => f.keyword);
      expect(keywords).toContain(':when');
      expect(keywords).toContain(':let'); // default still present
    });

    it('appends custom threading macros to defaults', () => {
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['as->', 'my-custom->'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      expect(config.threadingMacros.firstArg).toContain('as->');
      expect(config.threadingMacros.firstArg).toContain('my-custom->');
      expect(config.threadingMacros.firstArg).toContain('->'); // default still present
    });

    it('handles forms with tripleMarker', () => {
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'my-condp', offset: 3, tripleMarker: ':custom' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      const form = config.pairForms.flat.find((f) => f.name === 'my-condp');
      expect(form?.tripleMarker).toBe(':custom');
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
      expect(grouped['vector-binding'].length).toBe(1);
      expect(grouped.flat.length).toBe(1);
      expect(grouped.keyword.length).toBe(1);
    });

    it('handles empty array', () => {
      const grouped = pareditConfig.groupPairForms([]);
      expect(grouped['vector-binding'].length).toBe(0);
      expect(grouped.flat.length).toBe(0);
      expect(grouped.keyword.length).toBe(0);
    });
  });

  describe('Custom pair forms in paredit operations', () => {
    it('growSelection works with custom vector-binding form', () => {
      const a = docFromTextNotation('(my-ns/let [x| 1])');
      const b = docFromTextNotation('(my-ns/let [|x 1|])');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'vector-binding', name: 'my-ns/let' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('growSelection works with custom flat form', () => {
      const a = docFromTextNotation('(match x| 1 :one 2 :two)');
      const b = docFromTextNotation('(match |x 1| :one 2 :two)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('growSelection works with custom keyword form', () => {
      const a = docFromTextNotation('(for [x xs :when| true] x)');
      const b = docFromTextNotation('(for [x xs |:when true|] x)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'keyword', keyword: ':when', validParents: ['for'] },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('dragSexprForward works with custom flat form', async () => {
      const a = docFromTextNotation('(match |x 1 :a 2)');
      const b = docFromTextNotation('(match :a 2 |x 1)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      await paredit.dragSexprForward(a, a.selections[0].anchor, a.selections[0].active, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('dragSexprBackward works with custom flat form', async () => {
      const a = docFromTextNotation('(match x 1 |:a 2)');
      const b = docFromTextNotation('(match |:a 2 x 1)');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      await paredit.dragSexprBackward(a, a.selections[0].anchor, a.selections[0].active, config);
      expect(getText(a)).toBe(getText(b));
    });
  });

  describe('Custom threading macros', () => {
    it('detects custom firstArg threading macro', () => {
      const a = docFromTextNotation('(as-> x $ (|assoc :a 1 :b 2))');
      const b = docFromTextNotation('(as-> x $ (|assoc :a 1| :b 2))');
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['as->'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('detects custom lastArg threading macro', () => {
      const a = docFromTextNotation('(my->> x (|assoc {} :a 1 :b))');
      const b = docFromTextNotation('(my->> x (|assoc {} :a 1| :b))');
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        lastArg: ['my->>'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('applies offset reduction in -> style custom macro', () => {
      const a = docFromTextNotation('(my-> {} (|assoc :a 1 :b 2))');
      const b = docFromTextNotation('(my-> {} (|assoc :a 1| :b 2))');
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['my->'],
      };
      const config = pareditConfig.createPareditConfig([], customThreading);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });
  });

  describe('Combined custom forms and threading', () => {
    it('works with custom form inside custom threading macro', () => {
      const a = docFromTextNotation('(my-> x (match |1 :one 2 :two))');
      const b = docFromTextNotation('(my-> x (match |1 :one| 2 :two))');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'flat', name: 'match', offset: 1 },
      ];
      const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
        firstArg: ['my->'],
      };
      const config = pareditConfig.createPareditConfig(customForms, customThreading);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('respects namespace-qualified custom binding form', () => {
      const a = docFromTextNotation('(my.ns/let [x| 1 y 2] (+ x y))');
      const b = docFromTextNotation('(my.ns/let [|x 1| y 2] (+ x y))');
      const customForms: pareditConfig.PairFormConfig[] = [
        { type: 'vector-binding', name: 'my.ns/let' },
      ];
      const config = pareditConfig.createPareditConfig(customForms);
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });
  });

  it('drags individual sexp when pair behavior is disabled for assoc', async () => {
    const a = docFromTextNotation('(assoc m |:a "one" :b "two")');
    const b = docFromTextNotation('(assoc m "one" |:a :b "two")');
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
    expect(textAndSelection(a)).toEqual(textAndSelection(b));
  });

  describe('Alias resolution', () => {
    describe('resolveAliasedSymbol', () => {
      it('resolves aliased namespace', () => {
        expect(pareditConfig.resolveAliasedSymbol('p/let', { p: 'promesa.core' })).toBe(
          'promesa.core/let'
        );
      });

      it('resolves multiple aliases', () => {
        const aliasMap = { p: 'promesa.core', r: 'reagent.core' };
        expect(pareditConfig.resolveAliasedSymbol('p/let', aliasMap)).toBe('promesa.core/let');
        expect(pareditConfig.resolveAliasedSymbol('r/with-let', aliasMap)).toBe(
          'reagent.core/with-let'
        );
      });

      it('preserves unaliased symbols', () => {
        expect(pareditConfig.resolveAliasedSymbol('let', { p: 'promesa.core' })).toBe('let');
      });

      it('preserves fully qualified symbols when no alias match', () => {
        expect(pareditConfig.resolveAliasedSymbol('promesa.core/let', { p: 'other.ns' })).toBe(
          'promesa.core/let'
        );
      });

      it('returns original symbol when alias not in map', () => {
        expect(pareditConfig.resolveAliasedSymbol('x/let', { p: 'promesa.core' })).toBe('x/let');
      });

      it('handles empty alias map', () => {
        expect(pareditConfig.resolveAliasedSymbol('p/let', {})).toBe('p/let');
      });
    });

    describe('Aliased pair forms in paredit operations', () => {
      it('growSelection works with aliased vector-binding form', () => {
        const a = docFromTextNotation('(p/let [x| 1 y 2])');
        const b = docFromTextNotation('(p/let [|x 1| y 2])');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'vector-binding', name: 'promesa.core/let' },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('growSelection works with aliased flat form', () => {
        const a = docFromTextNotation('(m/match x| 1 :one 2 :two)');
        const b = docFromTextNotation('(m/match |x 1| :one 2 :two)');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('dragSexprForward works with aliased flat form', async () => {
        const a = docFromTextNotation('(m/match |x 1 :a 2)');
        const b = docFromTextNotation('(m/match :a 2 |x 1)');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        await paredit.dragSexprForward(a, a.selections[0].anchor, a.selections[0].active, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('dragSexprBackward works with aliased flat form', async () => {
        const a = docFromTextNotation('(m/match x 1 |:a 2)');
        const b = docFromTextNotation('(m/match |:a 2 x 1)');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        await paredit.dragSexprBackward(a, a.selections[0].anchor, a.selections[0].active, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('works with multiple aliases', () => {
        const a = docFromTextNotation('(p/let [x 1] (r/with-let [y| 2] y))');
        const b = docFromTextNotation('(p/let [x 1] (r/with-let [|y 2|] y))');
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
        expect(getText(a)).toBe(getText(b));
      });

      it('still works with fully qualified names when alias map provided', () => {
        const a = docFromTextNotation('(promesa.core/let [x| 1])');
        const b = docFromTextNotation('(promesa.core/let [|x 1|])');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'vector-binding', name: 'promesa.core/let' },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('works with aliased form inside threading macro', () => {
        const a = docFromTextNotation('(-> x (m/match |1 :one 2 :two))');
        const b = docFromTextNotation('(-> x (m/match |1 :one| 2 :two))');
        const customForms: pareditConfig.PairFormConfig[] = [
          { type: 'flat', name: 'my.ns/match', offset: 1 },
        ];
        const config = pareditConfig.createPareditConfig(customForms, {}, { m: 'my.ns' });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });
    });

    describe('js-interop/let vector-binding form', () => {
      it('applied-science.js-interop/let - grows selection to binding pairs', () => {
        const a = docFromTextNotation('(applied-science.js-interop/let [a b |c| d])');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(applied-science.js-interop/let [a b |c d|])');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });

    describe('js-interop flat pair forms', () => {
      it('applied-science.js-interop/assoc! - grows selection to key-value pairs', () => {
        const a = docFromTextNotation('(applied-science.js-interop/assoc! obj :a 1 |:b| 2)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(applied-science.js-interop/assoc! obj :a 1 |:b 2|)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });

      it('applied-science.js-interop/obj - grows selection to key-value pairs starting at offset 1', () => {
        const a = docFromTextNotation('(applied-science.js-interop/obj |:a| 1 :b 2)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(applied-science.js-interop/obj |:a 1| :b 2)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });

      it('applied-science.js-interop/assoc! - does not treat object argument as part of pair', () => {
        const a = docFromTextNotation('(applied-science.js-interop/assoc! |obj| :a 1 :b 2)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(|applied-science.js-interop/assoc! obj :a 1 :b 2|)');
        const bSelection = b.selections[0];
        paredit.growSelection(a);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });

      it('j/assoc! - works with alias map configuration', () => {
        const a = docFromTextNotation('(j/assoc! obj :a 1 |:b| 2)');
        const aSelection = a.selections[0];
        const b = docFromTextNotation('(j/assoc! obj :a 1 |:b 2|)');
        const bSelection = b.selections[0];
        const config = pareditConfig.createPareditConfig(
          [],
          {},
          { j: 'applied-science.js-interop' }
        );
        paredit.growSelection(a, a.selections, config);
        expect(a.selectionsStack).toEqual([[aSelection], [bSelection]]);
      });
    });

    describe('Aliased threading macros', () => {
      it('applies offset reduction for aliased thread-first macro', () => {
        const a = docFromTextNotation('(m/-> {} (assoc :a 1| :b 2))');
        const b = docFromTextNotation('(m/-> {} (assoc |:a 1| :b 2))');
        const customThreading = {
          firstArg: ['my.lib/thread-through'],
        };
        const config = pareditConfig.createPareditConfig([], customThreading, {
          m: 'my.lib',
        });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('works with default promesa thread-first using alias', () => {
        const a = docFromTextNotation('(p/-> {} (|assoc :a 1 :b 2))');
        const b = docFromTextNotation('(p/-> {} (|assoc :a 1| :b 2))');
        const config = pareditConfig.createPareditConfig([], {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('works with multiple aliased threading macros', () => {
        const a = docFromTextNotation('(p/-> x (m/thread-through (assoc |:a 1 :b 2)))');
        const b = docFromTextNotation('(p/-> x (m/thread-through (assoc |:a 1| :b 2)))');
        const customThreading = {
          firstArg: ['my.lib/thread-through'],
        };
        const config = pareditConfig.createPareditConfig([], customThreading, {
          p: 'promesa.core',
          m: 'my.lib',
        });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('works with aliased threading macro containing aliased pair form', () => {
        const a = docFromTextNotation('(p/-> x (m/match |1 :one 2 :two))');
        const b = docFromTextNotation('(p/-> x (m/match |1 :one| 2 :two))');
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
        expect(getText(a)).toBe(getText(b));
      });

      it('dragSexprForward works inside aliased threading macro', async () => {
        const a = docFromTextNotation('(m/-> {} (assoc |:a 1 :b 2))');
        const b = docFromTextNotation('(m/-> {} (assoc :b 2 |:a 1))');
        const config = pareditConfig.createPareditConfig(
          [],
          { firstArg: ['my-ns/->'] },
          {
            m: 'my-ns',
          }
        );
        await paredit.dragSexprForward(a, a.selections[0].anchor, a.selections[0].active, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('dragSexprBackward works inside aliased threading macro', async () => {
        const a = docFromTextNotation('(m/-> {} (assoc :a 1 |:b 2))');
        const b = docFromTextNotation('(m/-> {} (assoc |:b 2 :a 1))');
        const customThreading: Partial<pareditConfig.ThreadingMacrosConfig> = {
          firstArg: ['my-ns/->'],
        };
        const config = pareditConfig.createPareditConfig([], customThreading, {
          m: 'my-ns',
        });
        await paredit.dragSexprBackward(a, a.selections[0].anchor, a.selections[0].active, config);
        expect(getText(a)).toBe(getText(b));
      });

      it('works with default promesa thread-last using alias', () => {
        const a = docFromTextNotation('(p/->> x (assoc {} :a 1 :b|))');
        const b = docFromTextNotation('(p/->> x (|assoc {} :a 1 :b|))');
        const config = pareditConfig.createPareditConfig([], {}, { p: 'promesa.core' });
        paredit.growSelection(a, a.selections, config);
        expect(getText(a)).toBe(getText(b));
      });
    });
  });

  describe('isCommentFormHead', () => {
    it('returns true for "comment"', () => {
      expect(pareditConfig.isCommentFormHead('comment')).toBe(true);
    });

    it('returns false for undefined', () => {
      expect(pareditConfig.isCommentFormHead(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(pareditConfig.isCommentFormHead(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(pareditConfig.isCommentFormHead('')).toBe(false);
    });

    it('returns false for non-comment symbol without config', () => {
      expect(pareditConfig.isCommentFormHead('defn')).toBe(false);
    });

    it('returns true for custom comment form', () => {
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expect(pareditConfig.isCommentFormHead('my-comment', config)).toBe(true);
    });

    it('returns false for non-matching symbol with config', () => {
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expect(pareditConfig.isCommentFormHead('defn', config)).toBe(false);
    });

    it('resolves aliased custom comment form', () => {
      const config = {
        customCommentForms: ['my.ns/dev-comment'],
        aliasMap: { m: 'my.ns' },
      };
      expect(pareditConfig.isCommentFormHead('m/dev-comment', config)).toBe(true);
    });

    it('returns false for aliased symbol that does not match custom forms', () => {
      const config = {
        customCommentForms: ['my.ns/dev-comment'],
        aliasMap: { m: 'my.ns' },
      };
      expect(pareditConfig.isCommentFormHead('m/other', config)).toBe(false);
    });

    it('still recognizes "comment" even with config provided', () => {
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expect(pareditConfig.isCommentFormHead('comment', config)).toBe(true);
    });
  });

  describe('atTopLevel with custom comment forms', () => {
    it('treats custom comment form as top level', () => {
      const a = docFromTextNotation('(my-comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      const config = { customCommentForms: ['my-comment'], aliasMap: {} };
      expect(cursor.atTopLevel(true, config)).toBe(true);
    });

    it('does not treat custom comment form as top level without config', () => {
      const a = docFromTextNotation('(my-comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.atTopLevel(true)).toBe(false);
    });

    it('treats aliased custom comment form as top level', () => {
      const a = docFromTextNotation('(m/dev-comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      const config = {
        customCommentForms: ['my.ns/dev-comment'],
        aliasMap: { m: 'my.ns' },
      };
      expect(cursor.atTopLevel(true, config)).toBe(true);
    });

    it('still treats built-in comment as top level', () => {
      const a = docFromTextNotation('(comment |(+ 1 2))');
      const cursor = a.getTokenCursor(a.selections[0].anchor);
      expect(cursor.atTopLevel(true)).toBe(true);
    });
  });
});
