import type { ReplConnectSequence } from './connect-sequence-types';

export interface ConnectSequenceProjectTypeDefaults {
  defaultNReplPortFile?: string[];
  defaultFallbackPort?: number;
}

export function effectiveNReplPortFileSegments(
  sequence: Pick<ReplConnectSequence, 'nReplPortFile'>,
  projectTypeDefaults?: ConnectSequenceProjectTypeDefaults
): string[] | undefined {
  const portFileSegments = sequence.nReplPortFile ?? projectTypeDefaults?.defaultNReplPortFile;
  return portFileSegments ? [...portFileSegments] : undefined;
}

export function effectiveFallbackPort(
  sequence: Pick<ReplConnectSequence, 'fallbackPort'>,
  projectTypeDefaults?: ConnectSequenceProjectTypeDefaults
): number | undefined {
  return sequence.fallbackPort ?? projectTypeDefaults?.defaultFallbackPort;
}
