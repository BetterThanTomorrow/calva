import * as expectLib from 'expect';
import * as globs from '../../../../src/nrepl/globs';
import * as globSelection from '../../../../src/nrepl/glob-selection';

const coreClj = 'src/core.clj';
const alwaysClaim: globs.SessionGlobTier = 'always-claim';

function spec(
  pattern: string,
  tier: globs.SessionGlobTier,
  score = globs.computeGlobScore(pattern),
  displayPattern = pattern
): globs.SessionGlobSpec {
  return { pattern, normalizedPattern: pattern, displayPattern, tier, score };
}

describe('glob selection', () => {
  it('prefers always-claim, then is-fallback-for, then project-fallback', () => {
    const winner = globSelection.selectGlobMatch(
      ['/workspace/src/core.cljc'],
      [
        { key: 'project', globSpecs: [globs.createCatchAllGlobSpec('/workspace')] },
        { key: 'fallback', globSpecs: [spec('**/*.cljc', 'is-fallback-for', 999)] },
        { key: 'claim', globSpecs: [spec('**/*.cljc', alwaysClaim, 1)] },
      ]
    );

    expectLib.expect(winner?.sessionKey).toBe('claim');
    expectLib.expect(winner?.tier).toBe(alwaysClaim);
  });

  it('prefers is-fallback-for over project-fallback', () => {
    const winner = globSelection.selectGlobMatch(
      ['/workspace/src/core.cljc'],
      [
        { key: 'project', globSpecs: [globs.createCatchAllGlobSpec('/workspace')] },
        { key: 'fallback', globSpecs: [spec('**/*.cljc', 'is-fallback-for')] },
      ]
    );

    expectLib.expect(winner?.sessionKey).toBe('fallback');
  });

  it('prefers a higher score within the same tier', () => {
    const winner = globSelection.selectGlobMatch(
      [coreClj],
      [
        { key: 'generic', globSpecs: [spec('**/*.clj', alwaysClaim)] },
        { key: 'specific', globSpecs: [spec(coreClj, alwaysClaim)] },
      ]
    );

    expectLib.expect(winner?.sessionKey).toBe('specific');
  });

  it('prefers the earlier session for equal scores', () => {
    const winner = globSelection.selectGlobMatch(
      [coreClj],
      [
        { key: 'first', globSpecs: [spec('**/*.clj', alwaysClaim)] },
        { key: 'second', globSpecs: [spec('**/*.clj', alwaysClaim)] },
      ]
    );

    expectLib.expect(winner?.sessionKey).toBe('first');
  });

  it('keeps the first matching spec when session and score are equal', () => {
    const winner = globSelection.selectGlobMatch(
      [coreClj],
      [
        {
          key: 'one-session',
          globSpecs: [
            spec('**/*.clj', alwaysClaim, 1, 'first-spec'),
            spec('src/*.clj', alwaysClaim, 1, 'second-spec'),
          ],
        },
      ]
    );

    expectLib.expect(winner?.matchingPattern).toBe('first-spec');
  });

  it('returns undefined when no spec matches', () => {
    const winner = globSelection.selectGlobMatch(
      ['lib/core.cljs'],
      [{ key: 'clj', globSpecs: [spec('src/**/*.clj', alwaysClaim)] }]
    );

    expectLib.expect(winner).toBeUndefined();
  });
});
