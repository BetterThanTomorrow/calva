import * as vscode from 'vscode';
import * as util from './utilities';
import * as config from './config';
import * as path from 'path';

export async function findProjectRootPaths() {
  const projectFileNames: string[] = ['project.clj', 'shadow-cljs.edn', 'deps.edn'];
  const projectFilesGlob = `**/{${projectFileNames.join(',')}}`;
  const excludeDirsGlob = `**/{${config.getConfig().projectRootsSearchExclude.join(',')}}`;
  const t0 = new Date().getTime();
  const candidateUris = await vscode.workspace.findFiles(projectFilesGlob, excludeDirsGlob, 10000);
  console.debug('glob took', new Date().getTime() - t0, 'ms');
  const projectFilePaths = candidateUris.map((uri) => path.dirname(uri.fsPath));
  const candidatePaths = [...new Set(projectFilePaths)].sort();
  console.log({ candidatePaths });
  return candidatePaths;
}

export async function findClosestProjectRootPath(candidatePaths?: string[]) {
  const doc = util.tryToGetDocument({});
  console.log(doc);
  const docDir = doc && doc.uri ? path.dirname(doc.uri.fsPath) : undefined;
  candidatePaths = candidatePaths ?? await findProjectRootPaths();
  const closestRootPath = docDir
    ? candidatePaths
        .filter((p) => docDir.startsWith(p))
        .sort()
        .reverse()[0]
    : candidatePaths[0];
  console.log(closestRootPath);
  return closestRootPath;
}

export async function pickProjectRootPath(candidatePaths: string[], closestRootPath: string) {
  const pickedRootPath =
    candidatePaths.length < 2
      ? undefined
      : await util.quickPickSingle({
          title: 'Project root',
          values: candidatePaths,
          default: closestRootPath,
          placeHolder: 'Multiple Clojure projects found, pick one',
          saveAs: `projectRoot`,
          autoSelect: true,
        });
  const projectRootPath = candidatePaths.includes(pickedRootPath)
    ? pickedRootPath
    : closestRootPath;
  return projectRootPath;
}
