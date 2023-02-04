import * as vscode from 'vscode';
import Analytics from './analytics';
import * as util from './utilities';
import * as path from 'path';
import * as child from 'child_process';
import { getStateValue, setStateValue } from './cljs-lib/out/cljs-lib';
import * as projectRoot from './project-root';

let extensionContext: vscode.ExtensionContext;
export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
  if (context.workspaceState.get('selectedCljTypeName') == undefined) {
    void context.workspaceState.update('selectedCljTypeName', 'unknown');
  }
}

export function initDepsEdnJackInExecutable() {
  console.log('deps.edn launcher check, executing: `clojure -M -e :clojure-works` ...');
  child.exec('clojure -M -e :clojure-works', (err, stdout, stderr) => {
    console.log(`deps.edn launcher check - stdout: ${stdout}`);
    console.log(`deps.edn launcher check - stderr: ${stderr}`);
    if (err) {
      console.log('deps.edn launcher check: Error running `clojure` command');
      setStateValue('depsEdnJackInDefaultExecutable', 'deps.clj');
      return;
    }
    if (stdout.startsWith(':clojure-works')) {
      console.log('deps.edn launcher check: `clojure` command works');
      setStateValue('depsEdnJackInDefaultExecutable', 'clojure');
    } else {
      console.log('deps.edn launcher check: `clojure` command not returning expected output');
      setStateValue('depsEdnJackInDefaultExecutable', 'deps.clj');
    }
  });
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
  return vscode.workspace.workspaceFolders[0]?.uri;
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
export async function initProjectDir() {
  const candidatePaths = await projectRoot.findProjectRoots();
  const active_uri = vscode.window.activeTextEditor?.document.uri;
  const closestRootPath: vscode.Uri = active_uri
    ? projectRoot.findClosestParent(active_uri, candidatePaths)
    : undefined;
  const projectRootPath: vscode.Uri = await projectRoot.pickProjectRoot(
    candidatePaths,
    closestRootPath
  );
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
