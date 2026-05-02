import type * as connectSequenceTypes from './connect-sequence-types';

export interface ConnectSequenceProjectTypeDefaults {
  defaultNReplPortFile?: string[];
  defaultFallbackPort?: number;
  defaultWebSocketPort?: number | boolean;
}

export function effectiveNReplPortFileSegments(
  sequence: Pick<connectSequenceTypes.ReplConnectSequence, 'nReplPortFile'>,
  projectTypeDefaults?: ConnectSequenceProjectTypeDefaults
): string[] | undefined {
  const portFileSegments = sequence.nReplPortFile ?? projectTypeDefaults?.defaultNReplPortFile;
  return portFileSegments ? [...portFileSegments] : undefined;
}

export function effectiveFallbackPort(
  sequence: Pick<connectSequenceTypes.ReplConnectSequence, 'fallbackPort'>,
  projectTypeDefaults?: ConnectSequenceProjectTypeDefaults
): number | undefined {
  return sequence.fallbackPort ?? projectTypeDefaults?.defaultFallbackPort;
}

export function effectiveWebSocketPort(
  sequence: Pick<connectSequenceTypes.ReplConnectSequence, 'webSocketPort'>,
  projectTypeDefaults?: ConnectSequenceProjectTypeDefaults
): number | boolean | undefined {
  return sequence.webSocketPort ?? projectTypeDefaults?.defaultWebSocketPort;
}

export function effectiveSelectedPortBehaviour(
  sequence: Pick<connectSequenceTypes.ReplConnectSequence, 'selectedPortBehaviour'>,
  defaultBehaviour: connectSequenceTypes.SelectedPortBehaviour
): connectSequenceTypes.SelectedPortBehaviour {
  return sequence.selectedPortBehaviour ?? defaultBehaviour;
}
