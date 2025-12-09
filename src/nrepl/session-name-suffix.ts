/**
 * Session name suffix management for automatic session name conflict resolution.
 *
 * The suffix pool defaults to a list of fruits, but the rest of the code
 * treats these as opaque strings so the list can be swapped without further
 * changes.
 */

const SUFFIX_POOL: readonly string[] = [
  'apple',
  'banana',
  'cherry',
  'date',
  'elderberry',
  'fig',
  'grape',
  'honeydew',
  'kiwi',
  'lemon',
  'mango',
  'nectarine',
  'orange',
  'papaya',
  'quince',
  'raspberry',
  'strawberry',
  'tangerine',
  'watermelon',
];

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
 * Returns undefined if no suffix from the pool is found.
 *
 * Examples:
 * - `clj:apple` → `apple`
 * - `cljs:banana` → `banana`
 * - `clj` → undefined
 * - `my-session` → undefined (no suffix)
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
 *
 * Examples:
 * - `clj`, `apple` → `clj:apple`
 * - `cljs`, `banana` → `cljs:banana`
 */
export function applySuffix(baseName: string, suffix: string): string {
  return `${baseName}:${suffix}`;
}

/**
 * Strip any suffix from a session name, returning the base name.
 * If no suffix from the pool is present, returns the name unchanged.
 *
 * Examples:
 * - `clj:apple` → `clj`
 * - `cljs:banana` → `cljs`
 * - `clj` → `clj`
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
