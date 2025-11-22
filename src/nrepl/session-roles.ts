import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';
import { ReplConnectSequence, SessionGlobsConfig, SessionNamesConfig } from './connectSequence';

export type SessionRole = 'primary' | 'promoted';

export interface SessionRoleKeys {
  primary: string;
  promoted: string;
}

export type SessionGlobMap = Record<string, string[]>;

const SESSION_ROLE_STATE_KEY = 'session-role-keys';
const SESSION_ROLE_GLOBS_STATE_KEY = 'session-role-globs';

const DEFAULT_SESSION_ROLE_KEYS: SessionRoleKeys = {
  primary: 'clj',
  promoted: 'cljs',
};

const DEFAULT_SESSION_ROLE_GLOBS: Record<SessionRole, string[]> = {
  primary: ['**/*.clj'],
  promoted: ['**/*.cljs'],
};

const DEFAULT_SESSION_GLOB_MAP: SessionGlobMap = {
  [DEFAULT_SESSION_ROLE_KEYS.primary]: [...DEFAULT_SESSION_ROLE_GLOBS.primary],
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

function fromSequenceConfig(config?: SessionNamesConfig): SessionRoleKeys {
  return {
    primary: config?.primary || DEFAULT_SESSION_ROLE_KEYS.primary,
    promoted: config?.promoted || DEFAULT_SESSION_ROLE_KEYS.promoted,
  };
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

  (['primary', 'promoted'] as SessionRole[]).forEach((role) => {
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
  return fromSequenceConfig(sequence?.replSessionNames);
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
  return {
    primary: stored?.primary || DEFAULT_SESSION_ROLE_KEYS.primary,
    promoted: stored?.promoted || DEFAULT_SESSION_ROLE_KEYS.promoted,
  };
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

export function getSessionKeyForRole(role: SessionRole): string {
  const keys = getSessionRoleKeys();
  return keys[role];
}

export function resetSessionRoleKeys(): void {
  setSessionRoleKeys(DEFAULT_SESSION_ROLE_KEYS);
  setSessionRoleGlobs(cloneDefaultGlobMap());
}
