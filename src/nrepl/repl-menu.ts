import * as vscode from 'vscode';
import * as state from '../state';
import * as utilities from '../utilities';
import * as fiddleFiles from '../fiddle-files';
import * as joyride from '../joyride';
import * as drams from './drams';

type MenuSlug = { prefix: string; suffix: string };

export function menuSlugForProjectRoot(): MenuSlug {
  const prefix = state.getProjectRootUri() ? state.getProjectRootUri().toString() : 'no-folder';
  const suffix = shouldShowConnectedMenu()
    ? 'connect-repl-menu-connected'
    : 'connect-repl-menu-not-connected';
  return { prefix, suffix };
}

export type MenuItem = vscode.QuickPickItem & {
  command?: string;
  dramSrc?: any;
  condition?: () => boolean;
  kind?: vscode.QuickPickItemKind;
};

const RE_JACK_IN_OPTION = 'Restart the Project REPL (a.k.a. Re-jack-in)';
const RE_JACK_IN_COMMAND = 'calva.jackIn';
const JACK_OUT_OPTION = 'Stop/Kill the Project REPL started by Calva (a.k.a. Jack-out)';
const JACK_OUT_COMMAND = 'calva.jackOut';
const INTERRUPT_OPTION = 'Interrupt running Evaluations';
const INTERRUPT_COMMAND = 'calva.interruptAllEvaluations';
const DISCONNECT_OPTION = 'Disconnect from the REPL';
const DISCONNECT_COMMAND = 'calva.disconnect';
const OPEN_REPL_WINDOW_OPTION = 'Show the REPL Window';
const OPEN_REPL_WINDOW_COMMAND = 'calva.showReplWindow';
const OPEN_INSPECTOR_OPTION = 'Show the Inspector';
const OPEN_INSPECTOR_COMMAND = 'calva.revealInspector';
const OPEN_OUTPUT_DESTINATION_OPTION = 'Show the Output Destination';
const OPEN_OUTPUT_DESTINATION_COMMAND = 'calva.showResultOutputDestination';
const OPEN_FIDDLE_OPTION = 'Open Fiddle for Current File';
const OPEN_FIDDLE_COMMAND = 'calva.openFiddleForSourceFile';
const EVALUATE_FIDDLE_OPTION = 'Evaluate Fiddle for Current File';
const EVALUATE_FIDDLE_COMMAND = 'calva.evaluateFiddleForSourceFile';
const OPEN_SOURCE_FOR_FIDDLE_OPTION = 'Open Source File for Current Fiddle';
const OPEN_SOURCE_FOR_FIDDLE_COMMAND = 'calva.openSourceFileForFiddle';
export const JACK_IN_OPTION = 'Start your project with a REPL and connect (a.k.a. Jack-in)';
const JACK_IN_COMMAND = 'calva.jackIn';
const START_JOYRIDE_REPL_OPTION = 'Start a Joyride REPL and Connect';
const START_JOYRIDE_REPL_COMMAND = 'calva.startJoyrideReplAndConnect';
const STOP_JOYRIDE_NREPL_OPTION = 'Stop the Joyride nREPL server';
const STOP_JOYRIDE_NREPL_COMMAND = 'joyride.stopNReplServer';
const CONNECT_PROJECT_OPTION = 'Connect to a running REPL in your project';
const CONNECT_PROJECT_COMMAND = 'calva.connect';
const CONNECT_STANDALONE_OPTION = 'Connect to a running REPL, not in your project';
const CONNECT_STANDALONE_COMMAND = 'calva.connectNonProjectREPL';

async function connectedMenuItems(): Promise<MenuItem[]> {
  return [
    {
      label: OPEN_INSPECTOR_OPTION,
      command: OPEN_INSPECTOR_COMMAND,
    },
    {
      label: OPEN_OUTPUT_DESTINATION_OPTION,
      command: OPEN_OUTPUT_DESTINATION_COMMAND,
    },
    { label: INTERRUPT_OPTION, command: INTERRUPT_COMMAND },
    {
      label: RE_JACK_IN_OPTION,
      command: RE_JACK_IN_COMMAND,
      condition: utilities.getJackedInState,
    },
    {
      label: JACK_OUT_OPTION,
      command: JACK_OUT_COMMAND,
      condition: utilities.getJackedInState,
    },
    { label: DISCONNECT_OPTION, command: DISCONNECT_COMMAND },
    {
      label: OPEN_FIDDLE_OPTION,
      command: OPEN_FIDDLE_COMMAND,
      condition: () => !fiddleFiles.activeEditorIsFiddle,
    },
    {
      label: EVALUATE_FIDDLE_OPTION,
      command: EVALUATE_FIDDLE_COMMAND,
      condition: () => !fiddleFiles.activeEditorIsFiddle,
    },
    {
      label: OPEN_SOURCE_FOR_FIDDLE_OPTION,
      command: OPEN_SOURCE_FOR_FIDDLE_COMMAND,
      condition: () => fiddleFiles.activeEditorIsFiddle,
    },
    {
      label: OPEN_REPL_WINDOW_OPTION,
      command: OPEN_REPL_WINDOW_COMMAND,
    },
    {
      label: '',
      kind: vscode.QuickPickItemKind.Separator,
    },
    ...(await drams.createProjectMenuItems()),
  ];
}

async function disconnectedMenuItems(): Promise<MenuItem[]> {
  return [
    { label: JACK_IN_OPTION, command: JACK_IN_COMMAND },
    { label: CONNECT_PROJECT_OPTION, command: CONNECT_PROJECT_COMMAND },
    {
      label: START_JOYRIDE_REPL_OPTION,
      command: START_JOYRIDE_REPL_COMMAND,
      description: 'Requires the Joyride extension',
      detail: 'Hack VS Code like Emacs!',
      condition: () => !joyride.isJoyrideNReplServerRunning(),
    },
    {
      label: STOP_JOYRIDE_NREPL_OPTION,
      command: STOP_JOYRIDE_NREPL_COMMAND,
      condition: joyride.isJoyrideNReplServerRunning,
    },
    {
      label: CONNECT_STANDALONE_OPTION,
      command: CONNECT_STANDALONE_COMMAND,
    },
    {
      label: '',
      kind: vscode.QuickPickItemKind.Separator,
    },
    ...(await drams.createProjectMenuItems()),
  ];
}

function composeMenu(items: MenuItem[]): MenuItem[] {
  return items.filter((item) => !item.condition || item.condition());
}

export async function showReplMenu() {
  const menuItems: MenuItem[] = shouldShowConnectedMenu()
    ? composeMenu(await connectedMenuItems())
    : composeMenu(await disconnectedMenuItems());
  const pickedItem = await utilities.quickPickSingle({
    title: 'Calva REPL commands',
    values: menuItems,
    saveAs: 'calva.showReplMenu',
  });
  if (pickedItem) {
    const menuItem = menuItems.find((item) => item.label === pickedItem.label);
    if (menuItem?.command) {
      if ('dramSrc' in menuItem) {
        return vscode.commands.executeCommand(menuItem.command, menuItem.label, menuItem.dramSrc);
      } else {
        return vscode.commands.executeCommand(menuItem.command);
      }
    }
  }
}

function shouldShowConnectedMenu() {
  return (
    utilities.getConnectedState() || utilities.getConnectingState() || utilities.getLaunchingState()
  );
}
