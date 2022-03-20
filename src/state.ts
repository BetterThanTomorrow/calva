import * as vscode from 'vscode';
import Analytics from './analytics';
import * as util from './utilities';
import * as config from './config';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getStateValue, setStateValue } from '../out/cljs-lib/cljs-lib';

let extensionContext: vscode.ExtensionContext;
export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
  if (context.workspaceState.get('selectedCljTypeName') == undefined) {
    void context.workspaceState.update('selectedCljTypeName', 'unknown');
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
    return getStateValue(PROJECT_DIR_URI_KEY);
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

export async function getOrCreateNonProjectRoot(
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
    root = vscode.Uri.file(path.join(os.tmpdir(), 'betterthantomorrow.calva', subDir));
    await setNonProjectRootDir(context, root);
  }
  setStateValue(PROJECT_DIR_KEY, path.resolve(root.fsPath ? root.fsPath : root.path));
  setStateValue(PROJECT_DIR_URI_KEY, root);
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
 * Figures out, and stores, the current clojure project root in Calva state
 */
export async function initProjectDir(uri?: vscode.Uri): Promise<void> {
  if (uri) {
    setStateValue(PROJECT_DIR_KEY, path.resolve(uri.fsPath));
    setStateValue(PROJECT_DIR_URI_KEY, uri);
  } else {
    const workspaceFolder = getProjectWsFolder();
    console.log(workspaceFolder);
    const candidatePaths = await findProjectRootPaths();
    const closestRootPath = findClosestProjectRootPath(candidatePaths);
    const projectRootPath = await pickProjectRootPath(candidatePaths, closestRootPath);
    setStateValue(PROJECT_DIR_KEY, projectRootPath);
    setStateValue(PROJECT_DIR_URI_KEY, vscode.Uri.file(projectRootPath));
  }
}

async function findProjectRootPaths() {
  const projectFileNames: string[] = ['project.clj', 'shadow-cljs.edn', 'deps.edn'];
  const projectFilesGlob = `**/{${projectFileNames.join(',')}}`;
  const excludeDirsGlob = `**/{${config.getConfig().projectRootsSearchExclude.join(',')}}`;
  const t0 = new Date().getTime();
  const candidateUris = await vscode.workspace.findFiles(projectFilesGlob, excludeDirsGlob, 10000);
  console.debug('glob took', new Date().getTime() - t0, 'ms');
  const projectFilePaths = candidateUris.map((uri) => path.dirname(uri.fsPath));
  const candidatePaths = [...new Set(projectFilePaths)];
  console.log(candidatePaths);
  return candidatePaths;
}

function findClosestProjectRootPath(candidatePaths: string[]) {
  const doc = util.tryToGetDocument({});
  console.log(doc);
  const docDir = doc && doc.uri ? path.dirname(doc.uri.fsPath) : undefined;
  const closestRootPath = docDir
    ? candidatePaths
        .filter((p) => docDir.startsWith(p))
        .sort()
        .reverse()[0]
    : candidatePaths[0];
  console.log(closestRootPath);
  return closestRootPath;
}

async function pickProjectRootPath(candidatePaths: string[], closestRootPath: string) {
  const pickedRootPath =
    candidatePaths.length < 2
      ? undefined
      : await util.quickPickSingle({
          values: candidatePaths,
          // title: "Project root",
          // default: closestRootPath
          placeHolder: 'Select project root',
          saveAs: `projectRoot`,
          autoSelect: true,
        });
  const projectRootPath = typeof pickedRootPath === 'string' ? pickedRootPath : closestRootPath;
  return projectRootPath;
}

/**
 *
 * Tries to resolve absolute path in relation to project root
 * @param filePath - absolute or relative to the project
 */
export function resolvePath(filePath?: string) {
  const root = getProjectWsFolder();
  if (filePath && path.isAbsolute(filePath)) {
    return filePath;
  }
  return filePath && root && path.resolve(root.uri.fsPath, filePath);
}

export { extensionContext, outputChannel, connectionLogChannel, analytics };
