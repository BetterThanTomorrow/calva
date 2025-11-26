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
  main: { primary: ['**/*.clj'], secondary: [] },
  promoted: { primary: ['**/*.cljs'], secondary: [] },
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
    return { primary: [], secondary: [] };
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    return { primary: normalizeGlobValue(value), secondary: [] };
  }
  return {
    primary: normalizeTierConfig(value.primary),
    secondary: normalizeTierConfig(value.secondary),
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
  if (configuredGlobs) {
    for (const [name, value] of Object.entries(configuredGlobs)) {
      globs[name] = normalizeGlobEntry(value);
    }
  }

  (['main', 'promoted'] as SessionRole[]).forEach((role) => {
    const key = keys[role];
    if (!key) {
      return;
    }

    const overrideFromRole = configuredGlobs?.[role];
    if (overrideFromRole) {
      globs[key] = normalizeGlobEntry(overrideFromRole);
      return;
    }

    const existing = globs[key];
    if (!existing || (existing.primary.length === 0 && existing.secondary.length === 0)) {
      const defaults = DEFAULT_SESSION_ROLE_GLOBS[role];
      if (defaults) {
        globs[key] = {
          primary: [...defaults.primary],
          secondary: [...defaults.secondary],
        };
      } else {
        globs[key] = { primary: [], secondary: [] };
      }
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
    return { primary: [], secondary: [] };
  }
  return {
    primary: [...tiers.primary],
    secondary: [...tiers.secondary],
  };
}
