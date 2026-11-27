// Tracks which "who" values have evaluated on each session,
// enabling API consumers to see if other parties evaluated since their last call.

// sessionKey → Map<who, Set<otherWho>>
const tracking = new Map<string, Map<string, Set<string>>>();

// nrepl sessionId → current who (set when eval starts, read by out-of-band handlers)
const currentWho = new Map<string, string>();

function ensureSession(sessionKey: string): Map<string, Set<string>> {
  let whoMap = tracking.get(sessionKey);
  if (!whoMap) {
    whoMap = new Map();
    tracking.set(sessionKey, whoMap);
  }
  return whoMap;
}

export function recordEvaluation(sessionKey: string, who: string): void {
  const whoMap = ensureSession(sessionKey);
  // For every *other* who that has an entry, add this who to their set
  for (const [trackedWho, others] of whoMap) {
    if (trackedWho !== who) {
      others.add(who);
    }
  }
  // Ensure this who has an entry (with empty set — they haven't missed themselves)
  if (!whoMap.has(who)) {
    whoMap.set(who, new Set());
  }
}

export function getOtherWhosSinceLast(sessionKey: string, who: string): string[] {
  const whoMap = tracking.get(sessionKey);
  if (!whoMap) {
    return [];
  }
  const others = whoMap.get(who);
  if (!others) {
    return [];
  }
  const result = Array.from(others);
  others.clear();
  return result;
}

export function clearSessionTracking(sessionKey: string): void {
  tracking.delete(sessionKey);
}

export function setCurrentWho(sessionId: string, who: string): void {
  currentWho.set(sessionId, who);
}

export function getCurrentWho(sessionId: string): string | undefined {
  return currentWho.get(sessionId);
}

// The whos Calva gives evaluations nobody named: the user's own, and API callers that gave none
const calvaWhos = ['ui', 'api'];

// The `who` an nREPL message carries, so the server knows who evaluated. Calva's own whos stay off
// the wire.
export function nreplWho(who: string | undefined): { who?: string } {
  return who && !calvaWhos.includes(who) ? { who } : {};
}

export function clearCurrentWho(sessionId: string): void {
  currentWho.delete(sessionId);
}
