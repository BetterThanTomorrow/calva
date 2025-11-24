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
      clj: ['**/*.clj'],
    });
  });

  it('includes promoted defaults when the cljs type requires it', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];

    expect(sessionRoles.deriveSessionGlobMap(sequence)).toEqual({
      clj: ['**/*.clj'],
      cljs: ['**/*.cljs'],
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

    expect(result.clj).toEqual(['**/*.clj']);
    expect(result.cljs).toEqual(['**/*.cljs']);
  });

  it('applies default globs to renamed sessions', () => {
    const sequence = baseSequence();
    sequence.cljsType = 'shadow-cljs' as unknown as ReplConnectSequence['cljsType'];
    sequence.replSessionNames = { main: 'clj2', promoted: 'cljs2' };

    const result = sessionRoles.deriveSessionGlobMap(sequence);

    expect(result.clj2).toEqual(['**/*.clj']);
    expect(result.cljs2).toEqual(['**/*.cljs']);
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

    expect(result.alpha).toEqual(['apps/**/server.clj']);
    expect(result.beta).toEqual(['ui/**/*.cljs']);
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

    expect(result.gamma).toEqual(['services/**/*.clj']);
    expect(result.delta).toEqual(['clients/**/*.cljs']);
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

    expect(result.extra).toEqual(['lambda/**/*.clj']);
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

    expect(result.alpha).toEqual(['src/**/*.clj']);
    expect(result.beta).toEqual(['ui/**/*.cljs']);
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

    expect(result.alpha).toEqual(['**/*.clj']);
    expect(result.beta).toEqual(['**/*.cljs']);
  });
});
