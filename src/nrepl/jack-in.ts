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
import * as outputWindow from '../repl-window/repl-doc';
import {
  JackInPTY as JackInPTY,
  JackInPTYOptions as JackInPTYOptions,
  createCommandLine,
} from './jack-in-terminal';
import * as liveShareSupport from '../live-share';
import { getConfig } from '../config';
import * as joyride from '../joyride';
import { ConnectType } from './connect-types';
import * as output from '../results-output/output';
import * as inspector from '../providers/inspector';

function resolveEnvVariables(entry: any): any {
  if (typeof entry === 'string') {
    const s = entry.replace(/\$\{env:(\w+)\}/g, (_, v) => (process.env[v] ? process.env[v] : ''));
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

let jackInPTY: JackInPTY = undefined;
let jackInTerminal: vscode.Terminal = undefined;

async function executeJackInTask(
  terminalOptions: JackInPTYOptions,
  connectSequence: ReplConnectSequence,
  cb?: () => unknown
) {
  utilities.setLaunchingState(connectSequence.name);
  statusbar.update();

  if (!jackInPTY) {
    jackInPTY = new JackInPTY();
    jackInTerminal = (<any>vscode.window).createTerminal({
      name: `Calva Jack-in: ${connectSequence.name}`,
      pty: jackInPTY,
    });
    jackInPTY.onDidClose((e) => {
      calvaJackout();
    });
  } else {
    jackInPTY.clearTerminal();
  }

  if (getConfig().autoOpenJackInTerminal) {
    jackInTerminal.show();
  }

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Jacking in: ${connectSequence.name}...`,
      cancellable: true,
    },
    (progress, token) => {
      return new Promise<void>((resolve, reject) => {
        try {
          token.onCancellationRequested(() => {
            calvaJackout();
            reject(new Error('Jack-in was cancelled by the user.'));
          });
          void jackInPTY.startClojureProgram(
            terminalOptions,
            (_p, hostname: string, port: string) => {
              utilities.setLaunchingState(null);
              resolve();
              void connector.connect(connectSequence, true, hostname, port).then(() => {
                utilities.setJackedInState(true);
                statusbar.update();
                output.appendLineOtherOut('Jack-in done.');
                output.replWindowAppendPrompt();
                if (cb) {
                  cb();
                }
              });
            },
            (status: number) => {
              setJackedOutStatus();
              void vscode.window
                .showErrorMessage(
                  `Jack-in was interrupted. Exit code: ${status}`,
                  'Show Jack-in Terminal'
                )
                .then((item) => {
                  if (item) {
                    void vscode.commands.executeCommand('calva.revealJackInTerminal');
                  }
                });
              resolve();
            }
          );
        } catch (exception) {
          console.error('Failed executing task: ', exception.message);
          reject(exception);
        }
      });
    }
  );
}

function setJackedOutStatus() {
  utilities.setLaunchingState(null);
  utilities.setJackedInState(false);
  statusbar.update();
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
    setJackedOutStatus();
  }

  liveShareSupport.didJackOut();
}

export function revealJackInTerminal() {
  if (jackInTerminal) {
    jackInTerminal.show();
  }
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
        const message = `Jack-in command line copied to the clipboard.${
          projectTypes.isWin ? ' It is tailored for cmd.exe and may not work in other shells.' : ''
        }`;
        if (projectTypes.isWin) {
          void vscode.window.showInformationMessage(message, 'OK');
        } else {
          void vscode.window.showInformationMessage(message);
        }
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
): Promise<JackInPTYOptions> {
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
    cmd = typeof projectType.winCmd === 'function' ? projectType.winCmd() : projectType.winCmd;
  } else {
    cmd = typeof projectType.cmd === 'function' ? projectType.cmd() : projectType.cmd;
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

  const terminalOptions: JackInPTYOptions = {
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

async function executeJackIn(
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
    output.appendLineOtherErr("Aborting Jack-in, since you're the guest of a live share session.");
    output.appendLineOtherOut(
      'Please use this command instead: Connect to a running REPL server in the project.'
    );
    return;
  }
  inspector.revealOnConnect();
  await outputWindow.initResultsDoc();
  output.appendLineOtherOut('Jacking in...');
  await outputWindow.openResultsDoc();

  let projectConnectSequence: ReplConnectSequence = connectSequence;
  if (!projectConnectSequence) {
    try {
      projectConnectSequence = await getProjectConnectSequence(disableAutoSelect);
    } catch (e) {
      output.appendLineOtherErr(`${e}\nAborting jack-in.`);
      // TODO: Figure out why this is not shown to the user.
      void vscode.window.showErrorMessage(e, 'OK');
      return;
    }
    if (!projectConnectSequence) {
      output.appendLineOtherErr('Aborting jack-in. No project type selected.');
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
          void executeJackInTask(terminalJackInOptions, projectConnectSequence, cb);
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

export async function jackIn(
  connectSequence: ReplConnectSequence,
  disableAutoSelect: boolean,
  cb?: () => unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (jackInPTY && !jackInPTY.isProcessAlive()) {
      resolve(executeJackIn(connectSequence, disableAutoSelect, cb));
    } else {
      calvaJackout();
      setTimeout(() => {
        resolve(executeJackIn(connectSequence, disableAutoSelect, cb));
      }, 1000);
    }
  });
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
          output.appendLineOtherOut('Interrupting Jack-in process.');
        }
      });
    return;
  }
  void vscode.window.showInformationMessage('Not connected to a REPL server');
}
