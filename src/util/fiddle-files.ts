import * as path from 'path';

export type SourceToFiddleFilePaths = Array<{
  source: string[];
  fiddle: string[];
}> | null;

export const FIDDLE_FILE_EXTENSION = 'fiddle';

const clojureFileExtensions = [
  'cljc',
  'clj',
  'cljs',
  'cljd',
  'cljr',
  'bb',
  'cljx',
  'clojure',
  'joke',
];

export function getFiddleForSourceFile(
  filePath: string,
  projectRootPath: string,
  sourceToFiddleFilePaths: SourceToFiddleFilePaths
): string {
  if (sourceToFiddleFilePaths === null) {
    return `${filePath.substring(
      0,
      filePath.length - path.extname(filePath).length
    )}.${FIDDLE_FILE_EXTENSION}`;
  }

  const sourceMappings = sourceToFiddleFilePaths.filter((mapping) => {
    const sourcePath = path.join(projectRootPath, ...mapping.source);
    return filePath.startsWith(sourcePath);
  });
  if (sourceMappings.length === 0) {
    throw new Error(`No source->fiddle mapping found for file ${filePath}`);
  }
  const sourceMapping = sourceMappings[0];
  const sourcePath = path.join(projectRootPath, ...sourceMapping.source);
  const relativeFilePath = path.relative(sourcePath, filePath);
  return path.join(projectRootPath, ...sourceMapping.fiddle, relativeFilePath);
}

export function getSourceBaseForFiddleFile(
  filePath: string,
  projectRootPath: string,
  sourceToFiddleFilePaths: SourceToFiddleFilePaths
): string {
  if (sourceToFiddleFilePaths === null) {
    if (path.extname(filePath) !== `.${FIDDLE_FILE_EXTENSION}`) {
      throw new Error(
        `Expected fiddle file extension to be ${FIDDLE_FILE_EXTENSION}, but was ${path.extname(
          filePath
        )}`
      );
    }
    return filePath.substring(0, filePath.length - path.extname(filePath).length);
  }

  const fiddleMappings = sourceToFiddleFilePaths.filter((mapping) => {
    const fiddlePath = path.join(projectRootPath, ...mapping.fiddle);
    return filePath.startsWith(fiddlePath);
  });
  if (fiddleMappings.length === 0) {
    throw new Error(`No fiddle->source mapping found for file ${filePath}`);
  }
  const fiddleMapping = fiddleMappings[0];
  const fiddlePath = path.join(projectRootPath, ...fiddleMapping.fiddle);
  const relativeFilePath = path.relative(fiddlePath, filePath);
  const relativeBasePath = relativeFilePath.substring(
    0,
    relativeFilePath.length - path.extname(relativeFilePath).length
  );
  return path.join(projectRootPath, ...fiddleMapping.source, relativeBasePath);
}

interface Uri {
  fsPath: string;
}

export interface Workspace {
  findFiles: (pattern: string) => Promise<Uri[]>;
}

export async function getSourceForFiddleFile(
  filePath: string,
  projectRootPath: string,
  sourceToFiddleFilePaths: SourceToFiddleFilePaths,
  workspace: Workspace,
  extensions: string[] = clojureFileExtensions
): Promise<string> {
  const sourceBase = getSourceBaseForFiddleFile(filePath, projectRootPath, sourceToFiddleFilePaths);
  console.log('sourceBase', sourceBase);
  if (sourceToFiddleFilePaths === null) {
    const uris = await workspace.findFiles(`${sourceBase}.{${extensions.join(',')}}`);
    return uris.sort((a: Uri, b: Uri) => {
      const extA = a.fsPath.split('.').pop() || '';
      const extB = b.fsPath.split('.').pop() || '';
      return extensions.indexOf(extA) - extensions.indexOf(extB);
    })[0].fsPath;
  }
  return `${sourceBase}${path.extname(filePath)}`;
}
