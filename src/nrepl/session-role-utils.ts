import {
  ReplConnectSequence,
  SessionFilePatternsConfig,
  SessionFilePatternsRulesConfig,
} from './connect-sequence-types';
import type { SessionGlobTiers, SessionGlobSpec } from './globs';
import * as globs from './globs';
import * as secondarySession from './secondary-session';
import { getProjectTypeForName } from './project-types';

export type SessionRole = 'primary' | 'secondary';

export interface SessionRoleKeys {
  primary: string;
  secondary?: string;
}

export type SessionGlobMap = Record<string, SessionGlobSpec[]>;

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
 * Resolution priority:
 * 1. Connect sequence's replSessionNames (explicit user/sequence config)
 * 2. Project type's replSessionNames (project type defaults)
 * 3. Generic role-based defaults (clj/cljs)
 *
 * This is a pure function that does NOT set any global state.
 */
export function deriveSessionRoleKeys(sequence?: ReplConnectSequence): SessionRoleKeys {
  // Check sequence config first
  const sequenceConfig = sequence?.replSessionNames;

  // Get project type defaults if available
  let projectTypePrimary: string | undefined;
  let projectTypeSecondary: string | undefined;
  if (sequence?.projectType) {
    const projectType = getProjectTypeForName(sequence.projectType);
    projectTypePrimary = projectType?.replSessionNames?.primary;
    projectTypeSecondary = projectType?.replSessionNames?.secondary;
  }

  const keys: SessionRoleKeys = {
    primary: sequenceConfig?.primary || projectTypePrimary || DEFAULT_SESSION_ROLE_KEYS.primary,
  };

  if (secondarySession.shouldUseSecondarySession(sequence)) {
    keys.secondary =
      sequenceConfig?.secondary || projectTypeSecondary || DEFAULT_SESSION_ROLE_KEYS.secondary;
  }

  return keys;
}

/**
 * Converts file pattern tiers to SessionGlobSpecs by prepending project root.
 */
function buildGlobSpecsFromPatterns(
  projectRootPath: string,
  patternTiers: SessionGlobTiers
): SessionGlobSpec[] {
  const alwaysClaimSpecs = globs.constructGlobsFromFilePatterns(
    projectRootPath,
    patternTiers['always-claim'],
    'always-claim'
  );
  const fallbackSpecs = globs.constructGlobsFromFilePatterns(
    projectRootPath,
    patternTiers['is-fallback-for'],
    'is-fallback-for'
  );

  return [...alwaysClaimSpecs, ...fallbackSpecs];
}

/**
 * Get file patterns for a role, checking sources in priority order:
 * 1. Connect sequence's replSessionFilePatterns
 * 2. Project type's defaultFilePatterns
 * 3. Generic role-based defaults
 */
function getFilePatternsForRole(
  role: SessionRole,
  sequence: ReplConnectSequence | undefined
): SessionGlobTiers {
  // 1. Check sequence's explicit replSessionFilePatterns
  const sequencePatterns = sequence?.replSessionFilePatterns?.[role];
  if (sequencePatterns) {
    return normalizePatternEntry(sequencePatterns);
  }

  // 2. Check project type's defaultFilePatterns
  if (sequence?.projectType) {
    const projectType = getProjectTypeForName(sequence.projectType);
    const projectTypePatterns = projectType?.defaultFilePatterns?.[role];
    if (projectTypePatterns) {
      return normalizePatternEntry(projectTypePatterns);
    }
  }

  // 3. Fall back to generic role-based defaults
  const defaults = DEFAULT_SESSION_ROLE_FILE_PATTERNS[role];
  return defaults
    ? {
        'always-claim': [...defaults['always-claim']],
        'is-fallback-for': [...defaults['is-fallback-for']],
      }
    : { 'always-claim': [], 'is-fallback-for': [] };
}

/**
 * Derive glob configuration for session keys from a connect sequence.
 * File patterns from config are combined with projectRootPath to create full globs.
 * This is a pure function that does NOT set any global state.
 *
 * Pattern resolution priority:
 * 1. Connect sequence's replSessionFilePatterns (explicit user/sequence config)
 * 2. Project type's defaultFilePatterns (project type sensible defaults)
 * 3. Generic role-based defaults (*.clj/*.edn for primary, *.cljs for secondary)
 *
 * @param sequence - The connect sequence containing file pattern configuration
 * @param keys - The session role keys (e.g., { primary: 'clj', secondary: 'cljs' })
 * @param projectRootPath - The project root as an fsPath, used to construct full globs
 */
export function deriveSessionGlobMap(
  sequence: ReplConnectSequence | undefined,
  keys: SessionRoleKeys,
  projectRootPath: string
): SessionGlobMap {
  const globMap: SessionGlobMap = {};

  (['primary', 'secondary'] as SessionRole[]).forEach((role) => {
    const key = keys[role];
    if (!key) {
      return;
    }

    const patternTiers = getFilePatternsForRole(role, sequence);

    // Convert file patterns to full glob specs using project root
    const specs = buildGlobSpecsFromPatterns(projectRootPath, patternTiers);

    // Add catch-all glob spec to fallback tier for cljc routing
    const catchAllSpec = globs.createCatchAllGlobSpec(projectRootPath);
    specs.push(catchAllSpec);

    globMap[key] = specs;
  });

  return globMap;
}

/**
 * Get glob specs for a specific session key from a glob map.
 */
export function getGlobSpecsFromMap(globMap: SessionGlobMap, key: string): SessionGlobSpec[] {
  return globMap[key] ?? [];
}
