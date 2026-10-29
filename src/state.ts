import * as vscode from 'vscode';
import * as semver from 'semver';
import * as analyticsModule from './analytics';
import * as util from './utilities';
import * as currentFile from './current-file';
import * as path from 'path';
import * as fileArg from './util/resolve-file-arg';
import * as child from 'child_process';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as projectRoot from './project-root';
import * as connectSequences from './nrepl/connectSequence';
import * as connectTypes from './nrepl/connect-types';
import { decideProjectRoot, RootDecision, RootDecisionInput } from './project-root-decision';

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

const PROJECT_CONFIG_MAP = 'config';

export function getProjectConfig() {
  return cljsLib.getStateValue(PROJECT_CONFIG_MAP);
}

export function setProjectConfig(config) {
  return cljsLib.setStateValue(PROJECT_CONFIG_MAP, config);
}

/**
 * Returns a new, random folder in Calva's temp dir. The folder is not created.
 */
export function tempRootUri(): vscode.Uri {
  return vscode.Uri.file(path.join(util.calvaTmpDir(), util.randomSlug()));
}

/**
 * Returns the root for a REPL outside any project: the first workspace folder,
 * or a temp dir when no folder is open.
 */
export function nonProjectRootUri(): vscode.Uri {
  return vscode.workspace.workspaceFolders?.[0]?.uri ?? tempRootUri();
}

function getProjectWsFolder(): vscode.WorkspaceFolder | undefined {
  const uri = currentFile.currentFileUri();
  if (uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
      return folder;
    }
  }
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.workspace.workspaceFolders[0];
  }
  return undefined;
}

/**
 * The inputs for one root decision: candidate roots, the current file's closest
 * root, the connect sequences and the workspace folders.
 */
export async function gatherRootDecision(
  connectType: connectTypes.ConnectType,
  connectSequence: connectSequences.ReplConnectSequence | undefined,
  disableAutoSelect: boolean
): Promise<{ input: RootDecisionInput; candidateUris: vscode.Uri[] }> {
  const candidateUris = await projectRoot.findProjectRoots();
  const fileUri = currentFile.currentFileUri();
  const closest = fileUri ? projectRoot.findClosestParent(fileUri, candidateUris) : undefined;
  return {
    candidateUris,
    input: {
      connectType: connectType === connectTypes.ConnectType.Connect ? 'connect' : 'jack-in',
      passedSequence: connectSequence,
      disableAutoSelect,
      sequences: connectSequences.getCustomConnectSequences(),
      candidateRoots: candidateUris.map((uri) => uri.fsPath),
      closestRoot: closest?.fsPath,
      workspaceFolders: (vscode.workspace.workspaceFolders ?? []).map(
        (folder) => folder.uri.fsPath
      ),
    },
  };
}

function candidateUri(rootPath: string, candidateUris: vscode.Uri[]): vscode.Uri {
  return candidateUris.find((uri) => uri.fsPath === rootPath) ?? vscode.Uri.file(rootPath);
}

/**
 * Returns the decided root, or the one picked in the Project Root menu.
 * `undefined` means the user cancelled the menu.
 */
async function uriFromRootDecision(
  decision: Exclude<RootDecision, { noCandidates: true }>,
  candidateUris: vscode.Uri[],
  connectType: connectTypes.ConnectType
): Promise<vscode.Uri | undefined> {
  if ('root' in decision) {
    return candidateUri(decision.root, candidateUris);
  }
  const preselect = decision.ask.preselect
    ? candidateUri(decision.ask.preselect, candidateUris)
    : undefined;
  return projectRoot.pickProjectRoot(candidateUris, preselect, connectType);
}

/**
 * The project root a flow decided, and the connect sequence that decided it.
 */
export type DecidedRoot = {
  root: vscode.Uri;
  sequence?: connectSequences.ReplConnectSequence;
};

/**
 * Returns the root decision for a jack-in or connect flow. Shows the Project Root
 * menu when the decision asks, and returns `undefined` when the user cancels it.
 */
export async function decideFlowRoot(
  connectType: connectTypes.ConnectType,
  connectSequence: connectSequences.ReplConnectSequence | undefined,
  disableAutoSelect = false
): Promise<DecidedRoot | undefined> {
  const { input, candidateUris } = await gatherRootDecision(
    connectType,
    connectSequence,
    disableAutoSelect
  );
  const decision = decideProjectRoot(input);
  if ('noCandidates' in decision) {
    return { root: nonProjectRootUri(), sequence: decision.sequence };
  }
  const root = await uriFromRootDecision(decision, candidateUris, connectType);
  return root ? { root, sequence: decision.sequence } : undefined;
}

/**
 * Returns the root decision without the Project Root menu. Where the decision
 * would ask, the root is the candidate closest to the active file, else the
 * first workspace folder.
 */
export async function decideRootWithoutMenu(
  connectType: connectTypes.ConnectType
): Promise<DecidedRoot> {
  const { input, candidateUris } = await gatherRootDecision(connectType, undefined, false);
  const decision = decideProjectRoot(input);
  const rootPath =
    'root' in decision ? decision.root : 'ask' in decision ? decision.ask.preselect : undefined;
  return {
    root: rootPath ? candidateUri(rootPath, candidateUris) : nonProjectRootUri(),
    sequence: decision.sequence,
  };
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
