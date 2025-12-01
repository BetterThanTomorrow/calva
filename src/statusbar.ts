import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import * as config from './config';
import * as shadowRuntimes from './shadow-cljs-runtime';
import { getStateValue } from '../out/cljs-lib/cljs-lib';
import * as replSession from './nrepl/repl-session';
import * as sessionLabel from './nrepl/session-label';
import * as sessionRouting from './nrepl/session-routing';
import * as sessionRegistry from './nrepl/session-registry';
import * as replWindow from './repl-window/repl-doc';

// Helper to get connection state for the currently routed session
function getConnectionStateForRoutedSession() {
  const replType = replSession.getReplSessionTypeFromState();
  if (!replType) {
    return undefined;
  }
  return sessionRegistry.getConnectionStateForSession(replType);
}

const connectionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
const typeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
const cljsBuildStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
const shadowRuntimeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
const prettyPrintToggle = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
const color = {
  active: 'white',
  inactive: '#b3b3b3',
};

// get theme kind once
//console.log(vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light' : 'dark/hc');
// event
//vscode.window.onDidChangeActiveColorTheme(e => {
//	console.log(e.kind === ColorThemeKind.Light ? 'light' : 'dark/hc');
//});
function colorValue(section: string, currentConf: vscode.WorkspaceConfiguration): string {
  const configSection = currentConf.inspect<string>(section);

  util.assertIsDefined(configSection, () => `Expected config section "${section}" to be defined!`);

  const { defaultValue, globalValue, workspaceFolderValue, workspaceValue } = configSection;

  const value = workspaceFolderValue || workspaceValue || globalValue || defaultValue;

  // Current behavior is to assert that this is a string even though it may
  // not be. Maintaining current behavior for the moment but we should
  // eventually do an assertion here or allow the function to return
  // undefined.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
  return value!;
}

function update() {
  const currentConf = vscode.workspace.getConfiguration(
    `calva.statusColor.${
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light' : 'dark'
    }`
  );

  const doc = util.tryToGetDocument({}),
    fileType = util.getFileType(doc);

  //let disconnectedColor = "rgb(192,192,192)";

  const pprint = config.getConfig().prettyPrintingOptions?.enabled;
  prettyPrintToggle.text = 'pprint';
  prettyPrintToggle.color = pprint ? undefined : color.inactive;
  prettyPrintToggle.tooltip = `Turn pretty printing ${pprint ? 'off' : 'on'}`;
  prettyPrintToggle.command = 'calva.togglePrettyPrint';

  typeStatus.command = undefined;
  typeStatus.text = 'Disconnected';
  typeStatus.tooltip = 'No active REPL session';
  typeStatus.color = colorValue('disconnectedColor', currentConf);

  connectionStatus.command = undefined;
  connectionStatus.tooltip = 'REPL connection status';

  cljsBuildStatus.text = '';
  cljsBuildStatus.command = undefined;
  cljsBuildStatus.tooltip = undefined;

  shadowRuntimeStatus.text = '';
  shadowRuntimeStatus.command = 'calva.selectShadowCljsRuntime';
  shadowRuntimeStatus.tooltip = undefined;

  if (!getStateValue('connected')) {
    typeStatus.hide();
  }
  if (getStateValue('connected')) {
    connectionStatus.text = 'REPL $(zap)';
    connectionStatus.color = colorValue('connectedStatusColor', currentConf);
    connectionStatus.tooltip = `nrepl://${getStateValue('hostname')}:${getStateValue(
      'port'
    )} (Click to reset connection)`;
    connectionStatus.command = 'calva.showReplMenu';
    typeStatus.color = colorValue('typeStatusColor', currentConf);
    const replType = replSession.getReplSessionTypeFromState();
    if (replType) {
      const pinnedSessionKey = sessionRouting.getPinnedSessionKey();
      const isPinned = sessionRouting.isPinned() && Boolean(pinnedSessionKey);
      const routingInfo = replSession.getRoutingInfo();
      const isCljcRouting = routingInfo?.reason.type === 'cljc-within-connection';
      const displaySessionKey =
        isPinned && pinnedSessionKey ? pinnedSessionKey : routingInfo?.sessionKey ?? replType;

      // Use shared session label formatting
      const labelContext = replSession.getSessionLabelContext({ isPinned, doc });
      const baseStatusText = sessionLabel.formatSessionLabel(displaySessionKey, labelContext);

      const pinIndicator = isPinned ? '$(pin) ' : '';
      typeStatus.text = `${pinIndicator}${baseStatusText}`;
      typeStatus.command = 'calva.showReplSessionsMenu';
      const tooltipParts = [
        isPinned
          ? `Pinned session: ${displaySessionKey}`
          : `Auto-route session: ${displaySessionKey}`,
      ];

      if (isCljcRouting && !isPinned) {
        tooltipParts.push(`File routes via cljc preference to ${displaySessionKey}`);
      }

      tooltipParts.push('Click to show the REPL Sessions menu');
      typeStatus.tooltip = tooltipParts.join('. ');
    }
    // Show build status when the current routed session is a secondary session
    const isCurrentSessionSecondary = replType && sessionRegistry.isSessionSecondary(replType);
    // Get connection state for the current routed session
    const connectionState = replType
      ? sessionRegistry.getConnectionStateForSession(replType)
      : undefined;
    const cljsBuild = connectionState?.cljsBuild ?? null;
    const cljsTypeName = connectionState?.cljsTypeName;
    const hasBuilds = connectionState?.hasBuilds ?? false;

    if (isCurrentSessionSecondary && hasBuilds) {
      cljsBuildStatus.command = 'calva.switchCljsBuild';
      if (cljsBuild !== null) {
        cljsBuildStatus.text = cljsBuild;
        cljsBuildStatus.tooltip = 'Click to switch CLJS build REPL';
      } else {
        cljsBuildStatus.text = 'No build connected';
        cljsBuildStatus.tooltip = 'Click to connect to a CLJS build REPL';
      }
    }

    // Show shadow runtime status when the current routed session is a secondary session
    if (isCurrentSessionSecondary && cljsTypeName === 'shadow-cljs') {
      const selectedRuntime = shadowRuntimes.getSelectedRuntimeId();
      const runtimeInfo = shadowRuntimes.getSelectedRuntimeInfo();

      if (selectedRuntime && runtimeInfo) {
        shadowRuntimeStatus.text = `rt: ${selectedRuntime}`;
        shadowRuntimeStatus.tooltip = `Connected to ${runtimeInfo.description}, ${runtimeInfo.sinceDescription}`;
        shadowRuntimeStatus.command = 'calva.selectShadowCljsRuntime';
      } else {
        shadowRuntimeStatus.text = 'No Runtime';
        shadowRuntimeStatus.tooltip = 'Click to select shadow-cljs runtime';
        shadowRuntimeStatus.command = 'calva.selectShadowCljsRuntime';
      }
    }
    typeStatus.show();
  } else if (util.getLaunchingState()) {
    connectionStatus.color = colorValue('launchingColor', currentConf);
    connectionStatus.text = 'Launching REPL using ' + util.getLaunchingState();
    connectionStatus.tooltip = 'Click to interrupt jack-in or Connect to REPL Server';
    connectionStatus.command = 'calva.disconnect';
  } else if (util.getConnectingState()) {
    connectionStatus.text = 'REPL - trying to connect';
    connectionStatus.tooltip = 'Click to interrupt jack-in or Connect to REPL Server';
    connectionStatus.command = 'calva.disconnect';
    typeStatus.show();
  } else {
    connectionStatus.text = 'REPL $(zap)';
    connectionStatus.tooltip = 'Click to jack-in or Connect to REPL Server';
    connectionStatus.color = colorValue('disconnectedColor', currentConf);
    connectionStatus.command = 'calva.showReplMenu';
  }
  connectionStatus.show();
  if (cljsBuildStatus.text) {
    cljsBuildStatus.show();
  } else {
    cljsBuildStatus.hide();
  }

  // Show shadow runtime status when the current routed session is a secondary session
  const replType = replSession.getReplSessionTypeFromState();
  const isRoutedSessionSecondary = replType && sessionRegistry.isSessionSecondary(replType);
  const routedConnectionState = replType
    ? sessionRegistry.getConnectionStateForSession(replType)
    : undefined;
  if (
    getStateValue('connected') &&
    isRoutedSessionSecondary &&
    routedConnectionState?.cljsTypeName === 'shadow-cljs' &&
    shadowRuntimeStatus.text
  ) {
    shadowRuntimeStatus.show();
  } else {
    shadowRuntimeStatus.hide();
  }

  prettyPrintToggle.show();
}

export default {
  update,
  color,
};
