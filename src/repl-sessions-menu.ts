import * as vscode from 'vscode';
import * as sessionRegistry from './nrepl/session-registry';
import * as sessionRouting from './nrepl/session-routing';
import * as replSession from './nrepl/repl-session';
import * as sessionLabel from './nrepl/session-label';
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

function formatSessionDescription({
  projectRoot,
  globSpecs,
  routingInfo,
}: {
  projectRoot?: string;
  globSpecs?: Array<{
    displayPattern?: string;
    pattern: string;
    tier: 'always-claim' | 'is-fallback-for' | 'project-fallback';
  }>;
  routingInfo?: replSession.RoutingResult;
}): string | undefined {
  const parts: string[] = [];

  const relativeRoot = formatRelativeProjectRoot(projectRoot);
  if (relativeRoot) {
    // Mark project root with checkmark if it's the winning reason (project-fallback)
    const isProjectRootWinner =
      routingInfo?.reason.type === 'glob-match' && routingInfo.reason.tier === 'project-fallback';
    parts.push(isProjectRootWinner ? `$(check) ${relativeRoot}` : relativeRoot);
  }

  if (globSpecs && globSpecs.length > 0) {
    const alwaysClaim = globSpecs
      .filter((s) => s.tier === 'always-claim')
      .map((s) => {
        const pattern = s.displayPattern ?? s.pattern;
        // Mark the winning pattern with a checkmark if this is the routed session
        const isWinningPattern =
          routingInfo?.reason.type === 'glob-match' &&
          routingInfo.reason.tier === 'always-claim' &&
          routingInfo.reason.matchingPattern === pattern;
        return isWinningPattern ? `$(check) ${pattern}` : pattern;
      });
    if (alwaysClaim.length > 0) {
      parts.push(alwaysClaim.join(', '));
    }
  }

  return parts.length > 0 ? parts.join(' — ') : undefined;
}

function formatSessionDetail({
  globs,
  globSpecs,
  lastActivity,
  key,
  includeSessionKey,
  routingInfo,
}: {
  globs?: string[];
  globSpecs?: Array<{
    pattern: string;
    displayPattern?: string;
    tier: 'always-claim' | 'is-fallback-for' | 'project-fallback';
  }>;
  lastActivity?: number;
  key: string;
  includeSessionKey: boolean;
  routingInfo?: replSession.RoutingResult;
}): string | undefined {
  const detailParts: string[] = [];

  // Fallback patterns - mark winning pattern if applicable
  if (globSpecs && globSpecs.length > 0) {
    const isFallbackFor = globSpecs
      .filter((s) => s.tier === 'is-fallback-for')
      .map((s) => {
        const pattern = s.displayPattern ?? s.pattern;
        // Mark the winning pattern with a checkmark
        const isWinningPattern =
          routingInfo?.reason.type === 'glob-match' &&
          routingInfo.reason.tier === 'is-fallback-for' &&
          routingInfo.reason.matchingPattern === pattern;
        return isWinningPattern ? `$(check) ${pattern}` : pattern;
      });
    if (isFallbackFor.length > 0) {
      detailParts.push(`Fallback for: ${isFallbackFor.join(', ')}`);
    }
  } else if (globs && globs.length > 0) {
    detailParts.push(globs.join(', '));
  }

  // Session key if needed
  if (includeSessionKey) {
    detailParts.push(`Key: ${key}`);
  }

  // Timestamp
  const lastUsed = formatLastUsed(lastActivity);
  if (lastUsed) {
    detailParts.push(lastUsed);
  }

  return detailParts.length > 0 ? detailParts.join(' — ') : undefined;
}

/**
 * Formats the routing reason as a label prefix for the menu.
 * All auto-routed sessions use $(circle-filled) for visual consistency.
 */
function formatRoutingReasonPrefix(reason: replSession.RoutingReason): string {
  switch (reason.type) {
    case 'pinned':
      return '$(pin)';
    case 'repl-window':
    case 'glob-match':
    case 'cljc-preference':
    case 'first-available':
      return '$(circle-filled)';
  }
}

function buildSessionPickItems(options?: {
  routingInfo?: replSession.RoutingResult;
  highlightedSessionKey?: string;
}): SessionQuickPickItem[] {
  const { routingInfo, highlightedSessionKey } = options || {};
  const pinnedKey = sessionRouting.getPinnedSessionKey();
  const isAutoRouting = !pinnedKey;

  // Get label context for the routed session (e.g., 'repl-window', 'cljc', 'fiddle')
  const labelContext = replSession.getSessionLabelContext({ isPinned: !!pinnedKey });

  return sessionRegistry.listSessions().map((session) => {
    // Determine if this session is the currently routed one and why
    const isRoutedSession = routingInfo?.sessionKey === session.key;
    const isPinned = session.key === pinnedKey;

    // Format the session label - only the routed session gets the context prefix
    const baseLabel =
      isRoutedSession && isAutoRouting
        ? sessionLabel.formatSessionLabel(session.key, labelContext)
        : session.key;

    let prefix = '';
    if (isPinned) {
      prefix = '$(pin) ';
    } else if (isAutoRouting && isRoutedSession && routingInfo) {
      // Show routing indicator for the selected session
      prefix = `${formatRoutingReasonPrefix(routingInfo.reason)} `;
    } else if (highlightedSessionKey && session.key === highlightedSessionKey) {
      prefix = '$(check) ';
    }

    const label = `${prefix}${baseLabel}`;

    // Build description with always-claim patterns marked with check if they matched
    const description = formatSessionDescription({
      projectRoot: session.projectRoot,
      globSpecs: session.globSpecs,
      routingInfo: isRoutedSession ? routingInfo : undefined,
    });

    // Build detail - REPL window indicator is already shown in label prefix (repl-w/)
    const detail = formatSessionDetail({
      globs: session.globs,
      globSpecs: session.globSpecs,
      lastActivity: session.lastActivity,
      key: session.key,
      includeSessionKey: baseLabel !== session.key,
      routingInfo: isRoutedSession ? routingInfo : undefined,
    });

    return {
      label,
      description,
      detail,
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
  const cljcSessionKey = sessionRouting.getCljcSessionKey();
  const isAutoRouting = !pinnedSession;
  const routingInfo = replSession.getRoutingInfo();

  const items: SessionQuickPickItem[] = [];

  if (isOutputWindowActive()) {
    const currentOutputSession = outputWindow.getSessionType();
    items.push({
      label: 'Select session for REPL window',
      description: currentOutputSession ? `$(arrow-right) ${currentOutputSession}` : undefined,
      detail: 'Override which session the REPL window uses for evaluations.',
      action: 'output-session',
    });
  }

  items.push({
    label: 'Select session for cljc files',
    description: cljcSessionKey ? `$(arrow-right) ${cljcSessionKey}` : 'No override set',
    detail: 'Specify how to route cljc files (when auto-routing is enabled).',
    action: 'cljc',
  });

  // Show auto-route status with filled/outline circle
  const autoRouteIcon = isAutoRouting ? '$(circle-filled)' : '$(circle-outline)';
  items.push({
    label: `${autoRouteIcon} Auto-route`,
    description: routingInfo ? `$(arrow-right) ${routingInfo.sessionKey}` : undefined,
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
      routingInfo,
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

  // Build placeholder with active file path if available
  const activeDoc = vscode.window.activeTextEditor?.document;
  const activeFilePath = activeDoc ? getPathRelativeToWorkspace(activeDoc.uri) : undefined;
  const placeHolder = activeFilePath
    ? `Selecting a session pins it. ${activeFilePath}`
    : 'Selecting a session pins it';

  const menuItems = buildMenuItems();
  const selection = (await utilities.quickPickSingle({
    title: 'REPL Sessions',
    placeHolder,
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
