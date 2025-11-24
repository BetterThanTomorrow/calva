import * as expect from 'expect';
import type { ReplConnectSequence } from '../../../../src/nrepl/connect-sequence-types';
import * as sessionRoles from '../../../../src/nrepl/session-roles';

const baseSequence = (): ReplConnectSequence => ({
  name: 'Custom',
  projectType: 'deps.edn' as unknown as ReplConnectSequence['projectType'],
  cljsType: 'none' as unknown as ReplConnectSequence['cljsType'],
});

describe('session role glob derivation', () => {
  it('provides default globs for default session names', () => {
    expect(sessionRoles.deriveSessionGlobMap()).toEqual({
      clj: { primary: ['**/*.clj'], secondary: [] },
    });
  });

  it('includes promoted defaults when the cljs type requires it', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];

    expect(sessionRoles.deriveSessionGlobMap(sequence)).toEqual({
      clj: { primary: ['**/*.clj'], secondary: [] },
      cljs: { primary: ['**/*.cljs'], secondary: [] },
    });
  });

  it('treats custom cljs configs depending on promoted types as promoted', () => {
    const sequence = baseSequence();
    sequence.cljsType = {
      name: 'custom-browser',
      dependsOn: 'shadow-cljs',
      isStarted: true,
      connectCode: '',
    } as unknown as ReplConnectSequence['cljsType'];

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.clj).toEqual({ primary: ['**/*.clj'], secondary: [] });
    expect(result.cljs).toEqual({ primary: ['**/*.cljs'], secondary: [] });
  });

  it('applies default globs to renamed sessions', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];
    sequence.replSessionNames = { main: 'clj2', promoted: 'cljs2' };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.clj2).toEqual({ primary: ['**/*.clj'], secondary: [] });
    expect(result.cljs2).toEqual({ primary: ['**/*.cljs'], secondary: [] });
  });

  it('prefers custom globs keyed by the session name', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];
    sequence.replSessionNames = { main: 'alpha', promoted: 'beta' };
    sequence.replSessionGlobs = {
      alpha: ['apps/**/server.clj'],
      beta: ['ui/**/*.cljs'],
    };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.alpha).toEqual({ primary: ['apps/**/server.clj'], secondary: [] });
    expect(result.beta).toEqual({ primary: ['ui/**/*.cljs'], secondary: [] });
  });

  it('supports glob overrides keyed by role names', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];
    sequence.replSessionNames = { main: 'gamma', promoted: 'delta' };
    sequence.replSessionGlobs = {
      main: ['services/**/*.clj'],
      promoted: ['clients/**/*.cljs'],
    };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.gamma).toEqual({ primary: ['services/**/*.clj'], secondary: [] });
    expect(result.delta).toEqual({ primary: ['clients/**/*.cljs'], secondary: [] });
  });

  it('retains additional session glob mappings for future sessions', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];
    sequence.replSessionNames = { main: 'core', promoted: 'ui' };
    sequence.replSessionGlobs = {
      core: '**/*.clj',
      ui: ['**/*.cljs'],
      extra: ['lambda/**/*.clj'],
    };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.extra).toEqual({ primary: ['lambda/**/*.clj'], secondary: [] });
  });

  it('trims whitespace and filters empty glob entries', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];
    sequence.replSessionNames = { main: 'alpha', promoted: 'beta' };
    sequence.replSessionGlobs = {
      alpha: ['  src/**/*.clj  ', '   '],
      beta: ' ui/**/*.cljs ',
    };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.alpha).toEqual({ primary: ['src/**/*.clj'], secondary: [] });
    expect(result.beta).toEqual({ primary: ['ui/**/*.cljs'], secondary: [] });
  });

  it('falls back to defaults when overrides resolve to empty globs', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];
    sequence.replSessionNames = { main: 'alpha', promoted: 'beta' };
    sequence.replSessionGlobs = {
      alpha: ['   ', '\t'],
      beta: [],
    };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.alpha).toEqual({ primary: ['**/*.clj'], secondary: [] });
    expect(result.beta).toEqual({ primary: ['**/*.cljs'], secondary: [] });
  });

  it('supports tiered primary/secondary configurations', () => {
    const sequence = baseSequence();
    sequence.replSessionNames = { main: 'bb' };
    sequence.replSessionGlobs = {
      bb: {
        primary: ['**/*.bb'],
        secondary: ['**/*.clj', '**/*.cljc'],
      },
    };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.bb).toEqual({
      primary: ['**/*.bb'],
      secondary: ['**/*.clj', '**/*.cljc'],
    });
  });
});
