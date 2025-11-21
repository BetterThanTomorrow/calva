import { getStateValue, setStateValue } from '../../out/cljs-lib/cljs-lib';
import { ReplConnectSequence, SessionNamesConfig } from './connectSequence';

export type SessionRole = 'primary' | 'promoted';

export interface SessionRoleKeys {
  primary: string;
  promoted: string;
}

const SESSION_ROLE_STATE_KEY = 'session-role-keys';

const DEFAULT_SESSION_ROLE_KEYS: SessionRoleKeys = {
  primary: 'clj',
  promoted: 'cljs',
};

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

export function deriveSessionRoleKeys(sequence?: ReplConnectSequence): SessionRoleKeys {
  return fromSequenceConfig(sequence?.replSessionNames);
}

export function setSessionRoleKeys(keys: SessionRoleKeys): void {
  setStateValue(SESSION_ROLE_STATE_KEY, keys);
}

export function initializeSessionRoleKeys(sequence?: ReplConnectSequence): SessionRoleKeys {
  const keys = deriveSessionRoleKeys(sequence);
  setSessionRoleKeys(keys);
  return keys;
}

export function getSessionRoleKeys(): SessionRoleKeys {
  const stored = readStoredKeys();
  return {
    primary: stored?.primary || DEFAULT_SESSION_ROLE_KEYS.primary,
    promoted: stored?.promoted || DEFAULT_SESSION_ROLE_KEYS.promoted,
  };
}

export function getSessionKeyForRole(role: SessionRole): string {
  const keys = getSessionRoleKeys();
  return keys[role];
}

export function resetSessionRoleKeys(): void {
  setSessionRoleKeys(DEFAULT_SESSION_ROLE_KEYS);
}
