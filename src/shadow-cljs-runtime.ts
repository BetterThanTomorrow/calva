import * as vscode from 'vscode';
import * as replSession from './nrepl/repl-session';
import { cljsLib } from './utilities';
import * as util from './utilities';
import { getStateValue, parseEdn, parseEdnWithInst } from '../out/cljs-lib/cljs-lib';
import * as output from './results-output/output';
import * as state from './state';
import status from './status';

interface ShadowApiRuntimeInfo {
  'client-id': number;
  'user-agent'?: string;
  desc?: string;
  type: string;
  lang: string;
  'build-id': string;
  host: string;
  'worker-id': number;
  dom?: boolean;
  since?: Date;
  sinceInst?: number;
  sinceDescription?: string;
  'proc-id'?: string;
  'connection-info'?: {
    remote: boolean;
    websocket: boolean;
  };
}

interface RuntimeInfo {
  clientId: number;
  description: string;
  buildId: string;
  host: string;
  workerId: number;
  sinceInst: number;
  sinceDescription: string;
}

/**
 * Format a timestamp to a human-readable local time string
 */
function formatSinceDescription(since: Date | undefined): string {
  if (!since) {
    return 'Unknown time';
  }

  return since.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  });
}

function normalizeRuntimeInfo(apiInfo: ShadowApiRuntimeInfo): RuntimeInfo {
  const sinceDate = apiInfo.since;
  const sinceInst = sinceDate ? sinceDate.getTime() : 0;
  const sinceDescription = formatSinceDescription(sinceDate);

  return {
    clientId: apiInfo['client-id'],
    description: apiInfo.desc || apiInfo['user-agent'] || 'No description',
    buildId: apiInfo['build-id'],
    host: apiInfo.host,
    workerId: apiInfo['worker-id'],
    sinceInst,
    sinceDescription,
  };
}

interface RuntimeQuickPickItem extends vscode.QuickPickItem {
  runtimeInfo: RuntimeInfo;
}

export function getSelectedRuntimeInfo(): RuntimeInfo {
  return getStateValue('shadow-cljs:getSelectedRuntimeInfo');
}

export function getSelectedRuntimeId(): number {
  return getStateValue('shadow-cljs:getSelectedRuntimeId');
}

/**
 * Get available shadow-cljs runtimes for the current build
 */
export async function getShadowRuntimes(): Promise<RuntimeInfo[] | null> {
  try {
    const cljSession = replSession.getSession('clj');
    if (!cljSession) {
      output.appendLineOtherErr('No Clojure session available for runtime detection');
      return null;
    }

    const currentBuild = getStateValue('cljsBuild');
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
      const apiRuntimes: ShadowApiRuntimeInfo[] = parseEdnWithInst(result);
      return apiRuntimes.map(normalizeRuntimeInfo);
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
function makeRuntimeMenuItem(runtime: RuntimeInfo): RuntimeQuickPickItem {
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
export async function switchToRuntime(runtimeInfo: RuntimeInfo): Promise<boolean> {
  try {
    const cljSession = replSession.getSession('clj');
    if (!cljSession) {
      output.appendLineOtherErr('No Clojure session available for runtime selection');
      return false;
    }

    const currentBuild = getStateValue('cljsBuild');
    const clientId = runtimeInfo.clientId;

    const selectRuntimeCode = `(shadow.cljs.devtools.api/repl-runtime-select ${currentBuild} ${clientId})`;

    await cljSession.eval(selectRuntimeCode, 'user').value;

    // Store runtime selection in state
    cljsLib.setStateValue('shadow-cljs:getSelectedRuntimeId', clientId);
    cljsLib.setStateValue('shadow-cljs:getSelectedRuntimeInfo', runtimeInfo);

    // Update status bar to show the new runtime
    status.update();

    return true;
  } catch (error) {
    output.appendLineOtherErr(`Error switching to runtime: ${error}`);
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
          `Switched to runtime ${selectedRuntime.runtimeInfo.clientId}: ${selectedRuntime.description}`
        );
      } else {
        void vscode.window.showErrorMessage(
          `Failed to switch runtime (ID: ${selectedRuntime.runtimeInfo.clientId}). See Calva output for details.`
        );
      }
    }
  } catch (error) {
    output.appendLineOtherErr(`Error in selectShadowCljsRuntimeCommand: ${error}`);
    void vscode.window.showErrorMessage(`Failed to select runtime: ${error}`);
  }
}

/**
 * Detect and store the initially connected runtime after CLJS REPL setup
 * This handles the case where shadow-cljs automatically connects to a runtime
 */
export async function detectInitialRuntime(): Promise<void> {
  try {
    const cljsTypeName = state.extensionContext.workspaceState.get('selectedCljsTypeName');
    if (cljsTypeName !== 'shadow-cljs') {
      return; // Only run for shadow-cljs projects
    }

    const runtimes = await getShadowRuntimes();
    if (!runtimes || runtimes.length === 0) {
      output.appendLineOtherOut(`No runtimes detected.`);
      return; // No runtimes available
    }

    const runtime = runtimes[0];
    const clientId = runtime.clientId;

    // Store the detected runtime
    cljsLib.setStateValue('shadow-cljs:getSelectedRuntimeId', clientId);
    cljsLib.setStateValue('shadow-cljs:getSelectedRuntimeInfo', runtime);

    status.update();
    if (runtimes.length > 1) {
      output.appendLineOtherOut(
        `Multiple runtimes detected (${runtimes.length}). Assuming the first one, ${clientId}, is connected.`
      );
    }
    output.appendLineOtherOut(
      `Connected runtime: ${clientId}, ${runtime.description}, host: ${runtime.host}`
    );
  } catch (error) {
    output.appendLineOtherOut(`Note: Could not detect initial shadow-cljs runtime: ${error}`);
  }
}

export type { ShadowApiRuntimeInfo as ShadowRuntimeInfo, RuntimeQuickPickItem };
