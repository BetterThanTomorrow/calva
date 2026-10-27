import * as vscode from 'vscode';
import * as minimatchLib from 'minimatch';
import type * as globs from './globs';
import type * as nrepl from '.';
import * as utilities from '../utilities';
import * as currentFile from '../current-file';
import * as outputWindow from '../repl-window/repl-window-doc';
import * as sessionRegistry from './session-registry';
import * as sessionRouting from './session-routing';
import * as clientRegistry from './client-registry';
import * as globPaths from './glob-paths';
import * as sessionLabel from './session-label';

// Re-export for consumers
export { formatSessionLabel, type SessionLabelContext } from './session-label';

/**
 * Describes why a particular session was selected by the routing algorithm.
 */
export type RoutingReason =
  | { type: 'repl-input' }
  | { type: 'pinned' }
  | { type: 'repl-window' }
  | { type: 'glob-match'; tier: globs.SessionGlobTier; matchingPattern?: string }
  | { type: 'cljc-within-connection' } // TODO: Find a better name
  | { type: 'first-available' };

export interface RoutingResult {
  sessionKey: string;
  reason: RoutingReason;
}

function buildCandidatePaths(uri: vscode.Uri): string[] {
  const fsPath = uri?.fsPath || uri?.path;
  if (!fsPath) {
    return [];
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const folders: globPaths.WorkspaceFolderInfo[] = [];

  if (workspaceFolder) {
    folders.push({ fsPath: workspaceFolder.uri.fsPath, name: workspaceFolder.name });
  } else if (vscode.workspace.workspaceFolders) {
    folders.push(
      ...vscode.workspace.workspaceFolders.map((folder) => ({
        fsPath: folder.uri.fsPath,
        name: folder.name,
      }))
    );
  }

  return globPaths.buildGlobCandidatePaths(fsPath, folders);
}

interface GlobMatchResult {
  sessionKey: string;
  tier: globs.SessionGlobTier;
  matchingPattern: string;
  score: number;
  order: number;
}

function findSessionKeyForUri(
  uri?: vscode.Uri
): { sessionKey: string; tier: globs.SessionGlobTier; matchingPattern: string } | undefined {
  if (!uri) {
    return undefined;
  }

  const candidatePaths = buildCandidatePaths(uri);
  if (candidatePaths.length === 0) {
    return undefined;
  }

  const sessions = sessionRegistry.listSessions();
  const isBetterMatch = (
    current: GlobMatchResult | undefined,
    candidate: GlobMatchResult
  ): boolean => {
    if (!current) {
      return true;
    }
    if (candidate.score !== current.score) {
      return candidate.score > current.score;
    }
    return candidate.order < current.order;
  };

  let bestAlwaysClaim: GlobMatchResult | undefined;
  let bestFallback: GlobMatchResult | undefined;
  let bestProjectFallback: GlobMatchResult | undefined;

  sessions.forEach((session, index) => {
    const specs = session.globSpecs ?? [];
    if (specs.length === 0) {
      return;
    }

    for (const spec of specs) {
      const normalizedPattern = spec.normalizedPattern || globPaths.toPosixPath(spec.pattern);
      const matched = candidatePaths.some((candidate) =>
        minimatchLib.minimatch(candidate, normalizedPattern, { dot: true })
      );
      if (!matched) {
        continue;
      }
      const candidate: GlobMatchResult = {
        sessionKey: session.key,
        tier: spec.tier,
        matchingPattern: spec.displayPattern || spec.pattern,
        score: spec.score,
        order: index,
      };
      if (spec.tier === 'always-claim') {
        if (isBetterMatch(bestAlwaysClaim, candidate)) {
          bestAlwaysClaim = candidate;
        }
      } else if (spec.tier === 'is-fallback-for') {
        if (isBetterMatch(bestFallback, candidate)) {
          bestFallback = candidate;
        }
      } else if (spec.tier === 'project-fallback') {
        if (isBetterMatch(bestProjectFallback, candidate)) {
          bestProjectFallback = candidate;
        }
      }
    }
  });

  // Priority: always-claim > is-fallback-for > project-fallback
  if (bestAlwaysClaim) {
    return {
      sessionKey: bestAlwaysClaim.sessionKey,
      tier: bestAlwaysClaim.tier,
      matchingPattern: bestAlwaysClaim.matchingPattern,
    };
  }

  if (bestFallback) {
    return {
      sessionKey: bestFallback.sessionKey,
      tier: bestFallback.tier,
      matchingPattern: bestFallback.matchingPattern,
    };
  }

  if (bestProjectFallback) {
    return {
      sessionKey: bestProjectFallback.sessionKey,
      tier: bestProjectFallback.tier,
      matchingPattern: bestProjectFallback.matchingPattern,
    };
  }

  return undefined;
}

/**
 * Given a session key that won the routing via project-fallback tier,
 * resolve the actual session to use based on the per-connection cljc target preference.
 * Returns undefined if the session has no sibling or if cljc resolution isn't applicable.
 *
 * This applies to all project-fallback files (.cljc, .fiddle, and any other unclaimed types)
 * since they all benefit from user-controlled routing between primary and secondary sessions.
 */
function resolveCljcWithinConnection(winningSessionKey: string): string | undefined {
  const clientKey = sessionRegistry.getClientKeyForSession(winningSessionKey);
  if (!clientKey) {
    return undefined;
  }

  const cljcTarget = clientRegistry.getCljcTargetForConnection(clientKey);
  const sessionMeta = sessionRegistry.getSessionMetadata(winningSessionKey);

  if (cljcTarget === 'secondary') {
    if (sessionMeta?.isSecondary) {
      return winningSessionKey;
    }
    const secondaryKey = sessionRegistry.getSecondarySessionKeyForClient(clientKey);
    if (secondaryKey && sessionRegistry.getSession(secondaryKey)) {
      return secondaryKey;
    }
    return winningSessionKey;
  } else {
    if (!sessionMeta?.isSecondary) {
      return winningSessionKey;
    }
    const primaryKey = sessionRegistry.getPrimarySessionKeyForClient(clientKey);
    if (primaryKey && sessionRegistry.getSession(primaryKey)) {
      return primaryKey;
    }
    return winningSessionKey;
  }
}

/**
 * Determines the appropriate session key and why it was selected.
 * Returns detailed routing information for UI display.
 *
 * @param doc - The document to route (defaults to the current file, or the session the REPL Input
 * keeps while it is the current editor)
 */
function getRoutingInfo(doc?: vscode.TextDocument): RoutingResult | undefined {
  return doc
    ? getRoutingInfoForUri(doc.uri)
    : replInputRouting() ?? getRoutingInfoForUri(currentFile.currentFileUri());
}

// The session that a REPL Input's lock without a source file keeps, as evaluating from it does, pin or not
function replInputRouting(): RoutingResult | undefined {
  const sessionKey = connectedSessionKey(currentFile.currentReplInputSessionKey());
  return sessionKey ? { sessionKey, reason: { type: 'repl-input' } } : undefined;
}

/**
 * Determines the session key for the file at `uri`, and why, from its path, so that a file routes
 * without being opened. Without a `uri`, routes without a document.
 */
function getRoutingInfoForUri(uri: vscode.Uri | undefined): RoutingResult | undefined {
  return pinnedRouting() ?? replWindowRouting(uri) ?? globRouting(uri) ?? firstAvailableRouting();
}

function connectedSessionKey(sessionKey: string | undefined): string | undefined {
  return sessionKey && sessionRegistry.getSession(sessionKey) ? sessionKey : undefined;
}

function cljcRouting(sessionKey: string): RoutingResult | undefined {
  const cljcResolved = resolveCljcWithinConnection(sessionKey);
  return cljcResolved
    ? { sessionKey: cljcResolved, reason: { type: 'cljc-within-connection' } }
    : undefined;
}

// 1. Pinned session takes priority
function pinnedRouting(): RoutingResult | undefined {
  const sessionKey = connectedSessionKey(sessionRouting.resolvePinnedSession());
  return sessionKey ? { sessionKey, reason: { type: 'pinned' } } : undefined;
}

// 2. Repl window doc has its own session setting
function replWindowRouting(uri: vscode.Uri | undefined): RoutingResult | undefined {
  const sessionKey =
    outputWindow.isReplWindowUri(uri) && connectedSessionKey(outputWindow.getSessionType());
  return sessionKey ? { sessionKey, reason: { type: 'repl-window' } } : undefined;
}

// 3. Glob pattern matching
function globRouting(uri: vscode.Uri | undefined): RoutingResult | undefined {
  const globMatch = findSessionKeyForUri(uri);
  if (!globMatch || !connectedSessionKey(globMatch.sessionKey)) {
    return undefined;
  }
  // For files landing in project-fallback, apply per-connection cljc preference
  // This includes .cljc, .fiddle, and any other unclaimed file types
  const cljcResolved =
    globMatch.tier === 'project-fallback' ? cljcRouting(globMatch.sessionKey) : undefined;
  return (
    cljcResolved ?? {
      sessionKey: globMatch.sessionKey,
      reason: {
        type: 'glob-match',
        tier: globMatch.tier,
        matchingPattern: globMatch.matchingPattern,
      },
    }
  );
}

// 4. First available session with cljc preference applied
// Even when no globs match, respect the user's cljc target preference
function firstAvailableRouting(): RoutingResult | undefined {
  const sessionKey = sessionRegistry.listSessions()[0]?.key;
  if (!sessionKey) {
    return undefined;
  }
  return cljcRouting(sessionKey) ?? { sessionKey, reason: { type: 'first-available' } };
}

/**
 * Determines the appropriate session key using simplified routing:
 * 1. Pinned session (user override)
 * 2. REPL Window session (REPL output window)
 * 3. Glob pattern matching
 * 4. CLJC session preference (fallback for unclaimed files)
 * 5. First available session (defensive fallback)
 *
 * @param doc - The document to route (defaults to the current file)
 */
function getSessionKey(doc?: vscode.TextDocument): string | undefined {
  return getRoutingInfo(doc)?.sessionKey;
}

function getSession(doc?: vscode.TextDocument): nrepl.NReplSession {
  const sessionKey = getSessionKey(doc);

  // Try getting from registry first
  if (sessionKey) {
    const session = sessionRegistry.getSession(sessionKey);
    if (session) {
      return session;
    }
  }

  // Fallback for REPL window session
  if (outputWindow.isReplWindowUri(doc?.uri ?? currentFile.currentFileUri())) {
    return outputWindow.getSession();
  }

  return null;
}

function updateReplSessionType() {
  const replSessionType = getSessionKey();
  utilities.cljsLib.setStateValue('current-session-type', replSessionType);
}

function getReplSessionTypeFromState() {
  return utilities.cljsLib.getStateValue('current-session-type');
}

/**
 * Determines the context prefix for a session label based on the current routing.
 * VS Code wrapper around the pure determineSessionLabelContext function.
 *
 * @param options.isPinned - Whether the session is pinned (pinned sessions don't get context prefixes)
 * @param options.uri - The file to check for context (defaults to the current file)
 * @returns The context type for the session label
 */
function getSessionLabelContext(options?: {
  isPinned?: boolean;
  uri?: vscode.Uri;
}): sessionLabel.SessionLabelContext {
  const { isPinned = false, uri = currentFile.currentFileUri() } = options ?? {};
  const routingInfo = getRoutingInfoForUri(uri);
  const fileType = utilities.getFileType(uri);

  return sessionLabel.determineSessionLabelContext({
    isPinned,
    isReplWindow: outputWindow.isReplWindowUri(uri),
    isCljcRouting: routingInfo?.reason.type === 'cljc-within-connection',
    fileExtension: fileType,
  });
}

export {
  getSession,
  updateReplSessionType,
  getReplSessionTypeFromState,
  getSessionKey,
  getRoutingInfo,
  getRoutingInfoForUri,
  getSessionLabelContext,
};
