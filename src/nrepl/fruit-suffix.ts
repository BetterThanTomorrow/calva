/**
 * Fruit suffix management for automatic session name conflict resolution.
 *
 * When multiple REPLs would have the same session names (e.g., two deps.edn projects
 * both wanting `clj`/`cljs`), this module provides fruit suffixes to distinguish them
 * (e.g., `clj-apple`, `cljs-apple`).
 */

const FRUIT_POOL: readonly string[] = [
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

/** Set of fruits currently in use */
const usedFruits: Set<string> = new Set();

/**
 * Acquire the next available fruit from the pool.
 * Returns undefined if the pool is exhausted.
 */
export function acquireFruit(): string | undefined {
  for (const fruit of FRUIT_POOL) {
    if (!usedFruits.has(fruit)) {
      usedFruits.add(fruit);
      return fruit;
    }
  }
  return undefined;
}

/**
 * Release a fruit back to the pool for reuse.
 */
export function releaseFruit(fruit: string): void {
  usedFruits.delete(fruit);
}

/**
 * Check if the fruit pool is exhausted.
 */
export function isPoolExhausted(): boolean {
  return usedFruits.size >= FRUIT_POOL.length;
}

/**
 * Extract the fruit suffix from a session name, if present.
 * Returns undefined if no fruit suffix is found.
 *
 * Examples:
 * - `clj-apple` → `apple`
 * - `cljs-banana` → `banana`
 * - `clj` → undefined
 * - `my-session` → undefined (no fruit suffix)
 */
export function extractFruitSuffix(sessionName: string): string | undefined {
  for (const fruit of FRUIT_POOL) {
    if (sessionName.endsWith(`-${fruit}`)) {
      return fruit;
    }
  }
  return undefined;
}

/**
 * Apply a fruit suffix to a base session name.
 *
 * Examples:
 * - `clj`, `apple` → `clj-apple`
 * - `cljs`, `banana` → `cljs-banana`
 */
export function applyFruitSuffix(baseName: string, fruit: string): string {
  return `${baseName}-${fruit}`;
}

/**
 * Strip any fruit suffix from a session name, returning the base name.
 * If no fruit suffix is present, returns the name unchanged.
 *
 * Examples:
 * - `clj-apple` → `clj`
 * - `cljs-banana` → `cljs`
 * - `clj` → `clj`
 */
export function stripFruitSuffix(sessionName: string): string {
  const fruit = extractFruitSuffix(sessionName);
  if (fruit) {
    return sessionName.slice(0, -(fruit.length + 1)); // +1 for the hyphen
  }
  return sessionName;
}

// --- Testing utilities ---

/**
 * Reset the fruit pool to its initial state (all fruits available).
 * For testing purposes only.
 */
export function resetPool(): void {
  usedFruits.clear();
}

/**
 * Get a list of currently available (unused) fruits.
 * For testing purposes only.
 */
export function getAvailableFruits(): string[] {
  return FRUIT_POOL.filter((fruit) => !usedFruits.has(fruit));
}

/**
 * Get a list of currently used fruits.
 * For testing purposes only.
 */
export function getUsedFruits(): string[] {
  return Array.from(usedFruits);
}
