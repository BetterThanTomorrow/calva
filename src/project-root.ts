import * as config from './config';
import * as vscode from 'vscode';
import * as path from 'path';
import * as _ from 'lodash';
import { ConnectType } from './nrepl/connect-types';

export type ProjectRoot = {
  uri: vscode.Uri;
  label: string;
  reason: string;

  workspace_root?: boolean;
  valid_project?: boolean;
};

export const getPathRelativeToWorkspace = (uri: vscode.Uri) => {
  const root = vscode.workspace.getWorkspaceFolder(uri);
  if (!root) {
    return uri.path;
  }
  return path.relative(path.dirname(root.uri.path), uri.path);
};

type FindRootParams = {
  /**
   * If set to `false` then root workspace folders won't be included in the list by default. They will only
   * be included if they match the same project heuristics as any other folder in the workspace.
   *
   * @default true
   */
  include_workspace_folders?: boolean;

  /**
   * Whether or not to include clojure-lsp directories in the heuristic for deciding a directory is a project root.
   *
   * This makes sense for systems trying to find a directory to start an lsp server in, but not for systems
   * showing repl start commands.
   */
  include_lsp_directories?: boolean;
};

/**
 * Returns a list of discovered project roots. A directory is considered a project root if it contains certain
 * clojure related files that identify it as a Clojure project. For example, a `deps.edn` file.
 *
 * The response contains a `reason` as to why a folder is considered a project root which can be used in
 * selection menus to help the user.
 */
export async function findProjectRootsWithReasons(params?: FindRootParams) {
  const lspDirectories = ['.lsp/config.edn'];

  const projectFileNames: string[] = [
    'project.clj',
    'shadow-cljs.edn',
    'deps.edn',
    'bb.edn',
    'basilisp.edn',
  ];
  if (params?.include_lsp_directories) {
    projectFileNames.push(...lspDirectories);
  }

  const projectFilesGlob = `**/{${projectFileNames.join(',')}}`;
  const excludeDirsGlob = excludePattern();
  const rootPaths: ProjectRoot[] = [];
  if (params?.include_workspace_folders ?? true) {
    const wsRootPaths = vscode.workspace.workspaceFolders?.map((f) => {
      return {
        uri: f.uri,
        label: path.basename(f.uri.path),
        reason: 'Workspace Root',
        workspace_root: true,
      };
    });
    rootPaths.push(...(wsRootPaths || []));
  }
  const candidateUris = await vscode.workspace.findFiles(projectFilesGlob, excludeDirsGlob, 10000);
  const projectFilePaths = candidateUris.map((uri) => {
    let dir = vscode.Uri.file(path.dirname(uri.path));
    if (lspDirectories.find((file) => uri.path.endsWith(file))) {
      dir = vscode.Uri.file(path.join(uri.path, '../..'));
    }
    return {
      uri: dir,
      label: getPathRelativeToWorkspace(dir),
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
  return findProjectRootsWithReasons({ include_lsp_directories: true }).then((roots) => {
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
    if (relative && !relative.includes('..' + path.sep)) {
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
    if (a.path > b.path) {
      return a;
    } else {
      return b;
    }
  });
}

export function findFurthestParent(from: vscode.Uri, uris: vscode.Uri[]) {
  return findMatchingParent(from, uris, (a, b) => {
    if (a.path < b.path) {
      return a;
    } else {
      return b;
    }
  });
}

/**
 * Filter a given set of URI's down to the set of shortest distinct paths.
 *
 * For example, given the input:
 *
 * ["/root-1/b", "/root-1/b/c", "/root-2/b", "/root-2/b/c"]
 *
 * Produce the output:
 *
 * ["/root-1/b", "/root-2/b"]
 *
 * Removing the longer trailing paths.
 */
export function filterShortestDistinctPaths(uris: vscode.Uri[]) {
  return Array.from(
    uris
      .reduce((uris, uri) => {
        let distinct = true;
        Array.from(uris.values()).forEach((previous) => {
          if (previous.path.startsWith(uri.path)) {
            distinct = false;
            uris.delete(previous.path);
            uris.set(uri.path, uri);
          }
          if (uri.path.startsWith(previous.path)) {
            distinct = false;
          }
        });
        if (distinct) {
          uris.set(uri.path, uri);
        }
        return uris;
      }, new Map<string, vscode.Uri>())
      .values()
  );
}

const groupByProject = (uris: vscode.Uri[]) => {
  return Object.values(
    _.groupBy(uris, (uri) => {
      return vscode.workspace.getWorkspaceFolder(uri)?.uri.path;
    })
  );
};

const groupsToChoices = (groups: vscode.Uri[][]) => {
  return groups.reduce((choices: (vscode.QuickPickItem & { value?: vscode.Uri })[], uris) => {
    choices.push({
      kind: vscode.QuickPickItemKind.Separator,
      label: 'Workspace Root',
    });

    const items = uris.map((uri) => {
      return {
        label: getPathRelativeToWorkspace(uri),
        value: uri,
      };
    });

    choices.push(...items);

    return choices;
  }, []);
};

function groupContainsUri(uris: vscode.Uri[], uri: vscode.Uri) {
  return !!uris.find((next) => next.path === uri.path);
}

function sortPreSelectedFirst(groups: vscode.Uri[][], selected: vscode.Uri) {
  // First sort the groups, bringing the group containing the preselected item to the top.
  const sorted_groups = groups.sort((a, b) => {
    if (!selected) {
      return 0;
    }
    if (groupContainsUri(a, selected)) {
      return -1;
    }
    if (groupContainsUri(b, selected)) {
      return 1;
    }
    return 0;
  });

  // Next sort the items within each group, first attempting to bring the preselected item to the top and then
  // falling back to sorting by path length
  return sorted_groups.map((group) => {
    const [root, ...remaining] = group;

    const sorted = remaining.sort((a, b) => {
      // Try bring the pre-selected entry to the top
      if (selected) {
        if (a.path === selected.path) {
          return -1;
        }
        if (b.path === selected.path) {
          return 1;
        }
      }

      const length_a = a.path.split('/').length;
      const length_b = b.path.split('/').length;

      // Fall back to sorting by length
      if (length_a < length_b) {
        return -1;
      }
      if (length_a > length_b) {
        return 1;
      }

      return 0;
    });

    return [root, ...sorted];
  });
}

export async function pickProjectRoot(
  uris: vscode.Uri[],
  selected: vscode.Uri,
  connectType?: ConnectType
) {
  let menuTitle: string;
  switch (connectType) {
    case ConnectType.Connect:
      menuTitle = 'Connect: Project Root';
      break;
    case ConnectType.JackIn:
      menuTitle = 'Jack-in: Project Root';
      break;
    default:
      menuTitle = 'Project Root';
  }
  if (uris.length === 0) {
    return;
  }
  if (uris.length === 1) {
    return uris[0];
  }

  const grouped = groupByProject(uris);
  const sorted = sortPreSelectedFirst(grouped, selected);
  const choices = groupsToChoices(sorted);

  const picker = vscode.window.createQuickPick();
  picker.items = choices;
  picker.title = `${menuTitle}`;
  picker.placeholder = 'Pick the Clojure project you want to use as the root';
  picker.activeItems = choices.filter((root) => root.value?.path === selected?.path);
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
