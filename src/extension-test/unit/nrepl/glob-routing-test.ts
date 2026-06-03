import * as expectLib from 'expect';
import * as minimatchLib from 'minimatch';
import * as sessionRegistry from '../../../../src/nrepl/session-registry';
import * as globs from '../../../../src/nrepl/globs';
import type * as nrepl from '../../../../src/nrepl';

/**
 * Pure glob matching logic extracted for testing.
 * This mirrors the logic in repl-session.ts findSessionKeyForDocument
 * but without VS Code dependencies.
 */
function findSessionKeyByGlob(
  candidatePath: string,
  sessions: Array<{ key: string; globSpecs: globs.SessionGlobSpec[] }>
): string | undefined {
  const isBetterMatch = (
    current: { score: number; order: number } | undefined,
    candidate: { score: number; order: number }
  ) => {
    if (!current) {
      return true;
    }
    if (candidate.score !== current.score) {
      return candidate.score > current.score;
    }
    return candidate.order < current.order;
  };

  let bestAlwaysClaim: { sessionKey: string; score: number; order: number } | undefined;
  let bestFallback: { sessionKey: string; score: number; order: number } | undefined;

  sessions.forEach((session, index) => {
    const specs = session.globSpecs ?? [];
    for (const spec of specs) {
      const matched = minimatchLib.minimatch(candidatePath, spec.normalizedPattern, { dot: true });
      if (!matched) {
        continue;
      }
      const candidate = { sessionKey: session.key, score: spec.score, order: index };
      if (spec.tier === 'always-claim') {
        if (isBetterMatch(bestAlwaysClaim, candidate)) {
          bestAlwaysClaim = candidate;
        }
      } else {
        if (isBetterMatch(bestFallback, candidate)) {
          bestFallback = candidate;
        }
      }
    }
  });

  return bestAlwaysClaim?.sessionKey ?? bestFallback?.sessionKey;
}

describe('glob-based session routing', () => {
  const createSession = (clientKey: string): nrepl.NReplSession =>
    ({ client: { clientKey } } as unknown as nrepl.NReplSession);

  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
  });

  describe('single connection glob routing', () => {
    it('routes .clj files to main session with **/*.clj glob', () => {
      const sessions = [
        {
          key: 'clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.clj'],
            'is-fallback-for': [],
          }),
        },
        {
          key: 'cljs',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.cljs'],
            'is-fallback-for': [],
          }),
        },
      ];

      expectLib.expect(findSessionKeyByGlob('src/app/core.clj', sessions)).toBe('clj');
      expectLib.expect(findSessionKeyByGlob('test/app_test.clj', sessions)).toBe('clj');
    });

    it('routes .cljs files to secondary session', () => {
      const sessions = [
        {
          key: 'clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.clj'],
            'is-fallback-for': [],
          }),
        },
        {
          key: 'cljs',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.cljs'],
            'is-fallback-for': [],
          }),
        },
      ];

      expectLib.expect(findSessionKeyByGlob('src/app/ui.cljs', sessions)).toBe('cljs');
    });

    it('prefers always-claim over is-fallback-for', () => {
      const sessions = [
        {
          key: 'clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': [],
            'is-fallback-for': ['**/*.clj'],
          }),
        },
        {
          key: 'special',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['src/special/**/*.clj'],
            'is-fallback-for': [],
          }),
        },
      ];

      expectLib.expect(findSessionKeyByGlob('src/special/core.clj', sessions)).toBe('special');
      expectLib.expect(findSessionKeyByGlob('src/other/core.clj', sessions)).toBe('clj');
    });
  });

  describe('multi-connection glob routing', () => {
    it('routes files to correct session based on glob patterns from different clients', () => {
      // Client A handles main app
      const sessionsA = [
        {
          key: 'app-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['app/**/*.clj'],
            'is-fallback-for': [],
          }),
        },
        {
          key: 'app-cljs',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['app/**/*.cljs'],
            'is-fallback-for': [],
          }),
        },
      ];

      // Client B handles admin module
      const sessionsB = [
        {
          key: 'admin-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['admin/**/*.clj'],
            'is-fallback-for': [],
          }),
        },
        {
          key: 'admin-cljs',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['admin/**/*.cljs'],
            'is-fallback-for': [],
          }),
        },
      ];

      // Combined sessions as would appear in registry
      const allSessions = [...sessionsA, ...sessionsB];

      expectLib.expect(findSessionKeyByGlob('app/src/core.clj', allSessions)).toBe('app-clj');
      expectLib.expect(findSessionKeyByGlob('app/src/ui.cljs', allSessions)).toBe('app-cljs');
      expectLib
        .expect(findSessionKeyByGlob('admin/src/dashboard.clj', allSessions))
        .toBe('admin-clj');
      expectLib
        .expect(findSessionKeyByGlob('admin/src/views.cljs', allSessions))
        .toBe('admin-cljs');
    });

    it('uses specificity to resolve overlapping globs from different connections', () => {
      const sessions = [
        {
          key: 'generic-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.clj'],
            'is-fallback-for': [],
          }),
        },
        {
          key: 'specific-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['src/app/special/**/*.clj'],
            'is-fallback-for': [],
          }),
        },
      ];

      // More specific pattern wins
      expectLib
        .expect(findSessionKeyByGlob('src/app/special/handler.clj', sessions))
        .toBe('specific-clj');
      expectLib.expect(findSessionKeyByGlob('src/other/handler.clj', sessions)).toBe('generic-clj');
    });

    it('respects tier priority across connections', () => {
      const sessions = [
        {
          key: 'fallback-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': [],
            'is-fallback-for': ['**/*.clj'],
          }),
        },
        {
          key: 'claim-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['src/**/*.clj'],
            'is-fallback-for': [],
          }),
        },
      ];

      // always-claim beats is-fallback-for even if less specific
      expectLib.expect(findSessionKeyByGlob('src/core.clj', sessions)).toBe('claim-clj');
      // Fallback handles non-matching paths
      expectLib.expect(findSessionKeyByGlob('test/core.clj', sessions)).toBe('fallback-clj');
    });

    it('uses registration order as tiebreaker for equal scores', () => {
      const sessions = [
        {
          key: 'first-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.clj'],
            'is-fallback-for': [],
          }),
        },
        {
          key: 'second-clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.clj'],
            'is-fallback-for': [],
          }),
        },
      ];

      // First registered wins on tie
      expectLib.expect(findSessionKeyByGlob('src/core.clj', sessions)).toBe('first-clj');
    });

    it('returns undefined when no globs match', () => {
      const sessions = [
        {
          key: 'clj',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['src/**/*.clj'],
            'is-fallback-for': [],
          }),
        },
      ];

      expectLib.expect(findSessionKeyByGlob('lib/core.cljs', sessions)).toBeUndefined();
    });

    it('handles empty glob specs gracefully', () => {
      const sessions = [
        { key: 'no-globs', globSpecs: [] },
        {
          key: 'has-globs',
          globSpecs: globs.buildGlobSpecsFromTiers({
            'always-claim': ['**/*.clj'],
            'is-fallback-for': [],
          }),
        },
      ];

      expectLib.expect(findSessionKeyByGlob('src/core.clj', sessions)).toBe('has-globs');
    });
  });

  describe('integration with session registry', () => {
    it('registered sessions include glob metadata', () => {
      const globSpecs = globs.buildGlobSpecsFromTiers({
        'always-claim': ['**/*.clj'],
        'is-fallback-for': [],
      });

      sessionRegistry.registerSession('clj', createSession('client-a'), {
        globs: ['**/*.clj'],
        globSpecs,
      });

      const metadata = sessionRegistry.getSessionMetadata('clj');
      expectLib.expect(metadata?.globs).toEqual(['**/*.clj']);
      expectLib.expect(metadata?.globSpecs).toEqual(globSpecs);
    });

    it('listSessions returns glob metadata for routing decisions', () => {
      const cljGlobs = globs.buildGlobSpecsFromTiers({
        'always-claim': ['**/*.clj'],
        'is-fallback-for': [],
      });
      const cljsGlobs = globs.buildGlobSpecsFromTiers({
        'always-claim': ['**/*.cljs'],
        'is-fallback-for': [],
      });

      sessionRegistry.registerSession('clj', createSession('client-a'), { globSpecs: cljGlobs });
      sessionRegistry.registerSession('cljs', createSession('client-a'), { globSpecs: cljsGlobs });

      const sessions = sessionRegistry.listSessions();
      const sessionData = sessions.map((s) => ({ key: s.key, globSpecs: s.globSpecs }));

      expectLib.expect(findSessionKeyByGlob('src/core.clj', sessionData)).toBe('clj');
      expectLib.expect(findSessionKeyByGlob('src/ui.cljs', sessionData)).toBe('cljs');
    });
  });
});
