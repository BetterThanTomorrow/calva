import type * as csTypes from './nrepl/connect-sequence-types';
import * as fileArg from './util/resolve-file-arg';

export type RootDecisionConnectType = 'jack-in' | 'connect';

/**
 * A connect sequence plus the comparison key the caller computed for its
 * `projectRootPath`. The key is what `asRelativePath` produces today.
 */
export interface SequenceForRootDecision {
  sequence: csTypes.ReplConnectSequence;
  rootKey?: string;
}

export interface RootDecisionInput {
  connectType: RootDecisionConnectType;
  passedSequence?: SequenceForRootDecision;
  disableAutoSelect: boolean;
  sequences: SequenceForRootDecision[];
  candidateRoots: string[];
  closestRoot?: string;
  closestRootKey?: string;
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

function resolvedSequenceRoot(
  sequence: csTypes.ReplConnectSequence | undefined,
  workspaceRoot: string | undefined
): string | undefined {
  if (!sequence?.projectRootPath?.length) {
    return undefined;
  }
  return fileArg.resolveFilePath(sequence.projectRootPath, workspaceRoot);
}

function autoSelectedSequences(input: RootDecisionInput): SequenceForRootDecision[] {
  if (input.disableAutoSelect) {
    return [];
  }
  const jackIn = input.connectType === 'jack-in';
  return input.sequences.filter((entry) =>
    jackIn ? entry.sequence.autoSelectForJackIn : entry.sequence.autoSelectForConnect
  );
}

/**
 * The sequence whose comparison key equals the closest root, otherwise the
 * first auto-selected sequence.
 */
function chosenAutoSelect(input: RootDecisionInput): SequenceForRootDecision | undefined {
  const candidates = autoSelectedSequences(input);
  const matched = candidates.find(
    (entry) =>
      !!entry.sequence.projectRootPath?.length &&
      entry.rootKey != null &&
      entry.rootKey === input.closestRootKey
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
  const passed = input.passedSequence?.sequence;
  if (passed) {
    const passedRoot = resolvedSequenceRoot(passed, firstWorkspaceFolder(input));
    return passedRoot ? { root: passedRoot, sequence: passed } : fromCandidates(input, undefined);
  }

  const chosen = chosenAutoSelect(input);
  if (chosen?.sequence.projectRootPath?.length) {
    const root = resolvedSequenceRoot(chosen.sequence, firstWorkspaceFolder(input));
    if (root) {
      return { root, sequence: chosen.sequence };
    }
    return withSequence({ noCandidates: true }, chosen.sequence);
  }

  return fromCandidates(input, chosen?.sequence);
}
