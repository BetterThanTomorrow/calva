import * as expect from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as pareditConfig from '../../../cursor-doc/paredit-config';
import * as model from '../../../cursor-doc/model';
import { docFromTextNotation, getText, textAndSelection } from '../common/text-notation';
import { defaultBindingForms } from '../../../cursor-doc/paredit-config';

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

  describe('Multi-threaded examples (nested threading)', () => {
    it('handles cond-> inside -> with assoc pairs (first expansion)', () => {
      const a = docFromTextNotation('(-> {} (cond-> true (assoc |:a "one")))');
      const b = docFromTextNotation('(-> {} (cond-> true (assoc |:a "one"|)))');
      const config = pareditConfig.createPareditConfig();
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('handles cond-> inside -> with assoc form (second expansion)', () => {
      const a = docFromTextNotation('(-> {} (cond-> true |(assoc :a "one")))');
      const b = docFromTextNotation('(-> {} (cond-> |true (assoc :a "one")|))');
      const config = pareditConfig.createPareditConfig();
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('handles cond->> inside ->> with assoc pairs', () => {
      const a = docFromTextNotation('(->> {} (cond->> true (assoc |:a "one")))');
      const b = docFromTextNotation('(->> {} (cond->> true (assoc |:a "one"|)))');
      const config = pareditConfig.createPareditConfig();
      paredit.growSelection(a, a.selections, config);
      expect(getText(a)).toBe(getText(b));
    });

    it('handles cond->> inside ->> with condition pairs', () => {
      const a = docFromTextNotation('(->> {} (cond->> |true (assoc :a "one")))');
      const b = docFromTextNotation('(->> {} (cond->> |true (assoc :a "one")|))');
      const config = pareditConfig.createPareditConfig();
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
    };
    await paredit.dragSexprForward(a, undefined, undefined, customConfig);
    expect(textAndSelection(a)).toEqual(textAndSelection(b));
  });
});
