import * as vscode from 'vscode';
import * as sessionRegistry from './nrepl/session-registry';
import * as sessionRouting from './nrepl/session-routing';
import status from './status';
import { getPathRelativeToWorkspace } from './project-root';

const DEFAULT_SESSION_NAMES = new Set(['Clojure REPL', 'ClojureScript REPL']);

interface SessionQuickPickItem extends vscode.QuickPickItem {
  action: 'session' | 'auto' | 'cljc' | 'cljc-clear';
  sessionKey?: string;
}

function formatRelativeProjectRoot(projectRoot?: string): string | undefined {
  if (!projectRoot) {
    return undefined;
  }
  try {
    const uri = vscode.Uri.parse(projectRoot);
    return getPathRelativeToWorkspace(uri);
  } catch {
    return projectRoot;
  }
}

function formatLastUsed(lastActivity?: number): string | undefined {
  if (!lastActivity) {
    return 'Last used: never';
  }
  const diffMs = Date.now() - lastActivity;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `Last used: ${days} day${days === 1 ? '' : 's'} ago`;
  }
  if (hours > 0) {
    return `Last used: ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (minutes > 0) {
    return `Last used: ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  return `Last used: ${seconds} second${seconds === 1 ? '' : 's'} ago`;
}

function formatSessionDetail({
  globs,
  lastActivity,
  key,
  includeSessionKey,
}: {
  globs?: string[];
  lastActivity?: number;
  key: string;
  includeSessionKey: boolean;
}): string | undefined {
  const detailParts: string[] = [];
  const lastUsed = formatLastUsed(lastActivity);
  if (lastUsed) {
    detailParts.push(lastUsed);
  }
  if (globs && globs.length > 0) {
    detailParts.push(`Globs: ${globs.join(', ')}`);
  }
  if (includeSessionKey || detailParts.length === 0) {
    detailParts.push(`Session key: ${key}`);
  }
  return detailParts.join(' — ');
}

function getSessionLabel(session: sessionRegistry.SessionMetadata): string {
  if (session.name && !DEFAULT_SESSION_NAMES.has(session.name)) {
    return session.name;
  }
  return session.key;
}

function buildSessionPickItems(): SessionQuickPickItem[] {
  const pinnedKey = sessionRouting.getPinnedSessionKey();
  return sessionRegistry.listSessions().map((session) => {
    const baseLabel = getSessionLabel(session);
    const label = session.key === pinnedKey ? `$(pin) ${baseLabel}` : baseLabel;
    const description = formatRelativeProjectRoot(session.projectRoot);

    return {
      label,
      description,
      detail: formatSessionDetail({
        globs: session.globs,
        lastActivity: session.lastActivity,
        key: session.key,
        includeSessionKey: baseLabel !== session.key,
      }),
      action: 'session',
      sessionKey: session.key,
    };
  });
}

async function promptForCljcSession(): Promise<void> {
  const sessions = sessionRegistry.listSessions();
  if (sessions.length === 0) {
    void vscode.window.showInformationMessage('No REPL sessions available.');
    return;
  }

  const cljcItems: SessionQuickPickItem[] = [
    ...buildSessionPickItems(),
    {
      label: 'Use default routing for cljc files',
      description: 'Apply auto-routing rules for cljc files',
      detail: 'Removes the cljc-specific session override',
      action: 'cljc-clear',
    },
  ];

  const currentCljcSession = sessionRouting.getCljcSessionKey();

  const cljcSelection = await vscode.window.showQuickPick(cljcItems, {
    title: 'Route cljc files',
    placeHolder: currentCljcSession
      ? `Currently routing cljc files to ${currentCljcSession}`
      : 'Select a session for cljc files',
    canPickMany: false,
  });

  if (!cljcSelection) {
    return;
  }

  if (cljcSelection.action === 'cljc-clear') {
    sessionRouting.setCljcSessionKey(undefined);
    status.update();
    return;
  }

  if (cljcSelection.action === 'session' && cljcSelection.sessionKey) {
    sessionRouting.setCljcSessionKey(cljcSelection.sessionKey);
    status.update();
  }
}

function buildMenuItems(): SessionQuickPickItem[] {
  const items: SessionQuickPickItem[] = buildSessionPickItems();
  const pinnedSession = sessionRouting.getPinnedSessionKey();
  const routingMode = sessionRouting.getRoutingMode();
  const cljcSession = sessionRouting.getCljcSessionKey();

  items.push({
    label: 'Auto-route',
    description: routingMode === 'auto' && !pinnedSession ? 'Currently active' : undefined,
    detail: 'Use connect sequence globs and default routing for files not matched by globs.',
    action: 'auto',
  });

  items.push({
    label: 'Select session for cljc files',
    description: cljcSession ? `Current: ${cljcSession}` : 'No override set',
    detail: 'Route only cljc files to a specific session when auto-routing is enabled.',
    action: 'cljc',
  });

  return items;
}

export async function showReplSessionsMenu(): Promise<void> {
  const sessions = sessionRegistry.listSessions();
  if (sessions.length === 0) {
    void vscode.window.showInformationMessage('No REPL sessions connected yet.');
    return;
  }

  const selection = await vscode.window.showQuickPick(buildMenuItems(), {
    title: 'REPL Sessions',
    placeHolder: 'Select a session to pin it',
    canPickMany: false,
  });

  if (!selection) {
    return;
  }

  switch (selection.action) {
    case 'session':
      if (selection.sessionKey) {
        sessionRouting.pinSession(selection.sessionKey);
        status.update();
      }
      break;
    case 'auto':
      sessionRouting.enableAutoRouting();
      status.update();
      break;
    case 'cljc':
      await promptForCljcSession();
      break;
    default:
      break;
  }
}
