import * as vscode from 'vscode';
import * as sessionRegistry from './nrepl/session-registry';
import * as sessionRouting from './nrepl/session-routing';
import { getReplSessionTypeFromState } from './nrepl/repl-session';
import status from './status';
import { getPathRelativeToWorkspace } from './project-root';
import * as utilities from './utilities';
import * as outputWindow from './repl-window/repl-doc';
import * as output from './results-output/output';
import * as state from './state';

const MENU_SAVE_KEY = 'repl-sessions-menu';
const CLJC_MENU_SAVE_KEY = 'repl-sessions-menu-cljc';
const OUTPUT_SESSION_MENU_SAVE_KEY = 'repl-sessions-menu-output';

interface SessionQuickPickItem extends vscode.QuickPickItem {
  action: 'session' | 'auto' | 'cljc' | 'output-session';
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
  globSpecs,
  lastActivity,
  key,
  includeSessionKey,
}: {
  globs?: string[];
  globSpecs?: Array<{
    pattern: string;
    displayPattern?: string;
    tier: 'always-claim' | 'is-fallback-for';
  }>;
  lastActivity?: number;
  key: string;
  includeSessionKey: boolean;
}): string | undefined {
  const detailParts: string[] = [];
  const lastUsed = formatLastUsed(lastActivity);
  if (lastUsed) {
    detailParts.push(lastUsed);
  }
  if (globSpecs && globSpecs.length > 0) {
    const byTier = (tier: string) =>
      globSpecs.filter((s) => s.tier === tier).map((s) => s.displayPattern ?? s.pattern);
    const alwaysClaim = byTier('always-claim');
    const isFallbackFor = byTier('is-fallback-for');
    const parts = [
      'Used for:',
      ...(alwaysClaim.length ? [`${alwaysClaim.join(', ')}`] : []),
      ...(isFallbackFor.length ? [`(Is fallback for: ${isFallbackFor.join(', ')})`] : []),
    ];
    if (parts.length > 0) {
      detailParts.push(parts.join(' '));
    }
  } else if (globs && globs.length > 0) {
    detailParts.push(`Used for: ${globs.join(', ')}`);
  }
  if (includeSessionKey || detailParts.length === 0) {
    detailParts.push(`Session key: ${key}`);
  }
  return detailParts.join(' — ');
}

function buildSessionPickItems(options?: {
  isAutoRouting?: boolean;
  autoSessionKey?: string;
  highlightedSessionKey?: string;
}): SessionQuickPickItem[] {
  const { isAutoRouting = false, autoSessionKey, highlightedSessionKey } = options || {};
  const pinnedKey = sessionRouting.getPinnedSessionKey();
  return sessionRegistry.listSessions().map((session) => {
    const baseLabel = session.key;
    const prefixes: string[] = [];
    if (session.key === pinnedKey) {
      prefixes.push('$(pin)');
    } else if (isAutoRouting && autoSessionKey && session.key === autoSessionKey) {
      prefixes.push('$(check)');
    } else if (highlightedSessionKey && session.key === highlightedSessionKey) {
      prefixes.push('$(check)');
    }
    const label = prefixes.length > 0 ? `${prefixes.join(' ')} ${baseLabel}` : baseLabel;
    const description = formatRelativeProjectRoot(session.projectRoot);

    return {
      label,
      description,
      detail: formatSessionDetail({
        globs: session.globs,
        globSpecs: session.globSpecs,
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

  const currentCljcSession = sessionRouting.getCljcSessionKey();
  const cljcItems: SessionQuickPickItem[] = buildSessionPickItems({
    highlightedSessionKey: currentCljcSession,
  });

  const cljcSelection = (await utilities.quickPickSingle({
    title: 'Route cljc files',
    placeHolder: currentCljcSession
      ? `Currently routing cljc files to ${currentCljcSession}`
      : 'Select a session for cljc files',
    values: cljcItems,
    saveAs: CLJC_MENU_SAVE_KEY,
  })) as SessionQuickPickItem | undefined;

  if (!cljcSelection) {
    return;
  }

  if (cljcSelection.action === 'session' && cljcSelection.sessionKey) {
    sessionRouting.setCljcSessionKey(cljcSelection.sessionKey);
    status.update();
  }
}

async function promptForOutputWindowSession(): Promise<void> {
  const sessions = sessionRegistry.listSessions();
  if (sessions.length === 0) {
    void vscode.window.showInformationMessage('No REPL sessions available.');
    return;
  }

  const currentOutputSession = outputWindow.getSessionType();
  const outputItems: SessionQuickPickItem[] = buildSessionPickItems({
    highlightedSessionKey: currentOutputSession,
  });

  const outputSelection = (await utilities.quickPickSingle({
    title: 'REPL Window Session',
    placeHolder: currentOutputSession
      ? `Currently using ${currentOutputSession}`
      : 'Select a session for the REPL window',
    values: outputItems,
    saveAs: OUTPUT_SESSION_MENU_SAVE_KEY,
  })) as SessionQuickPickItem | undefined;

  if (!outputSelection) {
    return;
  }

  if (outputSelection.action === 'session' && outputSelection.sessionKey) {
    setReplWindowSession(outputSelection.sessionKey);
  }
}

/**
 * Sets the REPL window to use a specific session.
 * Updates the session, appends a new prompt, and updates the status bar.
 * @param sessionKey The session key to set for the REPL window
 * @returns true if the session was set successfully, false otherwise
 */
export function setReplWindowSession(sessionKey: string): boolean {
  const session = sessionRegistry.getSession(sessionKey);
  if (!session) {
    return false;
  }
  outputWindow.setSession(session, undefined, sessionKey);
  output.replWindowForceAppendPrompt();
  status.update();
  return true;
}

export async function selectReplWindowSession(sessionKey?: string): Promise<void> {
  if (sessionKey) {
    const success = setReplWindowSession(sessionKey);
    if (!success) {
      void vscode.window.showErrorMessage(`Session '${sessionKey}' not found.`);
    }
  } else {
    await promptForOutputWindowSession();
  }
}

function isOutputWindowActive(): boolean {
  return !!state.extensionContext?.workspaceState.get('outputWindowActive');
}

function buildMenuItems(): SessionQuickPickItem[] {
  const pinnedSession = sessionRouting.getPinnedSessionKey();
  const routingMode = sessionRouting.getRoutingMode();
  const cljcSessionKey = sessionRouting.getCljcSessionKey();
  const isAutoRouting = routingMode === 'auto' && !pinnedSession;
  const autoSessionKey = isAutoRouting ? getReplSessionTypeFromState() : undefined;

  const items: SessionQuickPickItem[] = [];

  if (isOutputWindowActive()) {
    const currentOutputSession = outputWindow.getSessionType();
    items.push({
      label: 'Select session for REPL window',
      description: currentOutputSession ? `Current: ${currentOutputSession}` : undefined,
      detail: 'Override which session the REPL window uses for evaluations.',
      action: 'output-session',
    });
  }

  items.push({
    label: 'Select session for cljc files',
    description: cljcSessionKey ? `Current: ${cljcSessionKey}` : 'No override set',
    detail: 'Specify how to route cljc files (when auto-routing is enabled).',
    action: 'cljc',
  });

  items.push({
    label: `${isAutoRouting ? '$(check) ' : ''}Auto-route`,
    description: autoSessionKey ? `Current: ${autoSessionKey}` : undefined,
    detail:
      'Auto-selects repl session based on file path, using connect sequence globs, and CLJC overrides.',
    action: 'auto',
  });

  items.push({
    label: '',
    kind: vscode.QuickPickItemKind.Separator,
    action: 'session',
  } as SessionQuickPickItem);

  items.push(
    ...buildSessionPickItems({
      isAutoRouting,
      autoSessionKey,
    })
  );

  return items;
}

export async function showReplSessionsMenu(): Promise<void> {
  const sessions = sessionRegistry.listSessions();
  if (sessions.length === 0) {
    void vscode.window.showInformationMessage('No REPL sessions connected yet.');
    return;
  }

  const menuItems = buildMenuItems();
  const selection = (await utilities.quickPickSingle({
    title: 'REPL Sessions',
    placeHolder: 'Select a session to pin it',
    values: menuItems,
    saveAs: MENU_SAVE_KEY,
  })) as SessionQuickPickItem | undefined;

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
    case 'output-session':
      await promptForOutputWindowSession();
      break;
    default:
      break;
  }
}
