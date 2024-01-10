import * as vscode from 'vscode';
import * as semver from 'semver';
import Analytics from './analytics';
import * as util from './utilities';
import * as path from 'path';
import * as child from 'child_process';
import { getStateValue, setStateValue } from '../out/cljs-lib/cljs-lib';
import * as projectRoot from './project-root';
import { getCustomConnectSequences, ReplConnectSequence } from './nrepl/connectSequence';
import { ConnectType } from './nrepl/connect-types';

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
      setStateValue('depsEdnJackInDefaultExecutable', 'deps.clj');
      return;
    }
    if (stdout.match('version')) {
      console.info(
        `deps.edn launcher check: '${launcherCheckCommand}' command works, using 'clojure'`
      );
      setStateValue('depsEdnJackInDefaultExecutable', 'clojure');
      const version = stdout.match(/version\s+([\d.]+)/)[1];
      console.info(`clojure version: ${version}`);
      ancientCLICheck(version);
    } else {
      console.warn(
        `deps.edn launcher check: '${launcherCheckCommand}' command not returning expected output, using 'deps.clj'`
      );
      setStateValue('depsEdnJackInDefaultExecutable', 'deps.clj');
    }
  });
}

function ancientCLICheck(version: string) {
  const ancientVersion = '1.10.697';
  if (semver.lt(semver.coerce(version), ancientVersion)) {
    console.warn(`The installed 'clojure' version is ancient, even lower than ${ancientVersion}.`);
    setStateValue('isClojureCLIVersionAncient', true);
  }
}

// Super-quick fix for: https://github.com/BetterThanTomorrow/calva/issues/144
// TODO: Revisit the whole state management business.
function _outputChannel(name: string): vscode.OutputChannel {
  const channel = getStateValue(name);
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
  const analytics = getStateValue('analytics');
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
    return getStateValue(PROJECT_DIR_KEY);
  }
}

export function getProjectConfig(useCache = true) {
  if (useCache) {
    return getStateValue(PROJECT_CONFIG_MAP);
  }
}

export function setProjectConfig(config) {
  return setStateValue(PROJECT_CONFIG_MAP, config);
}

export function getProjectRootUri(useCache = true): vscode.Uri | undefined {
  if (useCache) {
    const res = getStateValue(PROJECT_DIR_URI_KEY);
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

const NON_PROJECT_DIR_KEY = 'calva.connect.nonProjectDir';

export async function getNonProjectRootDir(
  context: vscode.ExtensionContext
): Promise<vscode.Uri | undefined> {
  let root: vscode.Uri | undefined = undefined;
  if (!process.env['NEW_DRAMS']) {
    root = await context.globalState.get<Promise<vscode.Uri>>(NON_PROJECT_DIR_KEY);
  }
  if (root) {
    const createNewOption = 'Create new temp directory, download new files';
    const useExistingOption = 'Use existing temp directory, reuse any existing files';
    root = await vscode.window
      .showQuickPick([useExistingOption, createNewOption], {
        placeHolder: 'Reuse the existing REPL temp dir and its files?',
      })
      .then((option) => {
        return option === useExistingOption ? root : undefined;
      });
  }
  if (typeof root === 'object') {
    root = vscode.Uri.file(root.path);
  }
  return root;
}

export async function setNonProjectRootDir(context: vscode.ExtensionContext, root: vscode.Uri) {
  await context.globalState.update(NON_PROJECT_DIR_KEY, root);
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
    root = await getNonProjectRootDir(context);
  }
  if (!root) {
    const subDir = util.randomSlug();
    root = vscode.Uri.file(path.join(util.calvaTmpDir(), subDir));
    await setNonProjectRootDir(context, root);
  }
  await setStateValue(PROJECT_DIR_KEY, path.resolve(root.fsPath ? root.fsPath : root.path));
  await setStateValue(PROJECT_DIR_URI_KEY, root);
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
  connectType: ConnectType,
  connectSequence: ReplConnectSequence,
  disableAutoSelect = false
) {
  const candidatePaths = await projectRoot.findProjectRoots();
  const active_uri = vscode.window.activeTextEditor?.document.uri;
  const closestRootPath: vscode.Uri = active_uri
    ? projectRoot.findClosestParent(active_uri, candidatePaths)
    : undefined;

  const sequences: ReplConnectSequence[] = getCustomConnectSequences();

  const defaultSequence = connectSequence
    ? connectSequence
    : disableAutoSelect
    ? undefined
    : sequences.find(
        (s) =>
          (connectType === ConnectType.Connect ? s.autoSelectForConnect : s.autoSelectForJackIn) &&
          !!s.projectRootPath
      );

  let projectRootPath: vscode.Uri;
  if (defaultSequence?.projectRootPath?.length > 0) {
    if (path.isAbsolute(defaultSequence.projectRootPath[0])) {
      projectRootPath = vscode.Uri.file(path.join(...defaultSequence.projectRootPath));
    } else {
      projectRootPath = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders[0].uri,
        ...defaultSequence.projectRootPath
      );
    }
  } else {
    projectRootPath = await projectRoot.pickProjectRoot(
      candidatePaths,
      closestRootPath,
      connectType
    );
  }
  if (projectRootPath) {
    setStateValue(PROJECT_DIR_KEY, projectRootPath.fsPath);
    setStateValue(PROJECT_DIR_URI_KEY, projectRootPath);
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

  if (filePath && path.isAbsolute(filePath)) {
    return vscode.Uri.file(filePath);
  }
  return filePath && root && vscode.Uri.file(path.resolve(root.uri.fsPath, filePath));
}

export { extensionContext, outputChannel, connectionLogChannel, analytics };
