import * as vscode from 'vscode';
import * as path from 'path';
import * as utilities from '../utilities';
import * as _ from 'lodash';
import * as state from '../state';
import * as connector from '../connector';
import { nClient } from '../connector';
import statusbar from '../statusbar';
import {
  askForConnectSequence,
  ReplConnectSequence,
  CljsTypes,
  getConnectSequences,
} from './connectSequence';
import * as projectTypes from './project-types';
import * as outputWindow from '../results-output/results-doc';
import { JackInTerminal, JackInTerminalOptions, createCommandLine } from './jack-in-terminal';
import * as liveShareSupport from '../live-share';
import { getConfig } from '../config';
import * as joyride from '../joyride';
import { ConnectType } from './connect-types';

let jackInPTY: JackInTerminal = undefined;
let jackInTerminal: vscode.Terminal = undefined;

function cancelJackInTask() {
  setTimeout(() => {
    calvaJackout();
  }, 1000);
}

function resolveEnvVariables(entry: any): any {
  if (typeof entry === 'string') {
    const s = entry.replace(/\$\{env:(\w+)\}/, (_, v) => (process.env[v] ? process.env[v] : ''));
    return s;
  } else {
    return entry;
  }
}

function processEnvObject(env: any) {
  return _.mapValues(env, resolveEnvVariables);
}

function getGlobalJackInEnv() {
  return {
    ...process.env,
    ...processEnvObject(getConfig().jackInEnv as object),
  };
}

function executeJackInTask(
  terminalOptions: JackInTerminalOptions,
  connectSequence: ReplConnectSequence,
  cb?: () => unknown
) {
  utilities.setLaunchingState(connectSequence.name);
  statusbar.update();

  // in case we have a running task present try to end it.
  calvaJackout();
  if (jackInTerminal !== undefined) {
    jackInTerminal.dispose();
    jackInTerminal = undefined;
  }

  try {
    const pty = new JackInTerminal(
      terminalOptions,
      (_p, hostname: string, port: string) => {
        jackInPTY = pty;
        utilities.setLaunchingState(null);
        void connector.connect(connectSequence, true, hostname, port).then(() => {
          utilities.setJackedInState(true);
          statusbar.update();
          outputWindow.appendLine('; Jack-in done.');
          outputWindow.appendPrompt();
          if (cb) {
            cb();
          }
        });
      },
      (errorMessage) => {
        outputWindow.appendLine('; Error in Jack-in: unable to read port file');
        outputWindow.appendLine(`; ${errorMessage}`);
        outputWindow.appendLine(
          '; You may have chosen the wrong jack-in configuration for your project.'
        );
        void vscode.window.showErrorMessage(
          'Error in Jack-in: unable to read port file. See output window for more information.'
        );
        cancelJackInTask();
      }
    );
    jackInTerminal = (<any>vscode.window).createTerminal({
      name: `Calva Jack-in: ${connectSequence.name}`,
      pty: pty,
    });
    if (getConfig().autoOpenJackInTerminal) {
      jackInTerminal.show();
    }
    pty.onDidClose((e) => {
      calvaJackout();
    });
  } catch (exception) {
    console.error('Failed executing task: ', exception.message);
  }
}

export function calvaJackout() {
  if (jackInPTY !== undefined) {
    if (projectTypes.isWin) {
      // this is a hack under Windows to terminate the
      // repl process from the repl client because the
      // ShellExecution under Windows will not terminate
      // all child processes.
      //
      // the clojure code to terminate the repl process
      // was taken from this comment on github:
      //
      // https://github.com/clojure-emacs/cider/issues/390#issuecomment-317791387
      //
      if (nClient && nClient.session) {
        nClient.session.eval(
          '(do (.start (Thread. (fn [] (Thread/sleep 5000) (shutdown-agents) (System/exit 0)))) nil)',
          'user'
        );
      }
    }
    connector.default.disconnect();
    jackInPTY.killProcess();
    jackInPTY = undefined;
    utilities.setLaunchingState(null);
    utilities.setJackedInState(false);
    statusbar.update();
  }

  liveShareSupport.didJackOut();
}

export async function copyJackInCommandToClipboard(): Promise<void> {
  try {
    await state.initProjectDir(ConnectType.JackIn, undefined);
  } catch (e) {
    console.error('An error occurred while initializing project directory.', e);
    return;
  }

  let projectConnectSequence: ReplConnectSequence;
  try {
    projectConnectSequence = await getProjectConnectSequence(false);
  } catch (e) {
    return;
  }
  if (projectConnectSequence) {
    try {
      const options = await getJackInTerminalOptions(projectConnectSequence);
      if (options) {
        void vscode.env.clipboard.writeText(createCommandLine(options));
        void vscode.window.showInformationMessage('Jack-in command line copied to the clipboard.');
      }
    } catch (e) {
      void vscode.window.showErrorMessage(`Error creating Jack-in command line: ${e}`, 'OK');
    }
  } else {
    void vscode.window.showInformationMessage('No supported project types detected.');
  }
}

type Substitutions = {
  [key: string]: string | string[];
};

function substituteCustomCommandLinePlaceholders(
  commandLineTemplate: string,
  substitutions: Substitutions
) {
  return Object.keys(substitutions).reduce((acc: string, k: string) => {
    const placeholder = `JACK-IN-${k}`;
    const value: string = Array.isArray(substitutions[k])
      ? (substitutions[k] as string[]).join(',')
      : (substitutions[k] as string);
    return acc.replace(new RegExp(placeholder, 'g'), value);
  }, commandLineTemplate);
}

async function getJackInTerminalOptions(
  projectConnectSequence: ReplConnectSequence
): Promise<JackInTerminalOptions> {
  const projectTypeName: string = projectConnectSequence.projectType;
  let selectedCljsType: CljsTypes;

  if (
    typeof projectConnectSequence.cljsType == 'string' &&
    projectConnectSequence.cljsType != CljsTypes.none
  ) {
    selectedCljsType = projectConnectSequence.cljsType;
  } else if (
    projectConnectSequence.cljsType &&
    typeof projectConnectSequence.cljsType == 'object'
  ) {
    selectedCljsType = projectConnectSequence.cljsType.dependsOn;
  }

  const projectType = projectTypes.getProjectTypeForName(projectTypeName);

  if (!projectType?.commandLine) {
    throw new Error(`Project type ${projectTypeName} does not support Jack-in.`);
  }

  const commandLineInfo = await projectType.commandLine(projectConnectSequence, selectedCljsType);

  let args: string[] = commandLineInfo.args;
  let cmd: string[];
  if (projectTypes.isWin) {
    cmd = projectType.winCmd;
    if (projectType.resolveBundledPathWin) {
      const jarSourceUri = vscode.Uri.file(
        path.join(state.extensionContext.extensionPath, 'deps.clj.jar')
      );
      const jarDestUri = vscode.Uri.file(
        path.join(state.getProjectRootLocal(), '.calva', 'deps.clj.jar')
      );
      try {
        await vscode.workspace.fs.copy(jarSourceUri, jarDestUri, {
          overwrite: false,
        });
      } catch {
        // continue regardless of error
      }
      cmd = [...cmd, projectType.resolveBundledPathWin()];
    }
  } else {
    cmd = typeof projectType.cmd === 'function' ? projectType.cmd() : projectType.cmd;
    if (projectType.resolveBundledPathUnix) {
      cmd = [...cmd, projectType.resolveBundledPathUnix()];
    }
  }
  const nReplPortFile = projectConnectSequence.nReplPortFile ?? projectType.nReplPortFile;
  const substitutions = {
    'PROJECT-ROOT-PATH': state.getProjectRootLocal(),
    ...(nReplPortFile
      ? { 'NREPL-PORT-FILE': nReplPortFile.join(projectTypes.isWin ? '\\' : '/') }
      : {}),
    ...commandLineInfo.substitutions,
  };
  const executable: string = projectConnectSequence.customJackInCommandLine
    ? substituteCustomCommandLinePlaceholders(
        projectConnectSequence.customJackInCommandLine,
        substitutions
      )
    : cmd[0];
  args = projectConnectSequence.customJackInCommandLine ? [] : [...cmd.slice(1), ...args];

  const terminalOptions: JackInTerminalOptions = {
    name: `Calva Jack-in: ${projectConnectSequence.name}`,
    executable,
    args,
    env: {
      ...getGlobalJackInEnv(),
      ...processEnvObject(projectConnectSequence.jackInEnv),
      ...Object.entries(substitutions).reduce((acc, [key, value]) => {
        return { ...acc, [`JACK_IN_${key.replace(/-/g, '_')}`]: value };
      }, {}),
    },
    isWin: projectTypes.isWin,
    cwd: state.getProjectRootLocal(),
    useShell: projectTypes.isWin ? projectType.processShellWin : projectType.processShellUnix,
  };
  return terminalOptions;
}

async function getProjectConnectSequence(disableAutoSelect: boolean): Promise<ReplConnectSequence> {
  const cljTypes: string[] = await projectTypes.detectProjectTypes();
  const excludes = ['generic', 'cljs-only'];
  if (joyride.isJoyrideExtensionActive() && joyride.isJoyrideNReplServerRunning()) {
    excludes.push('joyride');
  }
  if (cljTypes.length > 1) {
    return askForConnectSequence(
      cljTypes.filter((t) => !excludes.includes(t)),
      ConnectType.JackIn,
      disableAutoSelect
    );
  }
}

export async function jackIn(
  connectSequence: ReplConnectSequence,
  disableAutoSelect: boolean,
  cb?: () => unknown
) {
  void state.analytics().logGA4Pageview('/connect-initiated');
  void state.analytics().logGA4Pageview('/connect-initiated/jack-in');

  try {
    await liveShareSupport.setupLiveShareListener();
  } catch (e) {
    console.error('An error occurred while setting up Live Share listener.', e);
  }
  if (state.getProjectRootUri().scheme === 'vsls') {
    outputWindow.appendLine("; Aborting Jack-in, since you're the guest of a live share session.");
    outputWindow.appendLine(
      '; Please use this command instead: Connect to a running REPL server in the project.'
    );
    return;
  }
  state.analytics().logEvent('REPL', 'JackInInitiated').send();
  await outputWindow.initResultsDoc();
  outputWindow.appendLine('; Jacking in...');
  await outputWindow.openResultsDoc();

  let projectConnectSequence: ReplConnectSequence = connectSequence;
  if (!projectConnectSequence) {
    try {
      projectConnectSequence = await getProjectConnectSequence(disableAutoSelect);
    } catch (e) {
      outputWindow.appendLine(`; ${e}\n; Aborting jack-in.`);
      // TODO: Figure out why this is not shown to the user.
      void vscode.window.showErrorMessage(e, 'OK');
      return;
    }
    if (!projectConnectSequence) {
      outputWindow.appendLine('; Aborting jack-in. No project type selected.');
      return;
    }
  }
  if (projectConnectSequence) {
    const projectType = projectTypes.getProjectTypeForName(projectConnectSequence.projectType);
    if (projectType.startFunction) {
      void projectType.startFunction();
    } else {
      try {
        const terminalJackInOptions = await getJackInTerminalOptions(projectConnectSequence);
        if (terminalJackInOptions) {
          executeJackInTask(terminalJackInOptions, projectConnectSequence, cb);
        }
      } catch (e) {
        void vscode.window.showErrorMessage(`Error creating jack-in command line: ${e}`, 'OK');
      }
    }
  } else {
    void vscode.window.showInformationMessage(
      'No supported project types detected. Maybe try starting your project manually and use the Connect command?'
    );
    return;
  }

  void liveShareSupport.didJackIn();
}

export function jackOutCommand() {
  calvaJackout();
}

export async function jackInCommand(options: {
  connectSequence?: ReplConnectSequence | string;
  disableAutoSelect?: boolean;
}) {
  let connectSequence: ReplConnectSequence;
  if (options && typeof options.connectSequence === 'string') {
    connectSequence = getConnectSequences(projectTypes.getAllProjectTypes()).find(
      (s) => s.name === options.connectSequence
    );
  } else if (options && options.connectSequence) {
    connectSequence = options.connectSequence as ReplConnectSequence;
  }
  try {
    await state.initProjectDir(ConnectType.JackIn, connectSequence, options?.disableAutoSelect);
  } catch (e) {
    console.error('An error occurred while initializing project directory.', e);
    return;
  }
  await jackIn(connectSequence, options?.disableAutoSelect);
}

export function calvaDisconnect() {
  if (utilities.getConnectedState()) {
    connector.default.disconnect();
    return;
  } else if (utilities.getConnectingState() || utilities.getLaunchingState()) {
    void vscode.window
      .showInformationMessage(
        'Do you want to interrupt the connection process?',
        { modal: true },
        ...['Ok']
      )
      .then((value) => {
        if (value == 'Ok') {
          calvaJackout();
          connector.default.disconnect();
          utilities.setLaunchingState(null);
          utilities.setConnectingState(false);
          statusbar.update();
          outputWindow.appendLine('; Interrupting Jack-in process.');
        }
      });
    return;
  }
  void vscode.window.showInformationMessage('Not connected to a REPL server');
}
