import * as vscode from 'vscode';
import * as semver from 'semver';
import * as analyticsModule from './analytics';
import * as util from './utilities';
import * as path from 'path';
import * as fileArg from './util/resolve-file-arg';
import * as child from 'child_process';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as projectRoot from './project-root';
import * as connectSequences from './nrepl/connectSequence';
import * as connectTypes from './nrepl/connect-types';
import {
  decideProjectRoot,
  RootDecision,
  RootDecisionInput,
  SequenceForRootDecision,
} from './project-root-decision';

let extensionContext: vscode.ExtensionContext;
export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
  if (context.workspaceState.get('selectedCljTypeName') == undefined) {
    void context.workspaceState.update('selectedCljTypeName', 'unknown');
  }
}

export function initDepsEdnJackInExecutable() {
  const launcherCheckCommand = 'clojure --version';
  console.log(`deps.edn launcher check, executing: '${launcherCheckCommand}' ...`);
  child.exec('clojure --version', (err, stdout, stderr) => {
    console.log(
      `deps.edn launcher check - '${launcherCheckCommand}' - stdout: ${stdout.replace(
        /\r?\n$/,
        ''
      )}`
    );
    console.log(
      `deps.edn launcher check - '${launcherCheckCommand}' - stderr: ${stderr.replace(
        /\r?\n$/,
        ''
      )}`
    );
    if (err) {
      console.warn(
        `deps.edn launcher check: '${launcherCheckCommand}' command failed, using 'deps.clj'`
      );
      cljsLib.setStateValue('depsEdnJackInDefaultExecutable', 'deps.clj');
      return;
    }
    if (stdout.match('version')) {
      console.info(
        `deps.edn launcher check: '${launcherCheckCommand}' command works, using 'clojure'`
      );
      cljsLib.setStateValue('depsEdnJackInDefaultExecutable', 'clojure');
      const version = stdout.match(/version\s+([\d.]+)/)[1];
      console.info(`clojure version: ${version}`);
      ancientCLICheck(version);
    } else {
      console.warn(
        `deps.edn launcher check: '${launcherCheckCommand}' command not returning expected output, using 'deps.clj'`
      );
      cljsLib.setStateValue('depsEdnJackInDefaultExecutable', 'deps.clj');
    }
  });
}

function ancientCLICheck(version: string) {
  const ancientVersion = '1.10.697';
  if (semver.lt(semver.coerce(version), ancientVersion)) {
    console.warn(`The installed 'clojure' version is ancient, even lower than ${ancientVersion}.`);
    cljsLib.setStateValue('isClojureCLIVersionAncient', true);
  }
}

// Super-quick fix for: https://github.com/BetterThanTomorrow/calva/issues/144
// TODO: Revisit the whole state management business.
function _outputChannel(name: string): vscode.OutputChannel {
  const channel = cljsLib.getStateValue(name);
  if (channel.toJS !== undefined) {
    return channel.toJS();
  } else {
    return channel;
  }
}

function outputChannel(): vscode.OutputChannel {
  return _outputChannel('outputChannel');
}

function connectionLogChannel(): vscode.OutputChannel {
  return _outputChannel('connectionLogChannel');
}

function analytics(): analyticsModule.Analytics {
  const analytics = cljsLib.getStateValue('analytics');
  if (analytics.toJS !== undefined) {
    return analytics.toJS();
  } else {
    return analytics;
  }
}

const PROJECT_DIR_KEY = 'connect.projectDir';
const PROJECT_DIR_URI_KEY = 'connect.projectDirNew';
const PROJECT_CONFIG_MAP = 'config';

export function getProjectRootLocal(): string | undefined {
  return cljsLib.getStateValue(PROJECT_DIR_KEY);
}

export function getProjectConfig() {
  return cljsLib.getStateValue(PROJECT_CONFIG_MAP);
}

export function setProjectConfig(config) {
  return cljsLib.setStateValue(PROJECT_CONFIG_MAP, config);
}

export function getProjectRootUri(): vscode.Uri | undefined {
  const res = cljsLib.getStateValue(PROJECT_DIR_URI_KEY);
  if (res) {
    return res;
  }
  if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders[0].uri;
  } else {
    return undefined;
  }
}

function nonProjectRootUri(preferWorkspaceFolder: boolean): vscode.Uri {
  const folder = preferWorkspaceFolder ? vscode.workspace.workspaceFolders?.[0]?.uri : undefined;
  return folder ?? vscode.Uri.file(path.join(util.calvaTmpDir(), util.randomSlug()));
}

export async function setOrCreateNonProjectRoot(
  context: vscode.ExtensionContext,
  preferWorkspaceFolder = false
): Promise<vscode.Uri> {
  const root = nonProjectRootUri(preferWorkspaceFolder);
  await cljsLib.setStateValue(PROJECT_DIR_KEY, path.resolve(root.fsPath ? root.fsPath : root.path));
  await cljsLib.setStateValue(PROJECT_DIR_URI_KEY, root);
  return root;
}

function getProjectWsFolder(): vscode.WorkspaceFolder | undefined {
  const doc = util.tryToGetDocument({});
  if (doc) {
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (folder) {
      return folder;
    }
  }
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.workspace.workspaceFolders[0];
  }
  return undefined;
}

function sequenceRootKey(projectRootPath?: string[]): string | undefined {
  if (!projectRootPath?.length) {
    return undefined;
  }
  return vscode.workspace.asRelativePath(path.join(...projectRootPath));
}

function sequenceForDecision(
  sequence: connectSequences.ReplConnectSequence
): SequenceForRootDecision {
  return { sequence, rootKey: sequenceRootKey(sequence.projectRootPath) };
}

/**
 * The inputs for one root decision: candidate roots, the active file's closest
 * root, and the caller's asRelativePath keys.
 */
export async function gatherRootDecision(
  connectType: connectTypes.ConnectType,
  connectSequence: connectSequences.ReplConnectSequence | undefined,
  disableAutoSelect: boolean
): Promise<{ input: RootDecisionInput; candidateUris: vscode.Uri[] }> {
  const candidateUris = await projectRoot.findProjectRoots();
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const closest = activeUri ? projectRoot.findClosestParent(activeUri, candidateUris) : undefined;
  return {
    candidateUris,
    input: {
      connectType: connectType === connectTypes.ConnectType.Connect ? 'connect' : 'jack-in',
      passedSequence: connectSequence ? sequenceForDecision(connectSequence) : undefined,
      disableAutoSelect,
      sequences: connectSequences.getCustomConnectSequences().map(sequenceForDecision),
      candidateRoots: candidateUris.map((uri) => uri.fsPath),
      closestRoot: closest?.fsPath,
      closestRootKey: closest ? vscode.workspace.asRelativePath(closest) : undefined,
      workspaceFolders: (vscode.workspace.workspaceFolders ?? []).map(
        (folder) => folder.uri.fsPath
      ),
    },
  };
}

async function uriFromRootDecision(
  decision: RootDecision,
  candidateUris: vscode.Uri[],
  connectType: connectTypes.ConnectType
): Promise<vscode.Uri | undefined> {
  if ('root' in decision) {
    return (
      candidateUris.find((uri) => uri.fsPath === decision.root) ?? vscode.Uri.file(decision.root)
    );
  }
  if ('ask' in decision) {
    const preselect = decision.ask.preselect
      ? candidateUris.find((uri) => uri.fsPath === decision.ask.preselect) ??
        vscode.Uri.file(decision.ask.preselect)
      : undefined;
    return projectRoot.pickProjectRoot(candidateUris, preselect, connectType);
  }
  return undefined;
}

async function pickRootFromDecision(
  connectType: connectTypes.ConnectType,
  connectSequence: connectSequences.ReplConnectSequence | undefined,
  disableAutoSelect: boolean
): Promise<vscode.Uri | undefined> {
  const { input, candidateUris } = await gatherRootDecision(
    connectType,
    connectSequence,
    disableAutoSelect
  );
  return uriFromRootDecision(decideProjectRoot(input), candidateUris, connectType);
}

/**
 * Returns the project root for a flow that leaves Calva's state as it is, such as
 * copying a jack-in command line. Shows the Project Root menu when the decision asks.
 */
export async function decideProjectRootUri(
  connectType: connectTypes.ConnectType,
  connectSequence: connectSequences.ReplConnectSequence | undefined,
  disableAutoSelect = false
): Promise<vscode.Uri> {
  return (
    (await pickRootFromDecision(connectType, connectSequence, disableAutoSelect)) ??
    nonProjectRootUri(true)
  );
}

/**
 * Figures out the current clojure project root, and stores it in Calva state
 */
export async function initProjectDir(
  connectType: connectTypes.ConnectType,
  connectSequence: connectSequences.ReplConnectSequence,
  disableAutoSelect = false
) {
  const chosen = await pickRootFromDecision(connectType, connectSequence, disableAutoSelect);
  if (chosen) {
    console.log('Setting project root to: ', chosen.fsPath);
    void vscode.commands.executeCommand('setContext', 'calva:projectRoot', chosen.fsPath);
    await cljsLib.setStateValue(PROJECT_DIR_KEY, chosen.fsPath);
    await cljsLib.setStateValue(PROJECT_DIR_URI_KEY, chosen);
    return chosen;
  }
  return setOrCreateNonProjectRoot(extensionContext, true);
}

/**
 *
 * Tries to resolve absolute path in relation to project root
 * @param filePath - absolute or relative to the project
 */
export function resolvePath(filePath?: string): vscode.Uri {
  const root = getProjectWsFolder();

  if (root && root.uri.scheme !== 'file') {
    return vscode.Uri.joinPath(root.uri, filePath);
  }

  const resolved = fileArg.resolveFilePath(filePath, root?.uri.fsPath);
  return resolved ? vscode.Uri.file(resolved) : undefined;
}

export { extensionContext, outputChannel, connectionLogChannel, analytics };
