import * as sessionRegistry from './session-registry';
import * as sessionRouting from './session-routing';

function removeSessionKeys(sessionKeys: string[]): string[] {
  const removed: string[] = [];
  sessionKeys.forEach((key) => {
    if (!key) {
      return;
    }
    sessionRegistry.unregisterSession(key);
    removed.push(key);
  });

  if (removed.length > 0) {
    sessionRouting.removeSessionKeysFromRouting(removed);
  }

  return removed;
}

export function teardownSessionsForClient(clientKey: string): string[] {
  if (!clientKey) {
    return [];
  }
  const sessions = sessionRegistry.listSessionsByClient(clientKey);
  const sessionKeys = sessions.map((session) => session.key);
  return removeSessionKeys(sessionKeys);
}

export function teardownSessionKeys(sessionKeys: string[]): string[] {
  return removeSessionKeys(sessionKeys);
}
