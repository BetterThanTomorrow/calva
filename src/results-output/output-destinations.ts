/**
 * Output destination types and pure utility functions.
 * This module is free of VS Code dependencies so it can be unit-tested directly.
 */

import * as path from 'path';

export type OutputDestination = 'repl-window' | 'output-channel' | 'terminal' | 'output-view';

/**
 * A destination value as it appears in user configuration.
 * - A bare string: single destination (builtin name or file path)
 * - A top-level array: multiple destinations
 * - A nested string[] element inside the array: path segments joined via path.join
 */
export type OutputDestinationValue = string | (string | string[])[];

export function normalizeDestinations(value: OutputDestinationValue): string[] {
  if (!Array.isArray(value)) {
    return [value];
  }
  const result: string[] = [];
  for (const element of value) {
    if (Array.isArray(element)) {
      result.push(path.join(...element));
    } else {
      result.push(element);
    }
  }
  return [...new Set(result)];
}
