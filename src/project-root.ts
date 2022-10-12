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
    'settings.gradle',
    'settings.gradle.kts',
  ];
  const projectFilesGlob = `**/{${projectFileNames.join(',')}}`;
  const excludeDirsGlob = excludePattern();
  const t0 = new Date().getTime();
  const rootPaths: vscode.Uri[] = [];
  if (vscode.workspace.workspaceFolders?.length > 0) {
    const wsRootPaths = vscode.workspace.workspaceFolders.map((f) => f.uri);
    rootPaths.push(...wsRootPaths);
  }
  const candidateUris = await vscode.workspace.findFiles(projectFilesGlob, excludeDirsGlob, 10000);
  console.debug('glob took', new Date().getTime() - t0, 'ms');
  const projectFilePaths = candidateUris.map((uri) => uri.with({ path: path.dirname(uri.fsPath) }));
  rootPaths.push(...projectFilePaths);
  const candidatePaths = [...new Set(rootPaths)].sort();
  return candidatePaths;
}

export function excludePattern(moreExcludes: string[] = []) {
  return `**/{${[...moreExcludes, ...config.getConfig().projectRootsSearchExclude].join(',')}}`;
}

export async function findClosestProjectRootPath(candidatePaths?: vscode.Uri[]) {
  const doc = util.tryToGetDocument({});
  const docDir = doc && doc.uri ? doc.uri.with({ path: path.dirname(doc.uri.fsPath) }) : undefined;
  candidatePaths = candidatePaths ?? (await findProjectRootPaths());
  const closestRootPath = docDir
    ? candidatePaths
        .filter((u) => docDir.fsPath.startsWith(u.fsPath))
        .sort()
        .reverse()[0]
    : candidatePaths[0];
  if (closestRootPath) {
    return closestRootPath;
  } else if (candidatePaths && candidatePaths.length > 0) {
    return candidatePaths[0];
  }
}

export async function pickProjectRootPath(
  candidatePaths: vscode.Uri[],
  closestRootPath: vscode.Uri
) {
  if (closestRootPath !== undefined) {
    const pickedRootPath =
      candidatePaths.length < 2
        ? undefined
        : await util.quickPickSingle({
            title: 'Project root',
            values: [...new Set(candidatePaths.map((u) => u.fsPath))],
            default: closestRootPath.fsPath,
            placeHolder: 'Multiple Clojure projects found. Please pick the one you want to use.',
            saveAs: `projectRoot`,
            autoSelect: true,
          });
    const filtered = candidatePaths.filter((u) => u.fsPath === pickedRootPath);
    const pickedRootUri = filtered.length > 0 ? filtered[0] : undefined;
    return pickedRootUri ?? closestRootPath;
  }
}
