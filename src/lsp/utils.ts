import * as vscode_lsp from 'vscode-languageclient/node';
import { LspStatus, LspClient } from './definitions';
import * as roots from '../project-root';
import * as vscode from 'vscode';

/**
 * This will try find the most appropriate project root to use for any given document URI. This is done
 * by looking for the root-most clojure project which is still a parent of the given URI and then will
 * fall back to using the workspace root if no valid projects are found.
 *
 * For example given the following project structure:
 *
 * ---
 * root/
 *  deps.edn
 *  projects/
 *   a/
 *    deps.edn
 *    src/
 *      core.clj
 * ---
 *
 * If `core.clj` is used then it would make the most sense to start the lsp in `root/`.
 * if however `root/deps.edn` were to not exist then it would make sense to start in `root/projects/a/`.
 */
export const findClojureProjectRootForUri = async (
  uri: vscode.Uri
): Promise<vscode.Uri | undefined> => {
  const uris = await roots.findProjectRoots({
    // We exclude workspace roots so that we can look for only valid clojure projects. We manually fallback to
    // using the projects workspace root if no project is found.
    include_workspace_folders: false,
    include_lsp_directories: true,
  });

  const furthest = roots.findFurthestParent(uri, uris);
  if (furthest) {
    return furthest;
  }

  return vscode.workspace.getWorkspaceFolder(uri)?.uri;
};

export const lspClientStateToStatus = (state: vscode_lsp.State): LspStatus => {
  switch (state) {
    case vscode_lsp.State.Stopped: {
      return LspStatus.Stopped;
    }
    case vscode_lsp.State.Starting: {
      return LspStatus.Starting;
    }
    case vscode_lsp.State.Running: {
      return LspStatus.Running;
    }
  }
};
