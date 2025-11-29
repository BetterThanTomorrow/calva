import * as vscode from 'vscode';
import * as minimatchLib from 'minimatch';
import { NReplSession } from '.';
import { cljsLib, tryToGetDocument } from '../utilities';
import * as outputWindow from '../repl-window/repl-doc';
import * as sessionRegistry from './session-registry';
import * as sessionRouting from './session-routing';
import type { WorkspaceFolderInfo } from './glob-paths';
import * as globPaths from './glob-paths';

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

function findSessionKeyForDocument(doc?: vscode.TextDocument): string | undefined {
  if (!doc) {
    return undefined;
  }

  const candidatePaths = buildCandidatePaths(doc);
  if (candidatePaths.length === 0) {
    return undefined;
  }

  const sessions = sessionRegistry.listSessions();
  const isBetterMatch = (
    current: { score: number; order: number } | undefined,
    candidate: { score: number; order: number }
  ) => {
    if (!current) {
      return true;
    }
    if (candidate.score !== current.score) {
      return candidate.score > current.score;
    }
    return candidate.order < current.order;
  };

  let bestAlwaysClaim: { sessionKey: string; score: number; order: number } | undefined;
  let bestFallback: { sessionKey: string; score: number; order: number } | undefined;

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
      const candidate = { sessionKey: session.key, score: spec.score, order: index };
      if (spec.tier === 'always-claim') {
        if (isBetterMatch(bestAlwaysClaim, candidate)) {
          bestAlwaysClaim = candidate;
        }
      } else {
        if (isBetterMatch(bestFallback, candidate)) {
          bestFallback = candidate;
        }
      }
    }
  });

  if (bestAlwaysClaim) {
    return bestAlwaysClaim.sessionKey;
  }

  if (bestFallback) {
    return bestFallback.sessionKey;
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
  const doc = tryToGetDocument({});

  // 1. Pinned session takes priority
  const pinnedSession = sessionRouting.resolvePinnedSession();
  if (pinnedSession && sessionRegistry.getSession(pinnedSession)) {
    return pinnedSession;
  }

  // 2. Results doc has its own session setting
  if (outputWindow.isResultsDoc(doc)) {
    const resultsDocType = outputWindow.getSessionType();
    if (resultsDocType && sessionRegistry.getSession(resultsDocType)) {
      return resultsDocType;
    }
  }

  // 3. Glob pattern matching
  const globMatchedSession = findSessionKeyForDocument(doc);
  if (globMatchedSession && sessionRegistry.getSession(globMatchedSession)) {
    return globMatchedSession;
  }

  // 4. CLJC session preference (fallback for unclaimed files)
  const cljcPreference = sessionRouting.getCljcSessionKey();
  if (cljcPreference && sessionRegistry.getSession(cljcPreference)) {
    return cljcPreference;
  }

  // 5. First available session (defensive fallback, should rarely be reached)
  const sessions = sessionRegistry.listSessions();
  return sessions[0]?.key;
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

export {
  getSession,
  getReplSessionType,
  updateReplSessionType,
  getReplSessionTypeFromState,
  getSessionKey,
};
