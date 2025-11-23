import * as vscode from 'vscode';
import * as sessionRegistry from './nrepl/session-registry';
import * as sessionRouting from './nrepl/session-routing';
import status from './status';

interface SessionQuickPickItem extends vscode.QuickPickItem {
  action: 'session' | 'auto' | 'cljc' | 'cljc-clear';
  sessionKey?: string;
}

function formatSessionDetail({
  projectRoot,
  globs,
}: {
  projectRoot?: string;
  globs?: string[];
}): string | undefined {
  const detailParts: string[] = [];
  if (projectRoot) {
    detailParts.push(`Root: ${projectRoot}`);
  }
  if (globs && globs.length > 0) {
    detailParts.push(`Globs: ${globs.join(', ')}`);
  }
  return detailParts.length > 0 ? detailParts.join(' — ') : undefined;
}

function buildSessionPickItems(): SessionQuickPickItem[] {
  return sessionRegistry.listSessions().map((session) => ({
    label: session.name ? `${session.name} (${session.key})` : session.key,
    description: session.projectRoot,
    detail: formatSessionDetail(session),
    action: 'session',
    sessionKey: session.key,
  }));
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
      label: '$(sync) Auto-route cljc files',
      description: 'Use automatic routing for cljc files',
      detail: 'Removes the cljc-specific session pin',
      action: 'cljc-clear',
    },
  ];

  const currentCljcSession = sessionRouting.getCljcSessionKey();

  const cljcSelection = await vscode.window.showQuickPick(cljcItems, {
    title: 'Pin cljc files',
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
    label: '$(sync) Auto-route',
    description: routingMode === 'auto' && !pinnedSession ? 'Currently active' : undefined,
    detail:
      'Use connect sequence glob mappings and default routing for files not matched by globs.',
    action: 'auto',
  });

  items.push({
    label: '$(symbol-namespace) Select session for cljc files',
    description: cljcSession ? `Current: ${cljcSession}` : 'No override set',
    detail: 'Pin only cljc files to a specific session.',
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
