import * as globPaths from '../glob-paths';

export type SessionGlobTier = 'always-claim' | 'is-fallback-for';

export interface SessionGlobTiers {
  'always-claim': string[];
  'is-fallback-for': string[];
}

export interface SessionGlobSpec {
  pattern: string;
  normalizedPattern: string;
  tier: SessionGlobTier;
  score: number;
}

export function computeGlobScore(pattern: string): number {
  if (!pattern) {
    return 0;
  }

  const normalized = globPaths.toPosixPath(pattern);
  let score = 0;

  if (normalized.startsWith('./**/')) {
    score -= 3;
  } else if (normalized.startsWith('**/')) {
    score -= 3;
  }

  const segments = normalized.split('/').filter((segment) => segment.length > 0);
  segments.forEach((segment) => {
    if (segment === '**') {
      score -= 2;
      return;
    }

    const isLiteral = !/[*?[{]/.test(segment);
    score += isLiteral ? 4 : 1;
  });

  return score;
}

export function buildGlobSpecsFromTiers(tiers: SessionGlobTiers): SessionGlobSpec[] {
  const toSpecs = (patterns: string[], tier: SessionGlobTier) =>
    patterns.map((pattern) => ({
      pattern,
      normalizedPattern: globPaths.toPosixPath(pattern),
      tier,
      score: computeGlobScore(pattern),
    }));

  return [
    ...toSpecs(tiers['always-claim'], 'always-claim'),
    ...toSpecs(tiers['is-fallback-for'], 'is-fallback-for'),
  ];
}

export function toGlobMetadata(tiers: SessionGlobTiers) {
  const globSpecs = buildGlobSpecsFromTiers(tiers);
  return {
    globSpecs,
    globs: globSpecs.map((spec) => spec.pattern),
  };
}
