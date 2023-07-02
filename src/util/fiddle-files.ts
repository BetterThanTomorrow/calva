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

export class FiddleMappingException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'FiddleMappingException';
  }
}

function getMapping(
  sourceToFiddleFilePaths: { source: string[]; fiddle: string[] }[],
  projectRootPath: string,
  filePath: string,
  from: 'source' | 'fiddle'
) {
  const mappings = sourceToFiddleFilePaths.filter((mapping) => {
    const mappingRootPath = path.join(projectRootPath, ...mapping[from]);
    return filePath.startsWith(mappingRootPath);
  });
  return mappings.length > 0 ? mappings[0] : undefined;
}

function getMappingRelativePath(projectRootPath: string, filePath: string, mappingPath: string[]) {
  const mappingRootPath = path.join(projectRootPath, ...mappingPath);
  const relativeFilePath = path.relative(mappingRootPath, filePath);
  return relativeFilePath;
}

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

  const mapping = getMapping(sourceToFiddleFilePaths, projectRootPath, filePath, 'source');
  if (mapping === undefined) {
    throw new FiddleMappingException(`No fiddle<->source mapping found for file ${filePath}`);
  }
  const relativeFilePath = getMappingRelativePath(projectRootPath, filePath, mapping.source);
  return path.join(projectRootPath, ...mapping.fiddle, relativeFilePath);
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

  const mapping = getMapping(sourceToFiddleFilePaths, projectRootPath, filePath, 'fiddle');
  if (mapping === undefined) {
    throw new FiddleMappingException(`No fiddle<->source mapping found for file ${filePath}`);
  }
  const rootPath = path.join(projectRootPath, ...mapping.fiddle);
  const relativeFilePath = path.relative(rootPath, filePath);
  const relativeBasePath = relativeFilePath.substring(
    0,
    relativeFilePath.length - path.extname(relativeFilePath).length
  );
  return path.join(projectRootPath, ...mapping.source, relativeBasePath);
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

export function isFiddleFile(
  filePath: string,
  projectRootPath: string,
  sourceToFiddleFilePaths: SourceToFiddleFilePaths
): boolean {
  if (sourceToFiddleFilePaths === null) {
    return path.extname(filePath) === `.${FIDDLE_FILE_EXTENSION}`;
  }
  try {
    const mapping = getMapping(sourceToFiddleFilePaths, projectRootPath, filePath, 'fiddle');
    const rootPath = path.join(projectRootPath, ...mapping.fiddle);
    return filePath.startsWith(rootPath);
  } catch (e) {
    return false;
  }
}
