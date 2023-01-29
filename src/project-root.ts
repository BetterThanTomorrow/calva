import * as config from './config';
import * as vscode from 'vscode';
import * as path from 'path';

export type ProjectRoot = {
  uri: vscode.Uri;
  reason: string;

  workspace_root?: boolean;
  valid_project?: boolean;
};

export const rootToUri = (root_or_uri: ProjectRoot | vscode.Uri) => {
  if (root_or_uri instanceof vscode.Uri) {
    return root_or_uri;
  }
  return root_or_uri.uri;
};

type FindRootParams = {
  /**
   * If set to `false` then root workspace folders won't be included in the list by default. They will only
   * be included if they match the same project heuristics as any other folder in the workspace.
   *
   * @default true
   */
  include_workspace_folders?: boolean;
};

/**
 * Returns a list of discovered project roots. A directory is considered a project root if it contains certain
 * clojure related files that identify it as a Clojure project. For example, a `deps.edn` file.
 *
 * The response contains a `reason` as to why a folder is considered a project root which can be used in
 * selection menus to help the user.
 */
export async function findProjectRootsWithReasons(params?: FindRootParams) {
  const projectFileNames: string[] = ['project.clj', 'shadow-cljs.edn', 'deps.edn', 'bb.edn'];
  const projectFilesGlob = `**/{${projectFileNames.join(',')}}`;
  const excludeDirsGlob = excludePattern();
  const rootPaths: ProjectRoot[] = [];
  if (
    vscode.workspace.workspaceFolders?.length > 0 &&
    (params?.include_workspace_folders ?? true)
  ) {
    const wsRootPaths = vscode.workspace.workspaceFolders.map((f) => {
      return {
        uri: f.uri,
        reason: 'Workspace Root',
        workspace_root: true,
      };
    });
    rootPaths.push(...wsRootPaths);
  }
  const candidateUris = await vscode.workspace.findFiles(projectFilesGlob, excludeDirsGlob, 10000);
  const projectFilePaths = candidateUris.map((uri) => {
    const dir = uri.with({ path: path.dirname(uri.fsPath) });
    return {
      uri: dir,
      reason: path.basename(uri.path),
      valid_project: true,
    };
  });
  rootPaths.push(...projectFilePaths);

  return rootPaths.reduce((roots: ProjectRoot[], root) => {
    const existing = roots.find(({ uri }) => root.uri.path === uri.path);
    if (existing) {
      existing.reason = `${existing.reason}, ${root.reason}`;
      existing.workspace_root = root.workspace_root ? true : existing.workspace_root;
      existing.valid_project = root.valid_project ? true : existing.valid_project;
      return roots;
    }
    roots.push(root);
    return roots;
  }, []);
}

export async function findProjectRoots(params?: FindRootParams) {
  return findProjectRootsWithReasons(params).then((res) => {
    return res.map((root) => root.uri);
  });
}

export function excludePattern(moreExcludes: string[] = []) {
  return `**/{${[...moreExcludes, ...config.getConfig().projectRootsSearchExclude].join(',')}}/**`;
}

export async function isValidClojureProject(uri: vscode.Uri) {
  return findProjectRootsWithReasons().then((roots) => {
    return !!roots.find((root) => {
      return uri.path === root.uri.path && root.valid_project;
    });
  });
}

function findMatchingParent(
  from: vscode.Uri,
  uris: vscode.Uri[],
  comp: (a: vscode.Uri, b: vscode.Uri) => vscode.Uri
) {
  return uris.reduce((root: vscode.Uri | undefined, uri) => {
    const relative = path.relative(uri.fsPath, from.fsPath);
    if (relative && !relative.includes('../')) {
      if (!root) {
        return uri;
      }
      return comp(uri, root);
    }
    return root;
  }, undefined);
}

export function findClosestParent(from: vscode.Uri, uris: vscode.Uri[]) {
  return findMatchingParent(from, uris, (a, b) => {
    if (a.fsPath > b.fsPath) {
      return a;
    } else {
      return b;
    }
  });
}

export function findFurthestParent(from: vscode.Uri, uris: vscode.Uri[]) {
  return findMatchingParent(from, uris, (a, b) => {
    if (a.fsPath < b.fsPath) {
      return a;
    } else {
      return b;
    }
  });
}

export async function pickProjectRoot(
  uris: Array<vscode.Uri | ProjectRoot>,
  selected?: vscode.Uri
) {
  if (uris.length === 0) {
    return;
  }
  if (uris.length === 1) {
    return rootToUri(uris[0]);
  }

  const sorted = sortPreSelectedFirst(uris, selected);

  const project_root_options = sorted.map((root_or_uri) => {
    let uri;
    let reason;
    if (root_or_uri instanceof vscode.Uri) {
      uri = root_or_uri;
    } else {
      uri = root_or_uri.uri;
      reason = root_or_uri.reason;
    }
    return {
      label: uri.path,
      detail: reason,
      picked: uri.path === selected?.path,
      value: uri,
    };
  });

  const picker = vscode.window.createQuickPick();
  picker.items = project_root_options;
  picker.title = 'Project Selection';
  picker.placeholder = 'Pick the Clojure project you want to use as the root';
  picker.activeItems = project_root_options.filter((root) => root.label === selected?.path);
  picker.show();

  const selected_root = await new Promise<any>((resolve) => {
    picker.onDidAccept(() => {
      resolve(picker.selectedItems[0]);
    });
    picker.onDidHide(() => resolve(undefined));
  });

  picker.dispose();

  return selected_root?.value;
}

function sortPreSelectedFirst(uris: (ProjectRoot | vscode.Uri)[], selected: vscode.Uri) {
  return [...uris].sort((a, b) => {
    if (!selected) {
      return 0;
    }
    return rootToUri(a).fsPath === selected.fsPath
      ? -1
      : rootToUri(b).fsPath === selected.fsPath
      ? 1
      : 0;
  });
}
