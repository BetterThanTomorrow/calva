import * as vscode from 'vscode';
import * as replSession from './nrepl/repl-session';
import * as sessionRegistry from './nrepl/session-registry';
import * as clientRegistry from './nrepl/client-registry';
import * as util from './utilities';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as output from './results-output/output';
import * as status from './status';
import * as shadowRuntimeCore from './shadow-cljs-runtime-core';

/**
 * Tracks the last time Calva evaluated code on each runtime ID.
 * Key: runtimeId, Value: milliseconds since epoch (Date.now())
 */
const runtimeLastActivity = new Map<number, number>();

export function recordRuntimeActivity(runtimeId: number): void {
  runtimeLastActivity.set(runtimeId, Date.now());
}

export function getRuntimeLastActivity(runtimeId: number): number | undefined {
  return runtimeLastActivity.get(runtimeId);
}

interface RuntimeQuickPickItem extends vscode.QuickPickItem {
  runtimeInfo: shadowRuntimeCore.RuntimeInfo;
}

/**
 * Get clientKey and connectionState for the currently routed session's connection.
 * Returns null if no session is routed.
 */
function getConnectionContextForCurrentSession() {
  const routedSessionKey = replSession.getReplSessionTypeFromState();
  if (!routedSessionKey) {
    return null;
  }
  const clientKey = sessionRegistry.getClientKeyForSession(routedSessionKey);
  if (!clientKey) {
    return null;
  }
  const connectionState = clientRegistry.getConnectionState(clientKey);
  if (!connectionState) {
    return null;
  }
  return { clientKey, connectionState };
}

export function getSelectedRuntimeInfo(clientKey?: string): shadowRuntimeCore.RuntimeInfo {
  if (clientKey) {
    return clientRegistry.getConnectionState(clientKey)?.shadowCljsRuntimeInfo;
  }
  const ctx = getConnectionContextForCurrentSession();
  return ctx?.connectionState.shadowCljsRuntimeInfo;
}

export function getSelectedRuntimeId(clientKey?: string): number {
  if (clientKey) {
    return clientRegistry.getConnectionState(clientKey)?.shadowCljsRuntimeId;
  }
  const ctx = getConnectionContextForCurrentSession();
  return ctx?.connectionState.shadowCljsRuntimeId;
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
  const ctx = getConnectionContextForCurrentSession();
  return ctx?.connectionState.cljsBuild ?? null;
}

/**
 * Get available shadow-cljs runtimes for a specific client connection.
 * Use this when the clientKey is known (e.g., during initial connection setup).
 */
export async function getShadowRuntimesForClient(
  clientKey: string
): Promise<shadowRuntimeCore.RuntimeInfo[] | null> {
  try {
    const cljSession = sessionRegistry.getPrimarySessionForClient(clientKey);
    if (!cljSession) {
      output.appendLineOtherErr('No Clojure session available for runtime detection');
      return null;
    }

    const currentBuild = clientRegistry.getConnectionState(clientKey)?.cljsBuild;
    const getRuntimesCode = currentBuild
      ? `(shadow.cljs.devtools.api/repl-runtimes ${currentBuild})`
      : `(vec (mapcat (fn [b] (try (shadow.cljs.devtools.api/repl-runtimes b) (catch Exception _ nil))) (shadow.cljs.devtools.api/active-builds)))`;

    const result = await cljSession.eval(getRuntimesCode, 'user').value;

    if (!result || result === '()' || result === '[]') {
      output.appendLineOtherOut('No runtimes currently connected to shadow-cljs');
      return [];
    }

    // Parse the EDN data structure returned by shadow-cljs
    try {
      const apiRuntimes: shadowRuntimeCore.ShadowApiRuntimeInfo[] =
        cljsLib.parseEdnWithInst(result);
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
 * Get active builds and connected runtimes across all builds for a client connection.
 */
export async function getShadowRuntimesAllBuilds(
  clientKey: string
): Promise<{ activeBuilds: string[]; runtimes: shadowRuntimeCore.RuntimeInfo[] } | null> {
  try {
    const cljSession = sessionRegistry.getPrimarySessionForClient(clientKey);
    if (!cljSession) {
      output.appendLineOtherErr('No Clojure session available for runtime detection');
      return null;
    }

    const queryCode = `(let [active (shadow.cljs.devtools.api/active-builds)]
      {:active-builds (vec (map str active))
       :runtimes (vec (mapcat (fn [b] (try (shadow.cljs.devtools.api/repl-runtimes b) (catch Exception _ nil))) active))})`;

    const result = await cljSession.eval(queryCode, 'user').value;

    if (!result || result === 'nil') {
      return { activeBuilds: [], runtimes: [] };
    }

    try {
      const parsed: any = cljsLib.parseEdnWithInst(result);
      const activeBuilds: string[] = parsed['active-builds'] || [];
      const apiRuntimes: shadowRuntimeCore.ShadowApiRuntimeInfo[] = parsed['runtimes'] || [];
      return {
        activeBuilds,
        runtimes: apiRuntimes.map(shadowRuntimeCore.normalizeRuntimeInfo),
      };
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
      const apiRuntimes: shadowRuntimeCore.ShadowApiRuntimeInfo[] =
        cljsLib.parseEdnWithInst(result);
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
    `id: ${runtime.runtimeId}`,
    `host: ${runtime.host}`,
    `since: ${runtime.sinceDescription}`,
    `worker: ${runtime.workerId}`,
  ];

  return {
    label: `Runtime: ${runtime.runtimeId}`,
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
    ? items.find((item) => item.runtimeInfo.runtimeId === currentRuntimeId)
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
      currentBuild = clientRegistry.getConnectionState(clientKey)?.cljsBuild;
    } else {
      currentBuild = getCurrentBuild();
    }
    const runtimeId = runtimeInfo.runtimeId;

    const selectRuntimeCode = `(shadow.cljs.devtools.api/repl-runtime-select ${currentBuild} ${runtimeId})`;

    await cljSession.eval(selectRuntimeCode, 'user').value;

    updateRuntimeState(runtimeId, runtimeInfo, clientKey);

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
          `Switched to shadow-cljs runtime ${selectedRuntime.runtimeInfo.runtimeId}: ${selectedRuntime.description}`
        );
      } else {
        void vscode.window.showErrorMessage(
          `Failed to switch shadow-cljs runtime (ID: ${selectedRuntime.runtimeInfo.runtimeId}). See Calva output for details.`
        );
      }
    }
  } catch (error) {
    output.appendLineOtherErr(`Error in selectShadowCljsRuntimeCommand: ${error}`);
    void vscode.window.showErrorMessage(`Failed to select shadow-cljs runtime: ${error}`);
  }
}

/**
 * Detect and store the initially connected runtime after CLJS REPL setup.
 * This handles the case where shadow-cljs automatically connects to a runtime.
 *
 * When called during initial connection (before session routing is set up),
 * pass the clientKey explicitly to avoid relying on session routing lookup.
 */
export async function detectInitialRuntime(clientKey?: string): Promise<void> {
  try {
    let effectiveClientKey: string;
    let connectionState;

    if (clientKey) {
      // Use the explicitly provided clientKey (during initial connection)
      effectiveClientKey = clientKey;
      connectionState = clientRegistry.getConnectionState(clientKey);
    } else {
      // Fall back to looking up via session routing (for later calls)
      const ctx = getConnectionContextForCurrentSession();
      if (!ctx) {
        return;
      }
      effectiveClientKey = ctx.clientKey;
      connectionState = ctx.connectionState;
    }

    if (!connectionState || connectionState.cljsTypeName !== 'shadow-cljs') {
      return; // Only run for shadow-cljs projects
    }

    const runtimes = await getShadowRuntimesForClient(effectiveClientKey);
    if (!runtimes || runtimes.length === 0) {
      output.appendLineOtherOut(`No shadow-cljs runtimes detected.`);
      return; // No runtimes available
    }

    const runtime = runtimes[0];
    const runtimeId = runtime.runtimeId;

    updateRuntimeState(runtimeId, runtime, effectiveClientKey);

    status.update();
    if (runtimes.length > 1) {
      output.appendLineOtherOut(
        `Multiple shadow-cljs runtimes detected (${runtimes.length}). Assuming the first one, ${runtimeId}, is connected.`
      );
    }
    output.appendLineOtherOut(
      `Connected shadow-cljs runtime: ${runtimeId}, ${runtime.description}, host: ${runtime.host}`
    );
  } catch (error) {
    output.appendLineOtherOut(`Note: Could not detect initial shadow-cljs runtime: ${error}`);
  }
}

export type { shadowRuntimeCore as ShadowRuntimeTypes };
export type { RuntimeQuickPickItem };
export { canonicalBuildId } from './shadow-cljs-runtime-core';

export function updateRuntimeState(
  runtimeId: number,
  runtimeInfo: shadowRuntimeCore.RuntimeInfo,
  clientKey?: string
): void {
  if (clientKey) {
    clientRegistry.setConnectionState(clientKey, {
      shadowCljsRuntimeId: runtimeId,
      shadowCljsRuntimeInfo: runtimeInfo,
    });
  } else {
    const ctx = getConnectionContextForCurrentSession();
    if (ctx) {
      clientRegistry.setConnectionState(ctx.clientKey, {
        shadowCljsRuntimeId: runtimeId,
        shadowCljsRuntimeInfo: runtimeInfo,
      });
    }
  }
  status.update();
}

export function clearRuntimeState(clientKey?: string): void {
  if (clientKey) {
    clientRegistry.setConnectionState(clientKey, {
      shadowCljsRuntimeId: undefined,
      shadowCljsRuntimeInfo: undefined,
    });
  } else {
    const ctx = getConnectionContextForCurrentSession();
    if (ctx) {
      clientRegistry.setConnectionState(ctx.clientKey, {
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
      const data = cljsLib.parseEdn(msgData.data);
      const currentRuntimeId = getSelectedRuntimeId(clientKey);
      const action = shadowRuntimeCore.decideMessageAction(data, currentRuntimeId);

      switch (action.type) {
        case 'runtime-disconnected': {
          const currentRuntimeInfo = getSelectedRuntimeInfo(clientKey) || {
            description: 'No description',
          };
          clearRuntimeState(clientKey);
          output.appendLineOtherOut(
            `shadow-cljs runtime disconnected: ${action.runtimeId} ${currentRuntimeInfo.description}`
          );
          break;
        }
        case 'runtime-connected': {
          const success = await switchToRuntime(action.runtimeInfo, clientKey);
          if (success) {
            output.appendLineOtherOut(
              `shadow-cljs runtime connected: ${action.runtimeId}, ${action.runtimeInfo.description}`
            );
          } else {
            output.appendLineOtherErr(
              `Failed to connect shadow-cljs runtime: ${action.runtimeId}, ${action.runtimeInfo.description}`
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
        'shadow-cljs remote notifications not supported with shadow-cljs version < 3.2.1'
      );
    }
  } catch (error) {
    output.appendLineOtherOut(`Note: Could not initialize shadow-remote notifications: ${error}`);
  }
}
