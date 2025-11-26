import {
  ReplConnectSequence,
  SessionGlobsConfig,
  SessionGlobTierConfig,
} from './connect-sequence-types';
import type { SessionGlobTiers } from './globs';
import * as promotedSession from './promoted-session';

export type SessionRole = 'main' | 'promoted';

export interface SessionRoleKeys {
  main: string;
  promoted?: string;
}

export type SessionGlobMap = Record<string, SessionGlobTiers>;

const DEFAULT_SESSION_ROLE_KEYS: SessionRoleKeys = {
  main: 'clj',
  promoted: 'cljs',
};

const DEFAULT_SESSION_ROLE_GLOBS: Record<SessionRole, SessionGlobTiers> = {
  main: { 'always-claim': ['**/*.clj'], 'is-fallback-for': [] },
  promoted: { 'always-claim': ['**/*.cljs'], 'is-fallback-for': [] },
};

function normalizeGlobValue(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((glob) => glob.trim())
    .filter((glob) => glob.length > 0);
}

function normalizeTierConfig(value?: string | string[]): string[] {
  return value ? normalizeGlobValue(value) : [];
}

function normalizeGlobEntry(
  value: string | string[] | SessionGlobTierConfig | undefined
): SessionGlobTiers {
  if (value === undefined) {
    return { 'always-claim': [], 'is-fallback-for': [] };
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    return { 'always-claim': normalizeGlobValue(value), 'is-fallback-for': [] };
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
    main: config?.main || DEFAULT_SESSION_ROLE_KEYS.main,
  };
  if (promotedSession.shouldUsePromotedSession(sequence)) {
    keys.promoted = config?.promoted || DEFAULT_SESSION_ROLE_KEYS.promoted;
  }
  return keys;
}

/**
 * Derive glob configuration for session keys from a connect sequence.
 * This is a pure function that does NOT set any global state.
 */
export function deriveSessionGlobMap(
  sequence: ReplConnectSequence | undefined,
  keys: SessionRoleKeys
): SessionGlobMap {
  const globs: SessionGlobMap = {};
  const configuredGlobs: SessionGlobsConfig | undefined = sequence?.replSessionGlobs;

  (['main', 'promoted'] as SessionRole[]).forEach((role) => {
    const key = keys[role];
    if (!key) {
      return;
    }

    const configuredForRole = configuredGlobs?.[role];
    if (configuredForRole) {
      globs[key] = normalizeGlobEntry(configuredForRole);
      return;
    }

    const defaults = DEFAULT_SESSION_ROLE_GLOBS[role];
    if (defaults) {
      globs[key] = {
        'always-claim': [...defaults['always-claim']],
        'is-fallback-for': [...defaults['is-fallback-for']],
      };
    } else {
      globs[key] = { 'always-claim': [], 'is-fallback-for': [] };
    }
  });

  return globs;
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
