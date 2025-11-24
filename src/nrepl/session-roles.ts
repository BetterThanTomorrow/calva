import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';
import {
  ReplConnectSequence,
  SessionGlobsConfig,
  SessionNamesConfig,
} from './connect-sequence-types';
import * as promotedSession from './promoted-session';

export type SessionRole = 'main' | 'promoted';

export interface SessionRoleKeys {
  main: string;
  promoted?: string;
}

export type SessionGlobMap = Record<string, string[]>;

const SESSION_ROLE_STATE_KEY = 'session-role-keys';
const SESSION_ROLE_GLOBS_STATE_KEY = 'session-role-globs';

const DEFAULT_SESSION_ROLE_KEYS: SessionRoleKeys = {
  main: 'clj',
  promoted: 'cljs',
};

const DEFAULT_SESSION_ROLE_GLOBS: Record<SessionRole, string[]> = {
  main: ['**/*.clj'],
  promoted: ['**/*.cljs'],
};

const DEFAULT_SESSION_GLOB_MAP: SessionGlobMap = {
  [DEFAULT_SESSION_ROLE_KEYS.main]: [...DEFAULT_SESSION_ROLE_GLOBS.main],
  [DEFAULT_SESSION_ROLE_KEYS.promoted]: [...DEFAULT_SESSION_ROLE_GLOBS.promoted],
};

function cloneDefaultGlobMap(): SessionGlobMap {
  return Object.fromEntries(
    Object.entries(DEFAULT_SESSION_GLOB_MAP).map(([key, patterns]) => [key, [...patterns]])
  );
}

function normalizeGlobValue(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((glob) => glob.trim())
    .filter((glob) => glob.length > 0);
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
      globs[name] = normalizeGlobValue(value);
    }
  }

  (['main', 'promoted'] as SessionRole[]).forEach((role) => {
    const key = keys[role];
    if (!key) {
      return;
    }

    const overrideFromRole = configuredGlobs?.[role];
    if (overrideFromRole) {
      globs[key] = normalizeGlobValue(overrideFromRole);
      return;
    }

    if (!globs[key] || globs[key].length === 0) {
      const defaults = DEFAULT_SESSION_ROLE_GLOBS[role];
      if (defaults) {
        globs[key] = [...defaults];
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
  const globs = getSessionRoleGlobs();
  return globs[key] ? [...globs[key]] : [];
}

export function getSessionKeyForRole(role: SessionRole): string | undefined {
  const keys = getSessionRoleKeys();
  return keys[role];
}

export function resetSessionRoleKeys(): void {
  setSessionRoleKeys(DEFAULT_SESSION_ROLE_KEYS);
  setSessionRoleGlobs(cloneDefaultGlobMap());
}
