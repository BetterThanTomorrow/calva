import * as path from 'path';
import type * as csTypes from './nrepl/connect-sequence-types';
import * as fileArg from './util/resolve-file-arg';

export type RootDecisionConnectType = 'jack-in' | 'connect';

export interface RootDecisionInput {
  connectType: RootDecisionConnectType;
  passedSequence?: csTypes.ReplConnectSequence;
  disableAutoSelect: boolean;
  sequences: csTypes.ReplConnectSequence[];
  candidateRoots: string[];
  closestRoot?: string;
  workspaceFolders: string[];
}

export type RootDecision =
  | { root: string; sequence?: csTypes.ReplConnectSequence }
  | {
      ask: { candidates: string[]; preselect?: string };
      sequence?: csTypes.ReplConnectSequence;
    }
  | { noCandidates: true; sequence?: csTypes.ReplConnectSequence };

function firstWorkspaceFolder(input: RootDecisionInput): string | undefined {
  return input.workspaceFolders[0];
}

/**
 * Returns the sequence's `projectRootPath` as an absolute path. A relative
 * path is relative to the first workspace folder.
 */
function resolvedSequenceRoot(
  sequence: csTypes.ReplConnectSequence | undefined,
  workspaceRoot: string | undefined
): string | undefined {
  if (!sequence?.projectRootPath?.length) {
    return undefined;
  }
  return fileArg.resolveFilePath(sequence.projectRootPath, workspaceRoot);
}

function isSamePath(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && path.relative(a, b) === '';
}

/**
 * Returns the sequence's `projectRootPath` as an absolute path. This is the
 * one reading of `projectRootPath`: a relative path is relative to the first
 * of `workspaceFolders`.
 */
export function sequenceRootPath(
  sequence: csTypes.ReplConnectSequence | undefined,
  workspaceFolders: string[]
): string | undefined {
  return resolvedSequenceRoot(sequence, workspaceFolders[0]);
}

/**
 * Returns the sequence's root when it names another folder than `chosenRoot`.
 */
export function mismatchedSequenceRoot(
  sequence: csTypes.ReplConnectSequence,
  chosenRoot: string,
  workspaceFolders: string[]
): string | undefined {
  const root = sequenceRootPath(sequence, workspaceFolders);
  return root !== undefined && !isSamePath(root, chosenRoot) ? root : undefined;
}

function autoSelectedSequences(input: RootDecisionInput): csTypes.ReplConnectSequence[] {
  if (input.disableAutoSelect) {
    return [];
  }
  const jackIn = input.connectType === 'jack-in';
  return input.sequences.filter((sequence) =>
    jackIn ? sequence.autoSelectForJackIn : sequence.autoSelectForConnect
  );
}

/**
 * Returns the auto-selected sequence whose root is the closest root,
 * otherwise the first auto-selected sequence.
 */
function chosenAutoSelect(input: RootDecisionInput): csTypes.ReplConnectSequence | undefined {
  const candidates = autoSelectedSequences(input);
  const workspaceRoot = firstWorkspaceFolder(input);
  const matched = candidates.find((sequence) =>
    isSamePath(resolvedSequenceRoot(sequence, workspaceRoot), input.closestRoot)
  );
  return matched ?? candidates[0];
}

function withSequence(
  decision: RootDecision,
  sequence: csTypes.ReplConnectSequence | undefined
): RootDecision {
  return sequence ? { ...decision, sequence } : decision;
}

function fromCandidates(
  input: RootDecisionInput,
  sequence: csTypes.ReplConnectSequence | undefined
): RootDecision {
  if (input.candidateRoots.length === 0) {
    return withSequence({ noCandidates: true }, sequence);
  }
  if (input.candidateRoots.length === 1) {
    return withSequence({ root: input.candidateRoots[0] }, sequence);
  }
  return withSequence(
    { ask: { candidates: input.candidateRoots, preselect: input.closestRoot } },
    sequence
  );
}

/**
 * Returns the project root and the connect sequence that decided it.
 * `ask` means the caller shows the Project Root menu. An auto-selected
 * sequence that has no `projectRootPath` is still returned, so the project
 * type menu can be skipped. A passed sequence keeps auto-select out of the
 * decision.
 */
export function decideProjectRoot(input: RootDecisionInput): RootDecision {
  const passed = input.passedSequence;
  if (passed) {
    const passedRoot = resolvedSequenceRoot(passed, firstWorkspaceFolder(input));
    return passedRoot ? { root: passedRoot, sequence: passed } : fromCandidates(input, undefined);
  }

  const chosen = chosenAutoSelect(input);
  if (chosen?.projectRootPath?.length) {
    const root = resolvedSequenceRoot(chosen, firstWorkspaceFolder(input));
    if (root) {
      return { root, sequence: chosen };
    }
    return withSequence({ noCandidates: true }, chosen);
  }

  return fromCandidates(input, chosen);
}
