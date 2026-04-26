/**
 * Output destination types and pure utility functions.
 * This module is free of VS Code dependencies so it can be unit-tested directly.
 */

export type OutputDestination = 'repl-window' | 'output-channel' | 'terminal' | 'output-view';

export type OutputDestinationValue = OutputDestination | OutputDestination[];

export function normalizeDestinations(value: OutputDestinationValue): OutputDestination[] {
  return Array.isArray(value) ? [...new Set(value)] : [value];
}
