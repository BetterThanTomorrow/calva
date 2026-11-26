import * as minimatchLib from 'minimatch';
import type * as globs from './globs';
import type * as sessionRegistry from './session-registry';
import * as globPaths from './glob-paths';

interface GlobMatchResult {
  sessionKey: string;
  tier: globs.SessionGlobTier;
  matchingPattern: string;
  score: number;
  order: number;
}

type GlobRoutingSession = Pick<sessionRegistry.SessionMetadata, 'key' | 'globSpecs'>;

function findMatchingGlobSpecs(
  candidatePaths: string[],
  sessions: GlobRoutingSession[]
): GlobMatchResult[] {
  return sessions.flatMap((session, order) =>
    (session.globSpecs ?? [])
      .filter((spec) =>
        candidatePaths.some((candidate) =>
          minimatchLib.minimatch(
            candidate,
            spec.normalizedPattern || globPaths.toPosixPath(spec.pattern),
            { dot: true }
          )
        )
      )
      .map((spec) => ({
        sessionKey: session.key,
        tier: spec.tier,
        matchingPattern: spec.displayPattern || spec.pattern,
        score: spec.score,
        order,
      }))
  );
}

function isBetterGlobMatch(
  current: GlobMatchResult | undefined,
  candidate: GlobMatchResult
): boolean {
  return (
    !current ||
    candidate.score > current.score ||
    (candidate.score === current.score && candidate.order < current.order)
  );
}

function bestGlobMatchForTier(
  matches: GlobMatchResult[],
  tier: globs.SessionGlobTier
): GlobMatchResult | undefined {
  return matches
    .filter((match) => match.tier === tier)
    .reduce<GlobMatchResult | undefined>(
      (best, match) => (isBetterGlobMatch(best, match) ? match : best),
      undefined
    );
}

export function selectGlobMatch(
  candidatePaths: string[],
  sessions: GlobRoutingSession[]
): Omit<GlobMatchResult, 'score' | 'order'> | undefined {
  const matches = findMatchingGlobSpecs(candidatePaths, sessions);
  const winner =
    bestGlobMatchForTier(matches, 'always-claim') ??
    bestGlobMatchForTier(matches, 'is-fallback-for') ??
    bestGlobMatchForTier(matches, 'project-fallback');
  if (!winner) {
    return undefined;
  }
  const { sessionKey, tier, matchingPattern } = winner;
  return { sessionKey, tier, matchingPattern };
}
