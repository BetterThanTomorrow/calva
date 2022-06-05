import * as vscode from 'vscode';
import * as util from './utilities';
import * as config from './config';
import * as path from 'path';

export async function findProjectRootPaths() {
  const projectFileNames: string[] = [
    'project.clj',
    'shadow-cljs.edn',
    'deps.edn',
    'bb.edn',
    '.nrepl-port',
  ];
  const projectFilesGlob = `**/{${projectFileNames.join(',')}}`;
  const excludeDirsGlob = excludePattern();
  const t0 = new Date().getTime();
  const rootPaths: string[] = [];
  if (vscode.workspace.workspaceFolders?.length > 0) {
    const wsRootPaths = vscode.workspace.workspaceFolders.map((f) => f.uri.fsPath);
    rootPaths.push(...wsRootPaths);
  }
  const candidateUris = await vscode.workspace.findFiles(projectFilesGlob, excludeDirsGlob, 10000);
  console.debug('glob took', new Date().getTime() - t0, 'ms');
  const projectFilePaths = candidateUris.map((uri) => path.dirname(uri.fsPath));
  rootPaths.push(...projectFilePaths);
  const candidatePaths = [...new Set(rootPaths)].sort();
  return candidatePaths;
}

export function excludePattern(moreExcludes: string[] = []) {
  return `**/{${[...moreExcludes, ...config.getConfig().projectRootsSearchExclude].join(',')}}`;
}

export async function findClosestProjectRootPath(candidatePaths?: string[]) {
  const doc = util.tryToGetDocument({});
  const docDir = doc && doc.uri ? path.dirname(doc.uri.fsPath) : undefined;
  candidatePaths = candidatePaths ?? (await findProjectRootPaths());
  const closestRootPath = docDir
    ? candidatePaths
        .filter((p) => docDir.startsWith(p))
        .sort()
        .reverse()[0]
    : candidatePaths[0];
  if (closestRootPath) {
    return closestRootPath;
  } else if (candidatePaths && candidatePaths.length > 0) {
    return candidatePaths[0];
  }
}

export async function pickProjectRootPath(candidatePaths: string[], closestRootPath: string) {
  if (closestRootPath !== undefined) {
    const pickedRootPath =
      candidatePaths.length < 2
        ? undefined
        : await util.quickPickSingle({
            title: 'Project root',
            values: candidatePaths,
            default: closestRootPath,
            placeHolder: 'Multiple Clojure projects found. Please pick the one you want to use.',
            saveAs: `projectRoot`,
            autoSelect: true,
          });
    const projectRootPath = candidatePaths.includes(pickedRootPath)
      ? pickedRootPath
      : closestRootPath;
    return projectRootPath;
  }
}
