import * as vscode from 'vscode';
import * as replSession from './nrepl/repl-session';
import * as sessionRegistry from './nrepl/session-registry';
import * as connectionState from './nrepl/connection-state';
import * as util from './utilities';
import { parseEdn, parseEdnWithInst } from '../out/cljs-lib/cljs-lib';
import * as output from './results-output/output';
import status from './status';
import * as shadowRuntimeCore from './shadow-cljs-runtime-core';

interface RuntimeQuickPickItem extends vscode.QuickPickItem {
  runtimeInfo: shadowRuntimeCore.RuntimeInfo;
}

function getConnectionStateForCurrentContext() {
  const routedSessionKey = replSession.getReplSessionTypeFromState();
  if (!routedSessionKey) {
    return null;
  }
  return sessionRegistry.getConnectionStateForSession(routedSessionKey);
}

export function getSelectedRuntimeInfo(clientKey?: string): shadowRuntimeCore.RuntimeInfo {
  if (clientKey) {
    return connectionState.getConnectionState(clientKey)?.shadowCljsRuntimeInfo;
  }
  const state = getConnectionStateForCurrentContext();
  return state?.shadowCljsRuntimeInfo;
}

export function getSelectedRuntimeId(clientKey?: string): number {
  if (clientKey) {
    return connectionState.getConnectionState(clientKey)?.shadowCljsRuntimeId;
  }
  const state = getConnectionStateForCurrentContext();
  return state?.shadowCljsRuntimeId;
}

/**
 * Get the main session for the currently routed session's connection.
 * Shadow-cljs operations need to be performed on the main (CLJ) session
 * that belongs to the same connection as the currently routed CLJS session.
 */
function getPrimarySessionForCurrentConnection() {
  // Get the currently routed session key
  const routedSessionKey = replSession.getReplSessionTypeFromState();
  if (!routedSessionKey) {
    return null;
  }

  // Get the main session for the connection owning the routed session
  return sessionRegistry.findPrimarySessionForConnection(routedSessionKey);
}

/**
 * Get the cljsBuild for the currently routed session's connection.
 */
function getCurrentBuild() {
  const routedSessionKey = replSession.getReplSessionTypeFromState();
  if (!routedSessionKey) {
    return null;
  }
  const connectionState = sessionRegistry.getConnectionStateForSession(routedSessionKey);
  return connectionState?.cljsBuild ?? null;
}

/**
 * Get available shadow-cljs runtimes for the current build
 */
export async function getShadowRuntimes(): Promise<shadowRuntimeCore.RuntimeInfo[] | null> {
  try {
    const cljSession = getPrimarySessionForCurrentConnection();
    if (!cljSession) {
      output.appendLineOtherErr('No Clojure session available for runtime detection');
      return null;
    }

    const currentBuild = getCurrentBuild();
    if (!currentBuild) {
      output.appendLineOtherErr('No shadow-cljs build currently connected');
      return null;
    }

    const getRuntimesCode = `(shadow.cljs.devtools.api/repl-runtimes ${currentBuild})`;

    const result = await cljSession.eval(getRuntimesCode, 'user').value;

    if (!result || result === '()' || result === '[]') {
      output.appendLineOtherOut('No runtimes currently connected to shadow-cljs');
      return [];
    }

    // Parse the EDN data structure returned by shadow-cljs
    try {
      const apiRuntimes: shadowRuntimeCore.ShadowApiRuntimeInfo[] = parseEdnWithInst(result);
      return apiRuntimes.map(shadowRuntimeCore.normalizeRuntimeInfo);
    } catch (parseError) {
      output.appendLineOtherErr(`Error parsing runtime information: ${parseError}`);
      output.appendLineOtherOut(`Raw result: ${result}`);
      return null;
    }
  } catch (error) {
    output.appendLineOtherErr(`Error querying shadow-cljs runtimes: ${error}`);
    return null;
  }
}

/**
 * Format runtime information for display in QuickPick
 */
function makeRuntimeMenuItem(runtime: shadowRuntimeCore.RuntimeInfo): RuntimeQuickPickItem {
  const detailParts = [
    `build: ${runtime.buildId}`,
    `id: ${runtime.clientId}`,
    `host: ${runtime.host}`,
    `since: ${runtime.sinceDescription}`,
    `worker: ${runtime.workerId}`,
  ];

  return {
    label: `Runtime: ${runtime.clientId}`,
    description: runtime.description,
    detail: detailParts.join(', '),
    runtimeInfo: runtime,
  };
}

/**
 * Select a shadow-cljs runtime using VS Code QuickPick
 */
export async function selectShadowRuntime(): Promise<RuntimeQuickPickItem | null> {
  const runtimes = await getShadowRuntimes();

  if (!runtimes) {
    void vscode.window.showErrorMessage('Failed to query shadow-cljs runtimes');
    return null;
  }

  if (runtimes.length === 0) {
    void vscode.window.showInformationMessage(
      'No runtimes currently connected. Please start your ClojureScript application.'
    );
    return null;
  }

  const items = runtimes.map(makeRuntimeMenuItem);

  // Get currently selected runtime from state to pre-select it in QuickPick
  const currentRuntimeId = getSelectedRuntimeId();
  const currentItem = currentRuntimeId
    ? items.find((item) => item.runtimeInfo.clientId === currentRuntimeId)
    : undefined;

  const selected = await util.quickPickSingle({
    title: 'shadow-cljs runtimes',
    values: items,
    placeHolder: `${runtimes.length} runtime${runtimes.length > 1 ? 's' : ''} detected`,
    saveAs: 'shadow-cljs-runtime-selection',
    default: currentItem,
    autoSelect: false,
  });

  return (selected as RuntimeQuickPickItem) || null;
}

/**

/**
 * Switch to a specific shadow-cljs runtime
 */
export async function switchToRuntime(
  runtimeInfo: shadowRuntimeCore.RuntimeInfo,
  clientKey?: string
): Promise<boolean> {
  try {
    let cljSession;
    if (clientKey) {
      cljSession = sessionRegistry.getPrimarySessionForClient(clientKey);
    } else {
      cljSession = getPrimarySessionForCurrentConnection();
    }

    if (!cljSession) {
      output.appendLineOtherErr('No Clojure session available for shadow-cljs runtime selection');
      return false;
    }

    let currentBuild;
    if (clientKey) {
      currentBuild = connectionState.getConnectionState(clientKey)?.cljsBuild;
    } else {
      currentBuild = getCurrentBuild();
    }
    const clientId = runtimeInfo.clientId;

    const selectRuntimeCode = `(shadow.cljs.devtools.api/repl-runtime-select ${currentBuild} ${clientId})`;

    await cljSession.eval(selectRuntimeCode, 'user').value;

    updateRuntimeState(clientId, runtimeInfo, clientKey);

    // Update status bar to show the new runtime
    status.update();

    return true;
  } catch (error) {
    output.appendLineOtherErr(`Error switching to shadow-cljs runtime: ${error}`);
    return false;
  }
}

/**
 * Main command: Select Shadow CLJS Runtime
 * Combines runtime detection, QuickPick UI, and runtime switching
 */
export async function selectShadowCljsRuntimeCommand(): Promise<void> {
  try {
    const selectedRuntime = await selectShadowRuntime();

    if (selectedRuntime) {
      const success = await switchToRuntime(selectedRuntime.runtimeInfo);

      if (success) {
        void output.appendLineOtherOut(
          `Switched to shadow-cljs runtime ${selectedRuntime.runtimeInfo.clientId}: ${selectedRuntime.description}`
        );
      } else {
        void vscode.window.showErrorMessage(
          `Failed to switch shadow-cljs runtime (ID: ${selectedRuntime.runtimeInfo.clientId}). See Calva output for details.`
        );
      }
    }
  } catch (error) {
    output.appendLineOtherErr(`Error in selectShadowCljsRuntimeCommand: ${error}`);
    void vscode.window.showErrorMessage(`Failed to select shadow-cljs runtime: ${error}`);
  }
}

/**
 * Detect and store the initially connected runtime after CLJS REPL setup
 * This handles the case where shadow-cljs automatically connects to a runtime
 */
export async function detectInitialRuntime(): Promise<void> {
  try {
    // Get connection state for the currently routed session
    const routedSessionKey = replSession.getReplSessionTypeFromState();
    if (!routedSessionKey) {
      return;
    }
    const connectionState = sessionRegistry.getConnectionStateForSession(routedSessionKey);
    if (connectionState?.cljsTypeName !== 'shadow-cljs') {
      return; // Only run for shadow-cljs projects
    }

    const runtimes = await getShadowRuntimes();
    if (!runtimes || runtimes.length === 0) {
      output.appendLineOtherOut(`No shadow-cljs runtimes detected.`);
      return; // No runtimes available
    }

    const runtime = runtimes[0];
    const clientId = runtime.clientId;

    updateRuntimeState(clientId, runtime, connectionState.clientKey);

    status.update();
    if (runtimes.length > 1) {
      output.appendLineOtherOut(
        `Multiple shadow-cljs runtimes detected (${runtimes.length}). Assuming the first one, ${clientId}, is connected.`
      );
    }
    output.appendLineOtherOut(
      `Connected shadow-cljs runtime: ${clientId}, ${runtime.description}, host: ${runtime.host}`
    );
  } catch (error) {
    output.appendLineOtherOut(`Note: Could not detect initial shadow-cljs runtime: ${error}`);
  }
}

export type { shadowRuntimeCore as ShadowRuntimeTypes };
export type { RuntimeQuickPickItem };

export function updateRuntimeState(
  clientId: number,
  runtimeInfo: shadowRuntimeCore.RuntimeInfo,
  clientKey?: string
): void {
  if (clientKey) {
    connectionState.setConnectionState(clientKey, {
      shadowCljsRuntimeId: clientId,
      shadowCljsRuntimeInfo: runtimeInfo,
    });
  } else {
    const state = getConnectionStateForCurrentContext();
    if (state) {
      connectionState.setConnectionState(state.clientKey, {
        shadowCljsRuntimeId: clientId,
        shadowCljsRuntimeInfo: runtimeInfo,
      });
    }
  }
  status.update();
}

export function clearRuntimeState(clientKey?: string): void {
  if (clientKey) {
    connectionState.setConnectionState(clientKey, {
      shadowCljsRuntimeId: undefined,
      shadowCljsRuntimeInfo: undefined,
    });
  } else {
    const state = getConnectionStateForCurrentContext();
    if (state) {
      connectionState.setConnectionState(state.clientKey, {
        shadowCljsRuntimeId: undefined,
        shadowCljsRuntimeInfo: undefined,
      });
    }
  }
  status.update();
}

/**
 * Handle shadow-remote messages for runtime status updates
 * We only care about notifications, for now
 * If the current runtime discconnects, we do not connect a new runtime automatically,
 * except if a new runtime presents itself while we are disconnected,
 * if so, we connect to it.
 * This supports the case where we the user is connected to a client and reloads the page,
 * expecting to remain connected to the reloaded page.
 */
export async function handleShadowRemoteMessage(msgData: any, clientKey: string): Promise<void> {
  try {
    if (msgData.data) {
      const data = parseEdn(msgData.data);
      const currentRuntimeId = getSelectedRuntimeId(clientKey);
      const action = shadowRuntimeCore.decideMessageAction(data, currentRuntimeId);

      switch (action.type) {
        case 'runtime-disconnected': {
          const currentRuntimeInfo = getSelectedRuntimeInfo(clientKey) || {
            description: 'No description',
          };
          clearRuntimeState(clientKey);
          output.appendLineOtherOut(
            `shadow-cljs runtime disconnected: ${action.clientId} ${currentRuntimeInfo.description}`
          );
          break;
        }
        case 'runtime-connected': {
          const success = await switchToRuntime(action.runtimeInfo, clientKey);
          if (success) {
            output.appendLineOtherOut(
              `shadow-cljs runtime connected: ${action.clientId}, ${action.runtimeInfo.description}`
            );
          } else {
            output.appendLineOtherErr(
              `Failed to connect shadow-cljs runtime: ${action.clientId}, ${action.runtimeInfo.description}`
            );
          }
          break;
        }
        // 'no-action' - do nothing
      }
    }
  } catch (error) {
    output.appendLineOtherErr(`Error handling shadow-remote message: ${error}`);
  }
}

/**
 * Initialize shadow-remote notifications for real-time runtime status updates
 */
export async function initializeShadowRemoteNotifications(): Promise<void> {
  try {
    const cljSession = getPrimarySessionForCurrentConnection();
    if (!cljSession) {
      output.appendLineOtherErr('No Clojure session available for shadow-remote initialization');
      return;
    }
    const initResult = await cljSession.shadowCljsRemoteInit();
    if (initResult) {
      await cljSession.shadowCljsRemoteRegisterNotify();
      output.appendLineOtherOut('Initialized shadow-cljs runtime status notifications');
    } else {
      output.appendLineOtherOut(
        'shadow-cljs remote notificatuons not supported with shadow-cljs version < 3.2.1'
      );
    }
  } catch (error) {
    output.appendLineOtherOut(`Note: Could not initialize shadow-remote notifications: ${error}`);
  }
}
