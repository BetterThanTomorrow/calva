import * as vscode from 'vscode';
import * as semver from 'semver';
import Analytics from './analytics';
import * as util from './utilities';
import * as path from 'path';
import * as fileArg from './util/resolve-file-arg';
import * as child from 'child_process';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as projectRoot from './project-root';
import * as connectSequences from './nrepl/connectSequence';
import * as connectTypes from './nrepl/connect-types';

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

function analytics(): Analytics {
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

export function getProjectRootLocal(useCache = true): string | undefined {
  if (useCache) {
    return cljsLib.getStateValue(PROJECT_DIR_KEY);
  }
}

export function getProjectConfig(useCache = true) {
  if (useCache) {
    return cljsLib.getStateValue(PROJECT_CONFIG_MAP);
  }
}

export function setProjectConfig(config) {
  return cljsLib.setStateValue(PROJECT_CONFIG_MAP, config);
}

export function getProjectRootUri(useCache = true): vscode.Uri | undefined {
  if (useCache) {
    const res = cljsLib.getStateValue(PROJECT_DIR_URI_KEY);
    if (res) {
      return res;
    }
  }
  if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders[0].uri;
  } else {
    return undefined;
  }
}

export async function setOrCreateNonProjectRoot(
  context: vscode.ExtensionContext,
  preferProjectDir = false
): Promise<vscode.Uri> {
  let root: vscode.Uri | undefined = undefined;
  if (preferProjectDir) {
    root = getProjectRootUri();
  }
  if (!root) {
    const subDir = util.randomSlug();
    root = vscode.Uri.file(path.join(util.calvaTmpDir(), subDir));
  }
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

/**
 * Figures out the current clojure project root, and stores it in Calva state
 */
export async function initProjectDir(
  connectType: connectTypes.ConnectType,
  connectSequence: connectSequences.ReplConnectSequence,
  disableAutoSelect = false
) {
  // When a connectSequence with projectRootPath is explicitly provided, use it directly
  // This supports programmatic multi-connection flows
  if (connectSequence?.projectRootPath?.length > 0) {
    const projectRootPath = util.resolveFileArgToUri(
      connectSequence.projectRootPath,
      vscode.workspace.workspaceFolders
    );
    if (projectRootPath) {
      console.log('Setting project root to: ', projectRootPath.fsPath);
      void vscode.commands.executeCommand(
        'setContext',
        'calva:projectRoot',
        projectRootPath.fsPath
      );
      await cljsLib.setStateValue(PROJECT_DIR_KEY, projectRootPath.fsPath);
      await cljsLib.setStateValue(PROJECT_DIR_URI_KEY, projectRootPath);
      return projectRootPath;
    }
  }

  // Otherwise, use auto-selection logic
  const candidatePaths = await projectRoot.findProjectRoots();
  const active_uri = vscode.window.activeTextEditor?.document.uri;
  const closestRootPath: vscode.Uri = active_uri
    ? projectRoot.findClosestParent(active_uri, candidatePaths)
    : undefined;

  const sequences: connectSequences.ReplConnectSequence[] =
    connectSequences.getCustomConnectSequences();

  const defaultSequences = disableAutoSelect
    ? [connectSequence]
    : sequences.filter((s) =>
        connectType === connectTypes.ConnectType.Connect
          ? s.autoSelectForConnect
          : s.autoSelectForJackIn
      );
  const defaultSequence =
    defaultSequences.find(
      (s) =>
        s.projectRootPath &&
        vscode.workspace.asRelativePath(path.join(...s.projectRootPath)) ===
          vscode.workspace.asRelativePath(closestRootPath)
    ) || defaultSequences.shift();

  let projectRootPath: vscode.Uri;
  if (defaultSequence?.projectRootPath?.length > 0) {
    projectRootPath = util.resolveFileArgToUri(
      defaultSequence.projectRootPath,
      vscode.workspace.workspaceFolders
    );
  } else {
    projectRootPath = await projectRoot.pickProjectRoot(
      candidatePaths,
      closestRootPath,
      connectType
    );
  }
  if (projectRootPath) {
    console.log('Setting project root to: ', projectRootPath.fsPath);
    void vscode.commands.executeCommand('setContext', 'calva:projectRoot', projectRootPath.fsPath);
    await cljsLib.setStateValue(PROJECT_DIR_KEY, projectRootPath.fsPath);
    await cljsLib.setStateValue(PROJECT_DIR_URI_KEY, projectRootPath);
    return projectRootPath;
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
