import * as path from 'path';

type DocumentLike = {
  languageId: string;
  uri: { scheme: string; fsPath: string };
};

export function isClojureDocument(document: DocumentLike) {
  return document.languageId === 'clojure' && document.uri.scheme !== 'untitled';
}

function isWithin(parent_path: string, child_path: string) {
  const relative = path.relative(parent_path, child_path);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

type ClojureWorkspaceFolderParams = {
  folder_path: string;
  project_root_paths: string[];
  open_clojure_document_paths: string[];
};

export function isClojureWorkspaceFolder(params: ClojureWorkspaceFolderParams) {
  const within_folder = (candidate: string) => isWithin(params.folder_path, candidate);
  return (
    params.project_root_paths.some(within_folder) ||
    params.open_clojure_document_paths.some(within_folder)
  );
}
