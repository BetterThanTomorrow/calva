import type { ConnectionState } from './client-registry';
import type { SessionMetadata } from './session-registry';

export type ReplSessionInfo = {
  clientKey?: string;
  replSessionKey: string;
  projectRoot?: string;
  lastActivity?: number;
  globs?: string[];
  currentRoutedTarget?: boolean;
  replType: 'clj' | 'cljs';
  hasBuilds: boolean;
  supportsRuntimes: boolean;
  availableBuilds?: string[];
  currentlyConnectedCljsBuild?: string;
  currentlyConnectedRuntimeId?: number;
};

function cljsSessionFields(connState: ConnectionState | undefined) {
  if (!connState) {
    return {
      hasBuilds: false,
      supportsRuntimes: false,
      availableBuilds: undefined,
      currentlyConnectedCljsBuild: undefined,
      currentlyConnectedRuntimeId: undefined,
    };
  }
  return {
    hasBuilds: !!connState.hasBuilds,
    supportsRuntimes: connState.cljsTypeName === 'shadow-cljs',
    availableBuilds: connState.availableBuilds,
    currentlyConnectedCljsBuild: connState.cljsBuild || undefined,
    currentlyConnectedRuntimeId: connState.shadowCljsRuntimeId,
  };
}

/**
 * Public listSessions / listSessionsAndRuntimes row from session metadata and
 * optional connection state. clientKey is the owning connection's key.
 */
export function buildReplSessionInfo(
  session: SessionMetadata,
  currentSessionKey: string | undefined,
  relativeProjectRoot: string | undefined,
  connState: ConnectionState | undefined
): ReplSessionInfo {
  const isCljs = session.isSecondary || false;
  return {
    clientKey: session.connectionOwnerId,
    replSessionKey: session.key,
    projectRoot: relativeProjectRoot,
    lastActivity: session.lastActivity,
    globs: session.globs,
    currentRoutedTarget: session.key === currentSessionKey,
    replType: isCljs ? 'cljs' : 'clj',
    ...(isCljs
      ? cljsSessionFields(connState)
      : {
          hasBuilds: false,
          supportsRuntimes: false,
          availableBuilds: undefined,
          currentlyConnectedCljsBuild: undefined,
          currentlyConnectedRuntimeId: undefined,
        }),
  };
}
