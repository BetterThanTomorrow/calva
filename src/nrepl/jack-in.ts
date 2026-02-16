import * as vscode from 'vscode';
import * as utilities from '../utilities';
import * as _ from 'lodash';
import * as state from '../state';
import * as connector from '../connector';
import statusbar from '../statusbar';
import {
  askForConnectSequence,
  ReplConnectSequence,
  CljsTypes,
  getConnectSequences,
} from './connectSequence';
import * as projectTypes from './project-types';
import * as outputWindow from '../repl-window/repl-window-doc';
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
import * as clientRegistry from './client-registry';
import type { RegisteredClient } from './client-registry';

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

type JackInProcessEntry = {
  id: number;
  pty: JackInPTY;
  terminal: vscode.Terminal;
  connectSequence: ReplConnectSequence;
  disposables: vscode.Disposable[];
  connected: boolean;
  clientKey?: string;
  projectRootUri?: string;
  connectSequenceName?: string;
};

const activeJackInProcesses = new Map<number, JackInProcessEntry>();
let nextJackInProcessId = 1;

export function listJackInProcesses(): JackInProcessEntry[] {
  return Array.from(activeJackInProcesses.values()).sort((a, b) => a.id - b.id);
}

function getProjectRootUriString(): string | undefined {
  return state.getProjectRootUri()?.toString();
}

function matchesProjectRoot(entry: JackInProcessEntry, targetRootUri: string | undefined): boolean {
  if (!targetRootUri || !entry.projectRootUri) {
    return true;
  }

  return entry.projectRootUri === targetRootUri;
}

function matchesConnectSequence(
  entry: JackInProcessEntry,
  connectSequence: ReplConnectSequence,
  targetRootUri: string | undefined
): boolean {
  if (!connectSequence) {
    return false;
  }

  if (entry.connectSequence.name !== connectSequence.name) {
    return false;
  }

  if (entry.connectSequence.projectType !== connectSequence.projectType) {
    return false;
  }

  return matchesProjectRoot(entry, targetRootUri);
}

/**
 * Find jack-in processes that would be replaced by a new jack-in.
 * Matches by both sequence name AND current project root.
 */
function findProcessesForReconnection(connectSequence: ReplConnectSequence): JackInProcessEntry[] {
  const targetRootUri = getProjectRootUriString();
  return listJackInProcesses().filter((entry) =>
    matchesConnectSequence(entry, connectSequence, targetRootUri)
  );
}

async function stopJackInProcess(
  entry: JackInProcessEntry,
  options: { preserveSuffix?: boolean; force?: boolean } = {}
): Promise<void> {
  requestWindowsJackOut(entry);

  if (entry.clientKey) {
    try {
      await connector.default.disconnect({
        clientKey: entry.clientKey,
        preserveSuffix: options.preserveSuffix,
      });
    } catch (err) {
      console.warn('Failed disconnecting jack-in client cleanly', err);
    }
  }

  try {
    entry.pty.killProcess(options.force);
  } catch (err) {
    console.warn('Failed killing Jack-in process', err);
  } finally {
    try {
      entry.terminal.dispose();
    } catch (err) {
      console.warn('Failed disposing Jack-in terminal', err);
    }
    handleJackInProcessExit(entry.id);
  }
}

async function stopJackInProcesses(
  entries: JackInProcessEntry[],
  options: { preserveSuffix?: boolean; force?: boolean } = {}
): Promise<void> {
  for (const entry of entries) {
    await stopJackInProcess(entry, options);
  }
}

/**
 * Stop jack-in processes owned by a specific client.
 * Used when reconnection is detected to clean up processes from the old connection.
 *
 * @param clientKey - The client key to stop processes for
 * @param options.preserveSuffix - If true, preserve the client's suffix during disconnect
 */
export async function stopJackInProcessesByClientKey(
  clientKey: string,
  options: { preserveSuffix?: boolean } = {}
): Promise<void> {
  const matching = listJackInProcesses().filter((entry) => entry.clientKey === clientKey);
  if (matching.length === 0) {
    return;
  }
  await stopJackInProcesses(matching, options);
}

/**
 * Stop jack-in processes that would be replaced by a new jack-in.
 * Only affects processes matching both sequence name AND current project root.
 */
async function stopProcessesForReconnection(connectSequence: ReplConnectSequence): Promise<void> {
  const matching = findProcessesForReconnection(connectSequence);
  if (matching.length === 0) {
    return;
  }

  await stopJackInProcesses(matching);
}

/**
 * Find clients that would be replaced by a new connection.
 * Matches by both sequence name AND current project root.
 * Clients with the same sequence but different project roots are left alone
 * (name conflicts are handled via suffixes in connector.connectToHost()).
 */
function findClientsForReconnection(connectSequence: ReplConnectSequence): RegisteredClient[] {
  const targetRootUri = getProjectRootUriString();

  return clientRegistry.listClients().filter((client) => {
    if (client.connectSequenceName !== connectSequence.name) {
      return false;
    }
    if (!targetRootUri) {
      return true;
    }
    if (!client.projectRoot) {
      return false;
    }
    return client.projectRoot === targetRootUri;
  });
}

/**
 * Disconnect clients that would be replaced by a new connection.
 * Only affects clients matching both sequence name AND current project root.
 */
async function stopClientsForReconnection(connectSequence: ReplConnectSequence): Promise<void> {
  const clients = findClientsForReconnection(connectSequence);
  for (const client of clients) {
    await connector.default.disconnect({ clientKey: client.key });
  }
}

function refreshJackedInState() {
  const hasConnectedProcess = Array.from(activeJackInProcesses.values()).some(
    (entry) => entry.connected
  );
  utilities.setJackedInState(hasConnectedProcess);
  statusbar.update();
}

function registerJackInProcess(connectSequence: ReplConnectSequence): JackInProcessEntry {
  const pty = new JackInPTY();
  const terminal = (<any>vscode.window).createTerminal({
    name: `Calva Jack-in: ${connectSequence.name}`,
    pty,
  });
  const selectedSequenceName =
    state.extensionContext.workspaceState.get<ReplConnectSequence>('selectedConnectSequence')?.name;
  const entry: JackInProcessEntry = {
    id: nextJackInProcessId++,
    pty,
    terminal,
    connectSequence,
    disposables: [],
    connected: false,
    projectRootUri: getProjectRootUriString(),
    connectSequenceName: selectedSequenceName ?? connectSequence.name,
  };
  let cleanedUp = false;
  const handleExit = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    handleJackInProcessExit(entry.id);
  };
  entry.disposables.push(pty.onDidClose(handleExit));
  entry.disposables.push(pty.onDidExit(handleExit));
  activeJackInProcesses.set(entry.id, entry);
  return entry;
}

function handleJackInProcessExit(processId: number) {
  const entry = activeJackInProcesses.get(processId);
  if (!entry) {
    return;
  }
  activeJackInProcesses.delete(processId);
  entry.disposables.forEach((d) => d.dispose());
  refreshJackedInState();
  liveShareSupport.didJackOut();
}

async function executeJackInTask(
  terminalOptions: JackInPTYOptions,
  connectSequence: ReplConnectSequence,
  cb?: () => unknown
) {
  utilities.setLaunchingState(connectSequence.name);
  statusbar.update();
  const jackInProcess = registerJackInProcess(connectSequence);

  if (getConfig().autoOpenJackInTerminal) {
    jackInProcess.terminal.show();
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
            jackInProcess.pty.killProcess();
            reject(new Error('Jack-in was cancelled by the user.'));
          });
          void jackInProcess.pty.startClojureProgram(
            terminalOptions,
            (_p, hostname: string, port: string) => {
              utilities.setLaunchingState(null);
              resolve();
              void connector.connect(connectSequence, true, hostname, port, true).then((result) => {
                const entry = activeJackInProcesses.get(jackInProcess.id);
                if (entry) {
                  entry.connected = result.connected;
                  entry.clientKey = result.clientKey;
                }
                refreshJackedInState();
                output.appendLineOtherOut('Jack-in done.');
                void output.replWindowAppendPrompt();
                if (cb) {
                  cb();
                }
              });
            },
            (status: number) => {
              utilities.setLaunchingState(null);
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

function requestWindowsJackOut(entry: JackInProcessEntry) {
  if (!projectTypes.isWin || !entry.clientKey) {
    return;
  }
  const client = clientRegistry.getClient(entry.clientKey);
  if (!client?.session) {
    return;
  }
  client.session.eval(
    '(do (.start (Thread. (fn [] (Thread/sleep 5000) (shutdown-agents) (System/exit 0)))) nil)',
    'user'
  );
}

/**
 * Stop all jack-in processes.
 * @param options.force - If true, kill processes immediately without waiting for graceful shutdown.
 *                        Use force=true during VS Code deactivation.
 */
export async function calvaJackout(options: { force?: boolean } = {}) {
  const processes = listJackInProcesses();
  if (processes.length === 0) {
    return;
  }

  await stopJackInProcesses(processes, { force: options.force });
}

export function revealJackInTerminal() {
  const processes = listJackInProcesses();
  const latest = processes[processes.length - 1];
  if (latest) {
    latest.terminal.show();
  }
}

export async function copyJackInCommandToClipboard(options?: {
  connectSequence?: ReplConnectSequence | string;
  disableAutoSelect?: boolean;
}): Promise<void> {
  let providedSequence: ReplConnectSequence | undefined;

  if (options && typeof options.connectSequence === 'string') {
    providedSequence = getConnectSequences(projectTypes.getAllProjectTypes()).find(
      (s) => s.name === options.connectSequence
    );
  } else if (options?.connectSequence) {
    providedSequence = options.connectSequence as ReplConnectSequence;
  }

  try {
    await state.initProjectDir(
      ConnectType.JackIn,
      providedSequence,
      options?.disableAutoSelect ?? false
    );
  } catch (e) {
    console.error('An error occurred while initializing project directory.', e);
    return;
  }

  let projectConnectSequence: ReplConnectSequence;
  try {
    projectConnectSequence =
      providedSequence ?? (await getProjectConnectSequence(options?.disableAutoSelect ?? false));
  } catch (e) {
    return;
  }
  if (projectConnectSequence) {
    try {
      const options = await getJackInTerminalOptions(projectConnectSequence);
      if (options) {
        await vscode.env.clipboard.writeText(createCommandLine(options));
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

  // Allow jack-in if either the project type has commandLine, or the sequence has customJackInCommandLine
  if (!projectType?.commandLine && !projectConnectSequence.customJackInCommandLine) {
    throw new Error(`Project type ${projectTypeName} does not support Jack-in.`);
  }

  const commandLineInfo = projectType?.commandLine
    ? await projectType.commandLine(projectConnectSequence, selectedCljsType)
    : { args: [], substitutions: {} };

  let args: string[] = commandLineInfo.args;
  let cmd: string[];
  if (projectTypes.isWin) {
    cmd = typeof projectType.winCmd === 'function' ? projectType.winCmd() : projectType.winCmd;
  } else {
    cmd = typeof projectType.cmd === 'function' ? projectType.cmd() : projectType.cmd;
  }
  const nReplPortFile = projectConnectSequence.nReplPortFile ?? projectType.defaultNReplPortFile;
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
  if (cljTypes.length >= 1) {
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
  await outputWindow.initReplWindowDoc();
  output.appendLineOtherOut('Jacking in...');
  await outputWindow.openReplWindowDoc();

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
    await stopProcessesForReconnection(projectConnectSequence);
    await stopClientsForReconnection(projectConnectSequence);

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

export function jackIn(
  connectSequence: ReplConnectSequence,
  disableAutoSelect: boolean,
  cb?: () => unknown
): Promise<unknown> {
  return executeJackIn(connectSequence, disableAutoSelect, cb);
}

export function jackOutCommand() {
  return calvaJackout();
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
    void connector.default.disconnect();
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
          void calvaJackout();
          void connector.default.disconnect();
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
