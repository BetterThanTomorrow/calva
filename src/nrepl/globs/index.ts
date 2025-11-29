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

/**
 * Normalizes a project root path to a POSIX file path suitable for glob matching.
 *
 * @param projectRootPath - The project root as an fsPath (e.g., "/Users/pez/..." or "C:\\Users\\...")
 * @returns A POSIX-normalized path without trailing slash (e.g., "/Users/pez/...")
 */
export function normalizeProjectRoot(projectRootPath: string): string {
  const posixPath = globPaths.toPosixPath(projectRootPath);
  return posixPath.endsWith('/') ? posixPath.slice(0, -1) : posixPath;
}

/**
 * Constructs full glob patterns from file patterns and a project root.
 *
 * File patterns like `*.clj` are transformed into full globs like `/path/to/project/**\/*.clj`.
 * Each sequence also receives an implicit catch-all glob `<projectRoot>/**\/*` in the
 * `is-fallback-for` tier to enable cljc routing and ensure all files in a project root
 * can be routed to the sequence.
 *
 * Patterns starting with `**\/` are treated as workspace-wide patterns and are NOT scoped
 * to the project root. This allows patterns like `**\/*.bb` to match files anywhere in the
 * workspace, not just within the sequence's project directory.
 *
 * @param projectRootPath - The project root as an fsPath (e.g., "/Users/pez/..." or "C:\\Users\\...")
 * @param filePatterns - File patterns like `["*.clj", "*.edn"]` or path patterns like `["scripts/*.clj"]`
 *                       or workspace-wide patterns like `["**\/*.bb"]`
 * @param tier - The glob tier ('always-claim' or 'is-fallback-for')
 * @returns Full glob specs with patterns like `/path/to/project/**\/*.clj` or workspace-wide patterns
 */
export function constructGlobsFromFilePatterns(
  projectRootPath: string,
  filePatterns: string[],
  tier: SessionGlobTier
): SessionGlobSpec[] {
  if (!projectRootPath || filePatterns.length === 0) {
    return [];
  }

  const normalizedRoot = normalizeProjectRoot(projectRootPath);

  return filePatterns.map((pattern) => {
    const normalizedPattern = globPaths.toPosixPath(pattern);

    // Patterns starting with **/ are workspace-wide and skip project root scoping
    const isWorkspaceWide = normalizedPattern.startsWith('**/');
    const fullPattern = isWorkspaceWide
      ? normalizedPattern
      : `${normalizedRoot}/**/${normalizedPattern}`;

    return {
      pattern: fullPattern,
      normalizedPattern: fullPattern,
      tier,
      score: computeGlobScore(fullPattern),
    };
  });
}

/**
 * Creates a catch-all glob spec for a project root.
 *
 * This is used as a fallback tier to ensure all files in a project root can be
 * routed to a sequence, enabling per-sequence cljc routing.
 *
 * @param projectRootPath - The project root as an fsPath
 * @returns A glob spec matching all files under the project root
 */
export function createCatchAllGlobSpec(projectRootPath: string): SessionGlobSpec {
  const normalizedRoot = normalizeProjectRoot(projectRootPath);
  const fullPattern = `${normalizedRoot}/**/*`;
  return {
    pattern: fullPattern,
    normalizedPattern: fullPattern,
    tier: 'is-fallback-for',
    score: computeGlobScore(fullPattern),
  };
}
