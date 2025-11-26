import * as vscode from 'vscode';
import * as minimatchLib from 'minimatch';
import { NReplSession } from '.';
import { cljsLib, tryToGetDocument, getFileType } from '../utilities';
import * as outputWindow from '../repl-window/repl-doc';
import { isUndefined } from 'lodash';
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

function getCljcFallbackSessionKey(): string | undefined {
  const cljcSessionKey = sessionRouting.getCljcSessionKey();
  if (cljcSessionKey && sessionRegistry.getSession(cljcSessionKey)) {
    return cljcSessionKey;
  }

  return undefined;
}

/**
 * Determines the appropriate session key based on file type and context
 */
function getSessionKey(fileType?: string): string | undefined {
  const doc = tryToGetDocument({});
  const inferredType = getFileType(doc);

  const routedSession = sessionRouting.resolvePreferredSession(inferredType);
  if (routedSession && sessionRegistry.getSession(routedSession)) {
    return routedSession;
  }

  if (outputWindow.isResultsDoc(doc)) {
    const resultsDocType = outputWindow.getSessionType();
    if (resultsDocType && sessionRegistry.getSession(resultsDocType)) {
      return resultsDocType;
    }
  }

  const globMatchedSession = findSessionKeyForDocument(doc);
  if (globMatchedSession && sessionRegistry.getSession(globMatchedSession)) {
    return globMatchedSession;
  }

  const cljcFallback = getCljcFallbackSessionKey();
  if (cljcFallback) {
    return cljcFallback;
  }

  // Use provided fileType parameter as fallback
  if (!isUndefined(fileType) && sessionRegistry.getSession(fileType)) {
    return fileType;
  }

  if (inferredType && sessionRegistry.getSession(inferredType)) {
    return inferredType;
  }

  const storedType = cljsLib.getStateValue('current-session-type');
  if (storedType && sessionRegistry.getSession(storedType)) {
    return storedType;
  }

  const sessions = sessionRegistry.listSessions();
  return sessions[0]?.key;
}

function getSession(fileType?: string): NReplSession {
  const sessionKey = getSessionKey(fileType);

  // Try getting from registry first
  if (sessionKey) {
    const session = sessionRegistry.getSession(sessionKey);
    if (session) {
      return session;
    }
  }

  if (outputWindow.isResultsDoc(tryToGetDocument({}))) {
    return outputWindow.getSession();
  }

  return null;
}

function getReplSessionType(connected: boolean): string | undefined {
  const doc = tryToGetDocument({});
  const fileType = getFileType(doc);
  let sessionType: string | undefined = undefined;

  if (connected) {
    if (outputWindow.isResultsDoc(doc)) {
      sessionType = outputWindow.getSessionType();
    } else {
      const routedSession = sessionRouting.resolvePreferredSession(fileType);
      if (routedSession && sessionRegistry.getSession(routedSession)) {
        sessionType = routedSession;
      } else {
        const globMatched = findSessionKeyForDocument(doc);
        if (globMatched && sessionRegistry.getSession(globMatched)) {
          sessionType = globMatched;
        } else {
          const cljcFallback = getCljcFallbackSessionKey();
          if (cljcFallback) {
            sessionType = cljcFallback;
          } else if (fileType && sessionRegistry.getSession(fileType)) {
            sessionType = fileType;
          } else {
            const storedType = cljsLib.getStateValue('current-session-type');
            if (storedType && sessionRegistry.getSession(storedType)) {
              sessionType = storedType;
            } else {
              const defaultSession = sessionRegistry.listSessions()[0];
              sessionType = defaultSession?.key;
            }
          }
        }
      }
    }
  }

  return sessionType;
}

function updateReplSessionType() {
  // TODO: Should the session type be set to cljs even when the cljs repl is not yet connected?
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
