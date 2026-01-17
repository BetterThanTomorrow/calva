/**
 * Session name suffix management for automatic session name conflict resolution.
 */

const POOL_SIZE = 100;

const SUFFIX_POOL: readonly string[] = Array.from({ length: POOL_SIZE }, (_, i) =>
  (i + 2).toString()
);

/** Set of suffixes currently in use */
const usedSuffixes: Set<string> = new Set();

/**
 * Acquire the next available suffix from the pool.
 * Returns undefined if the pool is exhausted.
 */
export function acquireNextAvailableSuffix(): string | undefined {
  for (const suffix of SUFFIX_POOL) {
    if (!usedSuffixes.has(suffix)) {
      usedSuffixes.add(suffix);
      return suffix;
    }
  }
  return undefined;
}

/**
 * Release a suffix back to the pool for reuse.
 */
export function releaseSuffix(suffix: string): void {
  usedSuffixes.delete(suffix);
}

/**
 * Reserve a specific suffix, marking it as in use.
 * Used during reconnection to ensure the suffix cannot be acquired by another connection.
 * Returns true if the suffix was successfully reserved, false if already in use.
 */
export function reserveSuffix(suffix: string): boolean {
  if (usedSuffixes.has(suffix)) {
    return false;
  }
  usedSuffixes.add(suffix);
  return true;
}

/**
 * Check if the suffix pool is exhausted.
 */
export function isPoolExhausted(): boolean {
  return usedSuffixes.size >= SUFFIX_POOL.length;
}

/**
 * Extract the suffix from a session name, if present.
 * Returns `undefined` if no suffix from the pool is found.
 */
export function extractSuffix(sessionName: string): string | undefined {
  for (const suffix of SUFFIX_POOL) {
    if (sessionName.endsWith(`:${suffix}`)) {
      return suffix;
    }
  }
  return undefined;
}

/**
 * Apply a suffix to a base session name.
 */
export function applySuffix(baseName: string, suffix: string): string {
  return `${baseName}:${suffix}`;
}

/**
 * Strip any suffix from a session name, returning the base name.
 * If no suffix from the pool is present, returns the name unchanged.
 */
export function stripSuffix(sessionName: string): string {
  const suffix = extractSuffix(sessionName);
  if (suffix) {
    return sessionName.slice(0, -(suffix.length + 1)); // +1 for the colon
  }
  return sessionName;
}

// --- Testing utilities ---

/**
 * Reset the suffix pool to its initial state (all suffixes available).
 * For testing purposes only.
 */
export function resetPool(): void {
  usedSuffixes.clear();
}

/**
 * Get a list of currently available (unused) suffixes.
 * For testing purposes only.
 */
export function getAvailableSuffixes(): string[] {
  return SUFFIX_POOL.filter((suffix) => !usedSuffixes.has(suffix));
}

/**
 * Get a list of currently used suffixes.
 * For testing purposes only.
 */
export function getUsedSuffixes(): string[] {
  return Array.from(usedSuffixes);
}
