/**
 * Shadow-CLJS Runtime Core - Pure Functions
 *
 * Pure logic for shadow-cljs runtime management.
 * This module is VS Code-free and operates solely on data structures.
 */

export interface RuntimeInfo {
  runtimeId: number;
  description: string;
  buildId: string;
  host: string;
  workerId: number;
  sinceInst: number;
  sinceDescription: string;
}

export interface ShadowApiRuntimeInfo {
  'client-id': number;
  'user-agent'?: string;
  desc?: string;
  type: string;
  lang: string;
  'build-id': string;
  host: string;
  'worker-id': number;
  dom?: boolean;
  since?: Date;
  sinceInst?: number;
  sinceDescription?: string;
  'proc-id'?: string;
  'connection-info'?: {
    remote: boolean;
    websocket: boolean;
  };
}

/**
 * Format a timestamp to a human-readable local time string
 */
export function formatSinceDescription(since: Date | undefined): string {
  if (!since) {
    return 'Unknown time';
  }

  return since.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  });
}

export function normalizeRuntimeInfo(apiInfo: ShadowApiRuntimeInfo): RuntimeInfo {
  const sinceDate = apiInfo.since;
  const sinceInst = sinceDate ? sinceDate.getTime() : 0;
  const sinceDescription = formatSinceDescription(sinceDate);

  return {
    runtimeId: apiInfo['client-id'],
    description: apiInfo.desc || apiInfo['user-agent'] || 'No description',
    buildId: apiInfo['build-id'],
    host: apiInfo.host,
    workerId: apiInfo['worker-id'],
    sinceInst,
    sinceDescription,
  };
}

export type MessageAction =
  | { type: 'runtime-disconnected'; runtimeId: number }
  | { type: 'runtime-connected'; runtimeId: number; runtimeInfo: RuntimeInfo }
  | { type: 'no-action' };

export interface NotifyMessageData {
  op: string;
  'client-id'?: number;
  'event-op'?: string;
  'client-info'?: ShadowApiRuntimeInfo;
}

/**
 * Pure decision function for handling shadow-remote notification messages.
 * Returns the action to take based on the message and current state.
 */
export function decideMessageAction(
  data: NotifyMessageData,
  currentRuntimeId: number | undefined
): MessageAction {
  if (data.op !== 'notify' || !data['client-id']) {
    return { type: 'no-action' };
  }

  const runtimeId = data['client-id'];
  const eventOp = data['event-op'];

  if (eventOp === 'client-disconnect' && runtimeId === currentRuntimeId) {
    return { type: 'runtime-disconnected', runtimeId };
  }

  if (eventOp === 'client-connect' && !currentRuntimeId) {
    const clientInfo = data['client-info'];
    if (clientInfo) {
      const runtimeInfo = normalizeRuntimeInfo(clientInfo);
      runtimeInfo.runtimeId = runtimeId; // Notification infos lack client id
      return { type: 'runtime-connected', runtimeId, runtimeInfo };
    }
  }

  return { type: 'no-action' };
}
