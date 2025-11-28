import {
  ReplConnectSequence,
  SessionFilePatternsConfig,
  SessionFilePatternsRulesConfig,
} from './connect-sequence-types';
import type { SessionGlobTiers } from './globs';
import * as globs from './globs';
import * as promotedSession from './secondary-session';

export type SessionRole = 'primary' | 'secondary';

export interface SessionRoleKeys {
  primary: string;
  secondary?: string;
}

export type SessionGlobMap = Record<string, SessionGlobTiers>;

const DEFAULT_SESSION_ROLE_KEYS: SessionRoleKeys = {
  primary: 'clj',
  secondary: 'cljs',
};

/**
 * Default file patterns for session roles.
 * These are simple patterns like `*.clj` that get combined with the project root
 * to form full globs like `/path/to/project/**\/*.clj`.
 */
const DEFAULT_SESSION_ROLE_FILE_PATTERNS: Record<SessionRole, SessionGlobTiers> = {
  primary: { 'always-claim': ['*.clj', '*.edn'], 'is-fallback-for': [] },
  secondary: { 'always-claim': ['*.cljs'], 'is-fallback-for': [] },
};

function normalizePatternValue(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
}

function normalizeTierConfig(value?: string | string[]): string[] {
  return value ? normalizePatternValue(value) : [];
}

function normalizePatternEntry(
  value: string | string[] | SessionFilePatternsRulesConfig | undefined
): SessionGlobTiers {
  if (value === undefined) {
    return { 'always-claim': [], 'is-fallback-for': [] };
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    return { 'always-claim': normalizePatternValue(value), 'is-fallback-for': [] };
  }
  return {
    'always-claim': normalizeTierConfig(value['always-claim']),
    'is-fallback-for': normalizeTierConfig(value['is-fallback-for']),
  };
}

/**
 * Derive session role keys from a connect sequence configuration.
 * This is a pure function that does NOT set any global state.
 */
export function deriveSessionRoleKeys(sequence?: ReplConnectSequence): SessionRoleKeys {
  const config = sequence?.replSessionNames;
  const keys: SessionRoleKeys = {
    primary: config?.primary || DEFAULT_SESSION_ROLE_KEYS.primary,
  };
  if (promotedSession.shouldUseSecondarySession(sequence)) {
    keys.secondary = config?.secondary || DEFAULT_SESSION_ROLE_KEYS.secondary;
  }
  return keys;
}

/**
 * Converts file pattern tiers to full glob tiers by prepending project root.
 */
function buildGlobTiersFromPatterns(
  projectRootPath: string,
  patternTiers: SessionGlobTiers
): SessionGlobTiers {
  const buildFullGlobs = (patterns: string[]): string[] => {
    const specs = globs.constructGlobsFromFilePatterns(projectRootPath, patterns, 'always-claim');
    return specs.map((spec) => spec.pattern);
  };

  return {
    'always-claim': buildFullGlobs(patternTiers['always-claim']),
    'is-fallback-for': buildFullGlobs(patternTiers['is-fallback-for']),
  };
}

/**
 * Derive glob configuration for session keys from a connect sequence.
 * File patterns from config are combined with projectRootPath to create full globs.
 * This is a pure function that does NOT set any global state.
 *
 * @param sequence - The connect sequence containing file pattern configuration
 * @param keys - The session role keys (e.g., { main: 'clj', promoted: 'cljs' })
 * @param projectRootPath - The project root as an fsPath, used to construct full globs
 */
export function deriveSessionGlobMap(
  sequence: ReplConnectSequence | undefined,
  keys: SessionRoleKeys,
  projectRootPath: string
): SessionGlobMap {
  const globMap: SessionGlobMap = {};
  const configuredPatterns: SessionFilePatternsConfig | undefined =
    sequence?.replSessionFilePatterns;

  (['primary', 'secondary'] as SessionRole[]).forEach((role) => {
    const key = keys[role];
    if (!key) {
      return;
    }

    const configuredForRole = configuredPatterns?.[role];
    let patternTiers: SessionGlobTiers;

    if (configuredForRole) {
      patternTiers = normalizePatternEntry(configuredForRole);
    } else {
      const defaults = DEFAULT_SESSION_ROLE_FILE_PATTERNS[role];
      patternTiers = defaults
        ? {
            'always-claim': [...defaults['always-claim']],
            'is-fallback-for': [...defaults['is-fallback-for']],
          }
        : { 'always-claim': [], 'is-fallback-for': [] };
    }

    // Convert file patterns to full globs using project root
    const fullGlobTiers = buildGlobTiersFromPatterns(projectRootPath, patternTiers);

    // Add catch-all glob to is-fallback-for tier for cljc routing
    const catchAllSpec = globs.createCatchAllGlobSpec(projectRootPath);
    fullGlobTiers['is-fallback-for'].push(catchAllSpec.pattern);

    globMap[key] = fullGlobTiers;
  });

  return globMap;
}

/**
 * Get glob tiers for a specific session key from a glob map.
 */
export function getGlobTiersFromMap(globMap: SessionGlobMap, key: string): SessionGlobTiers {
  const tiers = globMap[key];
  if (!tiers) {
    return { 'always-claim': [], 'is-fallback-for': [] };
  }
  return {
    'always-claim': [...tiers['always-claim']],
    'is-fallback-for': [...tiers['is-fallback-for']],
  };
}
