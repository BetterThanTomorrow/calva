import * as vscode from 'vscode';
import * as minimatchLib from 'minimatch';
import { NReplSession } from '.';
import { cljsLib, tryToGetDocument, getFileType } from '../utilities';
import * as outputWindow from '../repl-window/repl-doc';
import * as sessionRegistry from './session-registry';
import * as sessionRouting from './session-routing';
import * as clientRegistry from './client-registry';
import type { WorkspaceFolderInfo } from './glob-paths';
import * as globPaths from './glob-paths';
import type { SessionGlobTier } from './globs';
import * as config from '../config';
import * as sessionLabel from './session-label';

// Re-export for consumers
export { formatSessionLabel, type SessionLabelContext } from './session-label';

/**
 * Describes why a particular session was selected by the routing algorithm.
 */
export type RoutingReason =
  | { type: 'pinned' }
  | { type: 'repl-window' }
  | { type: 'glob-match'; tier: SessionGlobTier; matchingPattern?: string }
  | { type: 'cljc-within-connection' } // TODO: Find a better name
  | { type: 'first-available' };

export interface RoutingResult {
  sessionKey: string;
  reason: RoutingReason;
}

function buildCandidatePaths(doc: vscode.TextDocument): string[] {
  const uri = doc.uri;
  const fsPath = uri?.fsPath || uri?.path;
  if (!fsPath) {
    return [];
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const folders: WorkspaceFolderInfo[] = [];

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
  tier: SessionGlobTier;
  matchingPattern: string;
  score: number;
  order: number;
}

function findSessionKeyForDocument(
  doc?: vscode.TextDocument
): { sessionKey: string; tier: SessionGlobTier; matchingPattern: string } | undefined {
  if (!doc) {
    return undefined;
  }

  const candidatePaths = buildCandidatePaths(doc);
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
function resolveCljcWithinConnection(
  winningSessionKey: string,
  _doc?: vscode.TextDocument
): string | undefined {
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
 */
function getRoutingInfo(): RoutingResult | undefined {
  const doc = tryToGetDocument({});

  // 1. Pinned session takes priority
  const pinnedSession = sessionRouting.resolvePinnedSession();
  if (pinnedSession && sessionRegistry.getSession(pinnedSession)) {
    return { sessionKey: pinnedSession, reason: { type: 'pinned' } };
  }

  // 2. Results doc has its own session setting
  if (outputWindow.isResultsDoc(doc)) {
    const resultsDocType = outputWindow.getSessionType();
    if (resultsDocType && sessionRegistry.getSession(resultsDocType)) {
      return { sessionKey: resultsDocType, reason: { type: 'repl-window' } };
    }
  }

  // 3. Glob pattern matching
  const globMatch = findSessionKeyForDocument(doc);
  if (globMatch && sessionRegistry.getSession(globMatch.sessionKey)) {
    // For files landing in project-fallback, apply per-connection cljc preference
    // This includes .cljc, .fiddle, and any other unclaimed file types
    if (globMatch.tier === 'project-fallback') {
      const cljcResolved = resolveCljcWithinConnection(globMatch.sessionKey, doc);
      if (cljcResolved) {
        return { sessionKey: cljcResolved, reason: { type: 'cljc-within-connection' } };
      }
    }
    return {
      sessionKey: globMatch.sessionKey,
      reason: {
        type: 'glob-match',
        tier: globMatch.tier,
        matchingPattern: globMatch.matchingPattern,
      },
    };
  }

  // 4. First available session with cljc preference applied
  // Even when no globs match, respect the user's cljc target preference
  const sessions = sessionRegistry.listSessions();
  if (sessions[0]?.key) {
    const cljcResolved = resolveCljcWithinConnection(sessions[0].key, doc);
    if (cljcResolved) {
      return { sessionKey: cljcResolved, reason: { type: 'cljc-within-connection' } };
    }
    return { sessionKey: sessions[0].key, reason: { type: 'first-available' } };
  }

  return undefined;
}

/**
 * Determines the appropriate session key using simplified routing:
 * 1. Pinned session (user override)
 * 2. Results doc session (REPL output window)
 * 3. Glob pattern matching
 * 4. CLJC session preference (fallback for unclaimed files)
 * 5. First available session (defensive fallback)
 */
function getSessionKey(): string | undefined {
  return getRoutingInfo()?.sessionKey;
}

function getSession(): NReplSession {
  const sessionKey = getSessionKey();

  // Try getting from registry first
  if (sessionKey) {
    const session = sessionRegistry.getSession(sessionKey);
    if (session) {
      return session;
    }
  }

  // Fallback for results doc
  if (outputWindow.isResultsDoc(tryToGetDocument({}))) {
    return outputWindow.getSession();
  }

  return null;
}

/**
 * Determines the session type for display/state purposes.
 * Uses same simplified routing as getSessionKey().
 */
function getReplSessionType(connected: boolean): string | undefined {
  if (!connected) {
    return undefined;
  }

  return getSessionKey();
}

function updateReplSessionType() {
  const connected = cljsLib.getStateValue('connected');
  const replSessionType = getReplSessionType(connected);
  cljsLib.setStateValue('current-session-type', replSessionType);
}

function getReplSessionTypeFromState() {
  return cljsLib.getStateValue('current-session-type');
}

/**
 * Determines the context prefix for a session label based on the current document.
 * VS Code wrapper around the pure determineSessionLabelContext function.
 *
 * @param options.isPinned - Whether the session is pinned (pinned sessions don't get context prefixes)
 * @param options.doc - The document to check for context (defaults to active document)
 * @returns The context type for the session label
 */
function getSessionLabelContext(options?: {
  isPinned?: boolean;
  doc?: vscode.TextDocument;
}): sessionLabel.SessionLabelContext {
  const { isPinned = false, doc = tryToGetDocument({}) } = options ?? {};

  return sessionLabel.determineSessionLabelContext({
    isPinned,
    isReplWindow: outputWindow.isResultsDoc(doc),
    fileType: getFileType(doc),
    fiddleFileExt: config.FIDDLE_FILE_EXT,
  });
}

export {
  getSession,
  getReplSessionType,
  updateReplSessionType,
  getReplSessionTypeFromState,
  getSessionKey,
  getRoutingInfo,
  getSessionLabelContext,
};
