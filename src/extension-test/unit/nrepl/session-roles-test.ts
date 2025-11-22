import * as expect from 'expect';
import { ReplConnectSequence } from '../../../../src/nrepl/connectSequence';
import { deriveSessionGlobMap } from '../../../../src/nrepl/session-roles';

const baseSequence = (): ReplConnectSequence => ({
  name: 'Custom',
  projectType: 'deps.edn' as unknown as ReplConnectSequence['projectType'],
  cljsType: 'none' as unknown as ReplConnectSequence['cljsType'],
});

describe('session role glob derivation', () => {
  it('provides default globs for default session names', () => {
    expect(deriveSessionGlobMap()).toEqual({
      clj: ['**/*.clj'],
      cljs: ['**/*.cljs'],
    });
  });

  it('applies default globs to renamed sessions', () => {
    const sequence = baseSequence();
    sequence.replSessionNames = { primary: 'clj2', promoted: 'cljs2' };

    const result = deriveSessionGlobMap(sequence);

    expect(result.clj2).toEqual(['**/*.clj']);
    expect(result.cljs2).toEqual(['**/*.cljs']);
  });

  it('prefers custom globs keyed by the session name', () => {
    const sequence = baseSequence();
    sequence.replSessionNames = { primary: 'alpha', promoted: 'beta' };
    sequence.replSessionGlobs = {
      alpha: ['apps/**/server.clj'],
      beta: ['ui/**/*.cljs'],
    };

    const result = deriveSessionGlobMap(sequence);

    expect(result.alpha).toEqual(['apps/**/server.clj']);
    expect(result.beta).toEqual(['ui/**/*.cljs']);
  });

  it('supports glob overrides keyed by role names', () => {
    const sequence = baseSequence();
    sequence.replSessionNames = { primary: 'gamma', promoted: 'delta' };
    sequence.replSessionGlobs = {
      primary: ['services/**/*.clj'],
      promoted: ['clients/**/*.cljs'],
    };

    const result = deriveSessionGlobMap(sequence);

    expect(result.gamma).toEqual(['services/**/*.clj']);
    expect(result.delta).toEqual(['clients/**/*.cljs']);
  });

  it('retains additional session glob mappings for future sessions', () => {
    const sequence = baseSequence();
    sequence.replSessionNames = { primary: 'core', promoted: 'ui' };
    sequence.replSessionGlobs = {
      core: '**/*.clj',
      ui: ['**/*.cljs'],
      extra: ['lambda/**/*.clj'],
    };

    const result = deriveSessionGlobMap(sequence);

    expect(result.extra).toEqual(['lambda/**/*.clj']);
  });
});
