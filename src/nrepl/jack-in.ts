import * as vscode from 'vscode';
import * as utilities from '../utilities';
import * as _ from 'lodash';
import * as state from '../state';
import * as connector from '../connector';
import * as statusbar from '../statusbar';
import * as connectSequences from './connectSequence';
import * as connectSequenceInheritance from './connect-sequence-inheritance';
import * as projectTypes from './project-types';
import * as outputWindow from '../repl-window/repl-window-doc';
import * as jackInTerminal from './jack-in-terminal';
import * as jackInFreePorts from './jack-in-free-ports';
import * as liveShareSupport from '../live-share';
import * as config from '../config';
import * as joyride from '../joyride';
import * as connectTypes from './connect-types';
import * as output from '../results-output/output';
import * as inspector from '../providers/inspector';
import * as clientRegistry from './client-registry';
import * as nReplWsServer from './nrepl-ws-server';
import { parseDisconnectCommandOptions, planDisconnectCommand } from './disconnect-command';

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
    ...processEnvObject(config.getConfig().jackInEnv as object),
  };
}

type JackInProcessEntry = {
  id: number;
  pty: jackInTerminal.JackInPTY;
  terminal: vscode.Terminal;
  connectSequence: connectSequences.ReplConnectSequence;
  disposables: vscode.Disposable[];
  connected: boolean;
  clientKey?: string;
  projectRootUri: string;
};

type PortInUse = {
  port: number;
  jackInProcess: JackInProcessEntry;
};

type PortInUseHandling = PortInUse & {
  jackInAgain: () => Promise<void>;
};

type PortHolderOwner = {
  holder: jackInFreePorts.PortHolder;
  jackInProcess?: JackInProcessEntry;
};

const STOP_AND_JACK_IN_AGAIN = 'Stop and Jack-in Again';

const activeJackInProcesses = new Map<number, JackInProcessEntry>();
let nextJackInProcessId = 1;

export function listJackInProcesses(): JackInProcessEntry[] {
  return Array.from(activeJackInProcesses.values()).sort((a, b) => a.id - b.id);
}

function matchesProjectRoot(entry: JackInProcessEntry, targetRootUri: string | undefined): boolean {
  if (!targetRootUri || !entry.projectRootUri) {
    return true;
  }

  return entry.projectRootUri === targetRootUri;
}

function matchesConnectSequence(
  entry: JackInProcessEntry,
  connectSequence: connectSequences.ReplConnectSequence,
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
function findProcessesForReconnection(
  connectSequence: connectSequences.ReplConnectSequence,
  targetRootUri: string | undefined
): JackInProcessEntry[] {
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
      await connector.disconnect({
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
async function stopProcessesForReconnection(
  connectSequence: connectSequences.ReplConnectSequence,
  targetRootUri: string | undefined
): Promise<void> {
  const matching = findProcessesForReconnection(connectSequence, targetRootUri);
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
function findClientsForReconnection(
  connectSequence: connectSequences.ReplConnectSequence,
  targetRootUri: string | undefined
): clientRegistry.RegisteredClient[] {
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
async function stopClientsForReconnection(
  connectSequence: connectSequences.ReplConnectSequence,
  targetRootUri: string | undefined
): Promise<void> {
  const clients = findClientsForReconnection(connectSequence, targetRootUri);
  for (const client of clients) {
    await connector.disconnect({ clientKey: client.key });
  }
}

function refreshJackedInState() {
  const hasConnectedProcess = Array.from(activeJackInProcesses.values()).some(
    (entry) => entry.connected
  );
  utilities.setJackedInState(hasConnectedProcess);
  statusbar.update();
}

function registerJackInProcess(
  connectSequence: connectSequences.ReplConnectSequence,
  projectRootUri: vscode.Uri
): JackInProcessEntry {
  const pty = new jackInTerminal.JackInPTY();
  const terminal = (<any>vscode.window).createTerminal({
    name: `Calva Jack-in: ${connectSequence.name}`,
    pty,
  });
  const entry: JackInProcessEntry = {
    id: nextJackInProcessId++,
    pty,
    terminal,
    connectSequence,
    disposables: [],
    connected: false,
    projectRootUri: projectRootUri.toString(),
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
  terminalOptions: jackInTerminal.JackInPTYOptions,
  connectSequence: connectSequences.ReplConnectSequence,
  projectRootUri: vscode.Uri,
  onPortInUse: (portInUse: PortInUse) => void,
  cb?: () => unknown
) {
  utilities.setLaunchingState(connectSequence.name);
  statusbar.update();
  const jackInProcess = registerJackInProcess(connectSequence, projectRootUri);

  if (config.getConfig().autoOpenJackInTerminal) {
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
              statusbar.update();
              resolve();
              void connector
                .connect(connectSequence, true, projectRootUri, { hostname, port, isJackIn: true })
                .then((result) => {
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
                })
                .catch((e) => {
                  console.error('Jack-in connect failed:', e);
                  output.appendLineOtherErr(`Jack-in connect failed: ${e}`);
                });
            },
            (status: number) => {
              utilities.setLaunchingState(null);
              statusbar.update();
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
            },
            (port: number) => onPortInUse({ port, jackInProcess })
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

/**
 * Returns the connect sequence a command argument names, by name or as the sequence itself.
 */
function sequenceFromArg(
  connectSequence: connectSequences.ReplConnectSequence | string | undefined
): connectSequences.ReplConnectSequence | undefined {
  return typeof connectSequence === 'string'
    ? connectSequences
        .getConnectSequences(projectTypes.getAllProjectTypes())
        .find((s) => s.name === connectSequence)
    : connectSequence;
}

function logRootDecisionError(e: unknown): undefined {
  console.error('An error occurred while initializing project directory.', e);
  return undefined;
}

export async function copyJackInCommandToClipboard(options?: {
  connectSequence?: connectSequences.ReplConnectSequence | string;
  disableAutoSelect?: boolean;
}): Promise<void> {
  const providedSequence = sequenceFromArg(options?.connectSequence);
  const decided = await state
    .decideFlowRoot(
      connectTypes.ConnectType.JackIn,
      providedSequence,
      options?.disableAutoSelect ?? false
    )
    .catch(logRootDecisionError);
  if (!decided) {
    return;
  }
  const projectRootUri = decided.root;

  let projectConnectSequence: connectSequences.ReplConnectSequence;
  try {
    projectConnectSequence =
      providedSequence ?? (await getProjectConnectSequence(decided.sequence, projectRootUri));
  } catch (e) {
    return;
  }
  if (projectConnectSequence) {
    try {
      const terminalOptions = await getJackInTerminalOptions(
        projectConnectSequence,
        connectSequences.rootForSequence(projectConnectSequence, projectRootUri)
      );
      if (terminalOptions) {
        await vscode.env.clipboard.writeText(jackInTerminal.createCommandLine(terminalOptions));
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
      ? substitutions[k].join(',')
      : substitutions[k];
    return acc.replace(new RegExp(placeholder, 'g'), value);
  }, commandLineTemplate);
}

async function getJackInTerminalOptions(
  projectConnectSequence: connectSequences.ReplConnectSequence,
  projectRootUri: vscode.Uri
): Promise<jackInTerminal.JackInPTYOptions> {
  const projectTypeName: string = projectConnectSequence.projectType;
  let selectedCljsType: connectSequences.CljsTypes;

  if (
    typeof projectConnectSequence.cljsType == 'string' &&
    projectConnectSequence.cljsType != connectSequences.CljsTypes.none
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
    ? await projectType.commandLine(projectConnectSequence, selectedCljsType, projectRootUri)
    : { args: [], substitutions: {} };

  let args: string[] = commandLineInfo.args;
  let cmd: string[];
  if (projectTypes.isWin) {
    cmd = typeof projectType.winCmd === 'function' ? projectType.winCmd() : projectType.winCmd;
  } else {
    cmd = typeof projectType.cmd === 'function' ? projectType.cmd() : projectType.cmd;
  }
  const nReplPortFile = connectSequenceInheritance.effectiveNReplPortFileSegments(
    projectConnectSequence,
    projectType
  );
  const substitutions = {
    'PROJECT-ROOT-PATH': projectRootUri.fsPath,
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

  const terminalOptions: jackInTerminal.JackInPTYOptions = {
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
    cwd: projectRootUri.fsPath,
    useShell: projectTypes.isWin ? projectType.processShellWin : projectType.processShellUnix,
  };
  return terminalOptions;
}

async function getProjectConnectSequence(
  autoSelected: connectSequences.ReplConnectSequence | undefined,
  projectRootUri: vscode.Uri
): Promise<connectSequences.ReplConnectSequence> {
  const cljTypes: string[] = await projectTypes.detectProjectTypes(projectRootUri);
  const excludes = ['generic', 'cljs-only'];
  if (joyride.isJoyrideExtensionActive() && joyride.isJoyrideNReplServerRunning()) {
    excludes.push('joyride');
  }
  if (cljTypes.length >= 1) {
    return connectSequences.askForConnectSequence(
      cljTypes.filter((t) => !excludes.includes(t)),
      connectTypes.ConnectType.JackIn,
      autoSelected,
      projectRootUri
    );
  }
}

async function portHolderOwners(holders: jackInFreePorts.PortHolder[]): Promise<PortHolderOwner[]> {
  const parents = await jackInFreePorts.processParents();
  const jackInTrees = listJackInProcesses()
    .filter((entry) => entry.pty.processId() !== undefined)
    .map((entry) => ({
      entry,
      pids: jackInFreePorts.descendantPids({ parents, rootPid: entry.pty.processId() }),
    }));
  return holders.map((holder) => ({
    holder,
    jackInProcess: jackInTrees.find((tree) => tree.pids.has(holder.pid))?.entry,
  }));
}

function describePortHolderOwner({ holder, jackInProcess }: PortHolderOwner): string {
  return jackInProcess
    ? `the Jack-in REPL "${jackInProcess.connectSequence.name}" (PID ${holder.pid})`
    : `PID ${holder.pid} (${holder.description})`;
}

function showPortInUse(message: string, ...actions: string[]): Thenable<string | undefined> {
  output.appendLineOtherErr(message);
  return vscode.window.showErrorMessage(message, ...actions);
}

async function stopPortHolderOwners(port: number, owners: PortHolderOwner[]): Promise<void> {
  const jackInProcesses = [
    ...new Set(owners.map((owner) => owner.jackInProcess).filter((entry) => entry)),
  ];
  await stopJackInProcesses(jackInProcesses);
  await jackInFreePorts.freePort(port, (message) => output.appendLineOtherOut(message));
}

async function handlePortInUse({
  port,
  jackInProcess,
  jackInAgain,
}: PortInUseHandling): Promise<void> {
  const notBound = `The project could not bind port ${port} because it is already in use`;
  const holders = await jackInFreePorts.portHolders(port);
  if (holders.length === 0) {
    void showPortInUse(`${notBound}. Calva could not find which process holds it.`);
    return;
  }
  const owners = await portHolderOwners(holders);
  if (owners.some((owner) => owner.jackInProcess === jackInProcess)) {
    void showPortInUse(`${notBound} by this Jack-in REPL itself.`);
    return;
  }
  const choice = await showPortInUse(
    `${notBound} by ${owners.map(describePortHolderOwner).join(', ')}.`,
    STOP_AND_JACK_IN_AGAIN
  );
  if (choice !== STOP_AND_JACK_IN_AGAIN) {
    return;
  }
  await stopPortHolderOwners(port, owners);
  await jackInAgain();
}

async function executeJackIn(
  connectSequence: connectSequences.ReplConnectSequence,
  autoSelected: connectSequences.ReplConnectSequence | undefined,
  projectRootUri: vscode.Uri,
  cb?: () => unknown
) {
  void state.analytics().logGA4Pageview('/connect-initiated');
  void state.analytics().logGA4Pageview('/connect-initiated/jack-in');

  try {
    await liveShareSupport.setupLiveShareListener();
  } catch (e) {
    console.error('An error occurred while setting up Live Share listener.', e);
  }
  if (liveShareSupport.isLiveShareGuest()) {
    output.appendLineOtherErr("Aborting Jack-in, since you're the guest of a live share session.");
    output.appendLineOtherOut(
      'Please use this command instead: Connect to a running REPL server in the project.'
    );
    return;
  }
  inspector.revealOnConnect();
  await outputWindow.initReplWindowDoc(projectRootUri);
  output.appendLineOtherOut('Jacking in...');
  await outputWindow.openReplWindowDoc();

  let projectConnectSequence: connectSequences.ReplConnectSequence = connectSequence;
  if (!projectConnectSequence) {
    try {
      projectConnectSequence = await getProjectConnectSequence(autoSelected, projectRootUri);
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
    const rootUri = connectSequences.rootForSequence(projectConnectSequence, projectRootUri);
    await stopProcessesForReconnection(projectConnectSequence, rootUri.toString());
    await stopClientsForReconnection(projectConnectSequence, rootUri.toString());

    if (projectType.startFunction) {
      void projectType.startFunction(rootUri);
    } else {
      try {
        const terminalJackInOptions = await getJackInTerminalOptions(
          projectConnectSequence,
          rootUri
        );
        if (terminalJackInOptions) {
          const onPortInUse = (portInUse: PortInUse) =>
            void handlePortInUse({
              ...portInUse,
              jackInAgain: () =>
                executeJackIn(projectConnectSequence, undefined, projectRootUri, cb),
            });
          void executeJackInTask(
            terminalJackInOptions,
            projectConnectSequence,
            rootUri,
            onPortInUse,
            cb
          );
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
  connectSequence: connectSequences.ReplConnectSequence,
  autoSelected: connectSequences.ReplConnectSequence | undefined,
  projectRootUri: vscode.Uri,
  cb?: () => unknown
): Promise<unknown> {
  return executeJackIn(connectSequence, autoSelected, projectRootUri, cb);
}

export function jackOutCommand() {
  return calvaJackout();
}

export async function reJackInCommand() {
  const processes = listJackInProcesses().filter((entry) => entry.connected);
  if (processes.length === 0) {
    void vscode.window.showInformationMessage('No active Jack-in process to restart.');
    return;
  }
  const picked =
    processes.length === 1
      ? { process: processes[0] }
      : await vscode.window.showQuickPick(
          processes.map((p) => ({
            label: p.connectSequence.name,
            description: vscode.workspace.asRelativePath(vscode.Uri.parse(p.projectRootUri)),
            process: p,
          })),
          {
            title: 'Pick a REPL to restart',
            placeHolder: 'Select which Jack-in process to restart',
          }
        );
  if (!picked) {
    return;
  }
  const { connectSequence, projectRootUri } = picked.process;
  await jackIn(connectSequence, undefined, vscode.Uri.parse(projectRootUri));
}

export async function jackInCommand(options: {
  connectSequence?: connectSequences.ReplConnectSequence | string;
  disableAutoSelect?: boolean;
}) {
  const connectSequence = sequenceFromArg(options?.connectSequence);
  const decided = await state
    .decideFlowRoot(connectTypes.ConnectType.JackIn, connectSequence, options?.disableAutoSelect)
    .catch(logRootDecisionError);
  if (!decided) {
    return;
  }
  await jackIn(connectSequence, decided.sequence, decided.root);
}

function disconnectWithCommandArg(arg: unknown) {
  const plan = planDisconnectCommand(parseDisconnectCommandOptions(arg), {
    hasClient: (clientKey) => clientRegistry.getClient(clientKey) !== undefined,
    hasWsServerPort: (port) =>
      [...nReplWsServer.getActiveServers()].some((server) => server.port === port),
    hasHostPort: (host, port) =>
      clientRegistry.listClients().some((client) => client.host === host && client.port === port),
  });
  if (plan.action === 'unknown') {
    void vscode.window.showInformationMessage(plan.message);
    return;
  }
  void connector.disconnect(plan.options);
}

export function calvaDisconnect(arg?: unknown) {
  if (utilities.getConnectedState()) {
    disconnectWithCommandArg(arg);
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
          void connector.disconnect();
          utilities.setLaunchingState(null);
          utilities.setConnectingState(false);
          statusbar.update();
          output.appendLineOtherOut('Interrupting Jack-in process.');
        }
      });
    return;
  } else if (nReplWsServer.getActiveServers().size > 0) {
    disconnectWithCommandArg(arg);
    return;
  }
  void vscode.window.showInformationMessage('Not connected to a REPL server');
}
