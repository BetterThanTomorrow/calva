import * as vscode from 'vscode';
import * as sessionRegistry from './nrepl/session-registry';
import * as sessionRouting from './nrepl/session-routing';
import * as replSession from './nrepl/repl-session';
import * as clientRegistry from './nrepl/client-registry';
import status from './status';
import { getPathRelativeToWorkspace } from './project-root';
import * as utilities from './utilities';
import * as outputWindow from './repl-window/repl-window-doc';
import * as output from './results-output/output';
import * as state from './state';

const OUTPUT_SESSION_MENU_SAVE_KEY = 'repl-sessions-menu-output';

const CLJC_TARGET_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('arrow-right'),
  tooltip: 'Make cljc target',
};

interface SessionQuickPickItem extends vscode.QuickPickItem {
  action: 'session' | 'auto' | 'output-session';
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
  activeFilePath,
}: {
  projectRoot?: string;
  globSpecs?: Array<{
    displayPattern?: string;
    pattern: string;
    tier: 'always-claim' | 'is-fallback-for' | 'project-fallback';
  }>;
  routingInfo?: replSession.RoutingResult;
  activeFilePath?: string;
}): string | undefined {
  const parts: string[] = [];

  const relativeRoot = formatRelativeProjectRoot(projectRoot);
  if (relativeRoot) {
    // Project root is involved in routing if the active file is inside it
    const isProjectRootInvolved =
      routingInfo &&
      activeFilePath &&
      projectRoot &&
      activeFilePath.startsWith(vscode.Uri.parse(projectRoot).fsPath);
    parts.push(isProjectRootInvolved ? `$(check) ${relativeRoot}` : relativeRoot);
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
  routingInfo,
  isReplWindowTarget,
  isSecondary,
  clientKey,
}: {
  globs?: string[];
  globSpecs?: Array<{
    pattern: string;
    displayPattern?: string;
    tier: 'always-claim' | 'is-fallback-for' | 'project-fallback';
  }>;
  lastActivity?: number;
  routingInfo?: replSession.RoutingResult;
  isReplWindowTarget?: boolean;
  isSecondary?: boolean;
  clientKey?: string;
}): string | undefined {
  const detailParts: string[] = [];

  // For primary sessions, show host:port first
  if (!isSecondary && clientKey) {
    const client = clientRegistry.getRegisteredClient(clientKey);
    if (client?.host && client?.port) {
      detailParts.push(`${client.host}:${client.port}`);
    }
  }

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

  // REPL window target indicator - only shown when REPL window is active
  if (
    isReplWindowTarget &&
    outputWindow.isReplWindowDoc(vscode.window.activeTextEditor?.document)
  ) {
    detailParts.push('Targeted by $(check) repl-window');
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
    case 'cljc-within-connection':
    case 'first-available':
      return '$(circle-filled)';
  }
}

function buildSessionPickItems(options?: {
  routingInfo?: replSession.RoutingResult;
  highlightedSessionKey?: string;
  activeFilePath?: string;
}): SessionQuickPickItem[] {
  const { routingInfo, highlightedSessionKey, activeFilePath } = options || {};
  const pinnedKey = sessionRouting.getPinnedSessionKey();
  const isAutoRouting = !pinnedKey;
  const replWindowSession = outputWindow.getSessionType();

  return sessionRegistry.listSessions().map((session) => {
    // Determine if this session is the currently routed one and why
    const isRoutedSession = routingInfo?.sessionKey === session.key;
    const isPinned = session.key === pinnedKey;

    // Menu always shows plain session key - no cljc prefix
    const baseLabel = session.key;

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
    // Also include cljc indicator for sessions in pairs
    const clientKey = session.connectionOwnerId;
    const hasSibling =
      clientKey &&
      sessionRegistry.getPrimarySessionKeyForClient(clientKey) &&
      sessionRegistry.getSecondarySessionKeyForClient(clientKey);
    const isCljcTarget = clientKey
      ? clientRegistry.getCljcTargetForConnection(clientKey) ===
        (session.isSecondary ? 'secondary' : 'primary')
      : false;

    const descriptionParts: string[] = [];
    const baseDescription = formatSessionDescription({
      projectRoot: session.projectRoot,
      globSpecs: session.globSpecs,
      routingInfo: isRoutedSession ? routingInfo : undefined,
      activeFilePath,
    });
    if (baseDescription) {
      descriptionParts.push(baseDescription);
    }

    // Add cljc indicator for sessions in pairs - only checkmark when cljc-within-connection is the routing reason
    if (hasSibling && isCljcTarget) {
      const isCljcRoutingReason =
        isRoutedSession && routingInfo?.reason.type === 'cljc-within-connection';
      const cljcIndicator = isCljcRoutingReason ? '$(check) cljc' : 'cljc';
      descriptionParts.push(cljcIndicator);
    }

    const description = descriptionParts.length > 0 ? descriptionParts.join(' — ') : undefined;

    // Build detail with REPL window indicator for the targeted session
    const isReplWindowTarget = session.key === replWindowSession;
    const detail = formatSessionDetail({
      globs: session.globs,
      globSpecs: session.globSpecs,
      lastActivity: session.lastActivity,
      routingInfo: isRoutedSession ? routingInfo : undefined,
      isReplWindowTarget,
      isSecondary: session.isSecondary,
      clientKey,
    });

    // Add button for non-target sessions to become cljc target
    const buttons: vscode.QuickInputButton[] = [];
    if (hasSibling && !isCljcTarget) {
      buttons.push(CLJC_TARGET_BUTTON);
    }

    return {
      label,
      description,
      detail,
      action: 'session',
      sessionKey: session.key,
      buttons: buttons.length > 0 ? buttons : undefined,
    };
  });
}

/**
 * Builds items for the REPL window session picker.
 * Shows first tier patterns in description, second tier as "Fallback for:", no checkmarks.
 */
function buildReplWindowSessionItems(): SessionQuickPickItem[] {
  const currentOutputSession = outputWindow.getSessionType();

  return sessionRegistry.listSessions().map((session) => {
    const isCurrentTarget = session.key === currentOutputSession;

    // Label shows current target with arrow indicator
    const label = isCurrentTarget ? `$(arrow-right) ${session.key}` : session.key;

    // Description: first tier patterns (always-claim)
    const descriptionParts: string[] = [];

    const relativeRoot = formatRelativeProjectRoot(session.projectRoot);
    if (relativeRoot) {
      descriptionParts.push(relativeRoot);
    }

    if (session.globSpecs && session.globSpecs.length > 0) {
      const alwaysClaim = session.globSpecs
        .filter((s) => s.tier === 'always-claim')
        .map((s) => s.displayPattern ?? s.pattern);
      if (alwaysClaim.length > 0) {
        descriptionParts.push(alwaysClaim.join(', '));
      }
    }

    const description = descriptionParts.length > 0 ? descriptionParts.join(' — ') : undefined;

    // Detail: "Fallback for:" with second tier patterns, then timestamp
    const detailParts: string[] = [];

    if (session.globSpecs && session.globSpecs.length > 0) {
      const isFallbackFor = session.globSpecs
        .filter((s) => s.tier === 'is-fallback-for')
        .map((s) => s.displayPattern ?? s.pattern);
      if (isFallbackFor.length > 0) {
        detailParts.push(`Fallback for: ${isFallbackFor.join(', ')}`);
      }
    }

    const lastUsed = formatLastUsed(session.lastActivity);
    if (lastUsed) {
      detailParts.push(lastUsed);
    }

    const detail = detailParts.length > 0 ? detailParts.join(' — ') : undefined;

    return {
      label,
      description,
      detail,
      action: 'session' as const,
      sessionKey: session.key,
    };
  });
}

async function promptForOutputWindowSession(): Promise<void> {
  const sessions = sessionRegistry.listSessions();
  if (sessions.length === 0) {
    void vscode.window.showInformationMessage('No REPL sessions available.');
    return;
  }

  const currentOutputSession = outputWindow.getSessionType();
  const outputItems = buildReplWindowSessionItems();

  // Build placeholder with current target session and project root
  let placeHolder: string;
  if (currentOutputSession) {
    const currentSessionMeta = sessionRegistry.getSessionMetadata(currentOutputSession);
    const projectRoot = formatRelativeProjectRoot(currentSessionMeta?.projectRoot);
    placeHolder = projectRoot
      ? `Currently targeting ${currentOutputSession} in ${projectRoot}. Select a session to make it the target.`
      : `Currently targeting ${currentOutputSession}. Select a session to make it the target.`;
  } else {
    placeHolder = 'Select a session to make it the target.';
  }

  const outputSelection = (await utilities.quickPickSingle({
    title: 'REPL Window Session',
    placeHolder,
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
  void output.replWindowForceAppendPrompt();
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

function buildMenuItems(): SessionQuickPickItem[] {
  const pinnedSession = sessionRouting.getPinnedSessionKey();
  const isAutoRouting = !pinnedSession;
  const routingInfo = replSession.getRoutingInfo();
  const currentOutputSession = outputWindow.getSessionType();
  const activeFilePath = vscode.window.activeTextEditor?.document?.uri?.fsPath;

  const items: SessionQuickPickItem[] = [];

  // REPL window session selector - only shown when REPL window is active
  const isReplWindowActive = outputWindow.isReplWindowDoc(vscode.window.activeTextEditor?.document);
  if (isReplWindowActive) {
    const outputSessionMeta = currentOutputSession
      ? sessionRegistry.getSessionMetadata(currentOutputSession)
      : undefined;
    const outputSessionProjectRoot = formatRelativeProjectRoot(outputSessionMeta?.projectRoot);
    const outputDescription =
      currentOutputSession && outputSessionProjectRoot
        ? `${currentOutputSession} in ${outputSessionProjectRoot}`
        : currentOutputSession ?? undefined;
    const outputDetail =
      currentOutputSession && outputSessionProjectRoot
        ? `The REPL Window uses the ${currentOutputSession} session in ${outputSessionProjectRoot} for evaluations`
        : currentOutputSession
        ? `The REPL Window uses the ${currentOutputSession} session for evaluations`
        : 'Select a session for the REPL window';
    items.push({
      label: 'Select session for REPL window',
      description: outputDescription,
      detail: outputDetail,
      action: 'output-session',
    });
  }

  // Show auto-route status with filled/outline circle
  const autoRouteIcon = isAutoRouting ? '$(circle-filled)' : '$(circle-outline)';
  items.push({
    label: `${autoRouteIcon} Auto-route`,
    description: routingInfo ? `$(arrow-right) ${routingInfo.sessionKey}` : undefined,
    detail:
      'Auto-selects repl session based on file path, using connect sequence globs and per-connection CLJC target.',
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
      activeFilePath,
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

  // Use createQuickPick to support item buttons
  const qp = vscode.window.createQuickPick<SessionQuickPickItem>();
  qp.title = 'REPL Sessions';
  qp.placeholder = placeHolder;
  qp.items = menuItems;
  qp.ignoreFocusOut = true;

  return new Promise<void>((resolve) => {
    qp.onDidTriggerItemButton((event) => {
      const item = event.item;
      if (event.button === CLJC_TARGET_BUTTON && item.sessionKey) {
        const clientKey = sessionRegistry.getClientKeyForSession(item.sessionKey);
        if (clientKey) {
          const sessionMeta = sessionRegistry.getSessionMetadata(item.sessionKey);
          const target = sessionMeta?.isSecondary ? 'secondary' : 'primary';
          clientRegistry.setCljcTargetForConnection(clientKey, target);
          status.update();
          // Refresh the menu items to reflect the change
          qp.items = buildMenuItems();
        }
      }
    });

    qp.onDidAccept(() => {
      const selection = qp.selectedItems[0];
      if (selection) {
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
          case 'output-session':
            qp.hide();
            void promptForOutputWindowSession();
            return;
        }
      }
      qp.hide();
    });

    qp.onDidHide(() => {
      qp.dispose();
      resolve();
    });

    qp.show();
  });
}
