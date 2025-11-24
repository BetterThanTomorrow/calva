import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';
import {
  ReplConnectSequence,
  SessionGlobsConfig,
  SessionGlobTierConfig,
  SessionNamesConfig,
} from './connect-sequence-types';
import * as promotedSession from './promoted-session';

export type SessionRole = 'main' | 'promoted';

export interface SessionRoleKeys {
  main: string;
  promoted?: string;
}

export interface SessionGlobTiers {
  primary: string[];
  secondary: string[];
}

export type SessionGlobMap = Record<string, SessionGlobTiers>;

const SESSION_ROLE_STATE_KEY = 'session-role-keys';
const SESSION_ROLE_GLOBS_STATE_KEY = 'session-role-globs';

const DEFAULT_SESSION_ROLE_KEYS: SessionRoleKeys = {
  main: 'clj',
  promoted: 'cljs',
};

const DEFAULT_SESSION_ROLE_GLOBS: Record<SessionRole, SessionGlobTiers> = {
  main: { primary: ['**/*.clj'], secondary: [] },
  promoted: { primary: ['**/*.cljs'], secondary: [] },
};

const DEFAULT_SESSION_GLOB_MAP: SessionGlobMap = {
  [DEFAULT_SESSION_ROLE_KEYS.main]: {
    primary: [...DEFAULT_SESSION_ROLE_GLOBS.main.primary],
    secondary: [...DEFAULT_SESSION_ROLE_GLOBS.main.secondary],
  },
  [DEFAULT_SESSION_ROLE_KEYS.promoted]: {
    primary: [...DEFAULT_SESSION_ROLE_GLOBS.promoted.primary],
    secondary: [...DEFAULT_SESSION_ROLE_GLOBS.promoted.secondary],
  },
};

function cloneDefaultGlobMap(): SessionGlobMap {
  return Object.fromEntries(
    Object.entries(DEFAULT_SESSION_GLOB_MAP).map(([key, tiers]) => [
      key,
      {
        primary: [...tiers.primary],
        secondary: [...tiers.secondary],
      },
    ])
  );
}

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

function fromSequenceConfig(sequence?: ReplConnectSequence): SessionRoleKeys {
  const config = sequence?.replSessionNames;
  const keys: SessionRoleKeys = {
    main: config?.main || DEFAULT_SESSION_ROLE_KEYS.main,
  };
  if (promotedSession.shouldUsePromotedSession(sequence)) {
    keys.promoted = config?.promoted || DEFAULT_SESSION_ROLE_KEYS.promoted;
  }
  return keys;
}

function readStoredKeys(): Partial<SessionRoleKeys> | undefined {
  const stored = getStateValue(SESSION_ROLE_STATE_KEY) as SessionRoleKeys | undefined;
  return stored || undefined;
}

function readStoredGlobs(): SessionGlobMap | undefined {
  const stored = getStateValue(SESSION_ROLE_GLOBS_STATE_KEY) as SessionGlobMap | undefined;
  return stored || undefined;
}

function setSessionRoleGlobs(globs: SessionGlobMap): void {
  setStateValue(SESSION_ROLE_GLOBS_STATE_KEY, globs);
}

function deriveSessionRoleGlobs(
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

export function deriveSessionRoleKeys(sequence?: ReplConnectSequence): SessionRoleKeys {
  return fromSequenceConfig(sequence);
}

export function deriveSessionGlobMap(sequence?: ReplConnectSequence): SessionGlobMap {
  const keys = deriveSessionRoleKeys(sequence);
  return deriveSessionRoleGlobs(sequence, keys);
}

export function setSessionRoleKeys(keys: SessionRoleKeys): void {
  setStateValue(SESSION_ROLE_STATE_KEY, keys);
}

export function initializeSessionRoleKeys(sequence?: ReplConnectSequence): SessionRoleKeys {
  const keys = deriveSessionRoleKeys(sequence);
  setSessionRoleKeys(keys);
  const globs = deriveSessionRoleGlobs(sequence, keys);
  setSessionRoleGlobs(globs);
  return keys;
}

export function getSessionRoleKeys(): SessionRoleKeys {
  const stored = readStoredKeys();
  const keys: SessionRoleKeys = {
    main: stored?.main || DEFAULT_SESSION_ROLE_KEYS.main,
  };
  if (stored?.promoted) {
    keys.promoted = stored.promoted;
  }
  return keys;
}

export function getSessionRoleGlobs(): SessionGlobMap {
  const stored = readStoredGlobs();
  if (stored && Object.keys(stored).length > 0) {
    return stored;
  }
  return cloneDefaultGlobMap();
}

export function getGlobsForSessionKey(key: string): string[] {
  const tiers = getGlobTiersForSessionKey(key);
  return [...tiers.primary, ...tiers.secondary];
}

export function getGlobTiersForSessionKey(key: string): SessionGlobTiers {
  const globs = getSessionRoleGlobs();
  const tiers = globs[key];
  if (!tiers) {
    return { primary: [], secondary: [] };
  }
  return {
    primary: [...tiers.primary],
    secondary: [...tiers.secondary],
  };
}

export function getSessionKeyForRole(role: SessionRole): string | undefined {
  const keys = getSessionRoleKeys();
  return keys[role];
}

export function resetSessionRoleKeys(): void {
  setSessionRoleKeys(DEFAULT_SESSION_ROLE_KEYS);
  setSessionRoleGlobs(cloneDefaultGlobMap());
}
