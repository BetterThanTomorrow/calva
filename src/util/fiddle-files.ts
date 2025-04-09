import * as _ from 'lodash';
import * as path from 'path';

type FiddleFilePath = {
  source: string[];
  fiddle: string[];
};

/**
 * Represents a list of mappings between source files and their corresponding fiddle files.
 * It is used to determine the corresponding fiddle file for a source file and vice versa.
 * The directories are represented as an array of path segments.
 */
export type FiddleFilePaths = Array<FiddleFilePath> | null;

export const FIDDLE_FILE_EXTENSION = 'fiddle';

/**
 * A list of valid Clojure file extensions.
 * This is used when searching for source files corresponding to a fiddle file.
 * The order of the extensions is significant, as it is used to determine the
 * which source file to return when there are multiple source files with the same name.
 */
const clojureFileExtensions = [
  'cljc',
  'clj',
  'cljs',
  'cljd',
  'cljr',
  'bb',
  'ly',
  'cljx',
  'clojure',
  'joke',
];

/**
 * Error thrown when a mapping between a source file and a fiddle file cannot be found.
 * This can occur when calling `getFiddleForSourceFile` or `getSourceForFiddleFile` and
 * the provided mappings do not contain a match for the given file.
 */
export class FiddleMappingException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'FiddleMappingException';
  }
}

function isDedicatedFiddle(mapping: FiddleFilePath) {
  const lastFiddlePathSegment = _.last(mapping.fiddle) || '';
  return lastFiddlePathSegment.match(/\./);
}

/**
 * Helper function used to find the mapping that applies to a given file.
 * Gets the mapping for a given file path, based on the specified direction ('source' or 'fiddle').
 * It will return the first mapping where the file path starts with the mapped path.
 * If no such mapping is found, it returns `undefined`.
 * @note Exported only for testing purposes.
 */
export function _internal_getMapping(
  fiddleFilePaths: FiddleFilePath[],
  projectRootPath: string,
  filePath: string,
  from: 'source' | 'fiddle'
) {
  const mappings = fiddleFilePaths
    // Filter for mappings that match the file path
    .filter((mapping) => {
      const mappingRootPath = path.join(projectRootPath, ...mapping[from]);
      return filePath.startsWith(
        isDedicatedFiddle(mapping) ? mappingRootPath : `${mappingRootPath}${path.sep}`
      );
    })
    // Prioritize mappings with dedicated fiddle files with the same extension as the filePath
    .sort((a: FiddleFilePath, b: FiddleFilePath) => {
      if (isDedicatedFiddle(a) && isDedicatedFiddle(b)) {
        return path.extname(_.last(a.fiddle)) === path.extname(filePath)
          ? -1
          : path.extname(_.last(b.fiddle)) === path.extname(filePath)
          ? 1
          : 0;
      } else {
        return 0;
      }
    })
    // Then prioritize mappings with dedicated fiddle files
    .sort((a: FiddleFilePath, b: FiddleFilePath) => {
      return (isDedicatedFiddle(a) && isDedicatedFiddle(b)) ||
        (!isDedicatedFiddle(a) && !isDedicatedFiddle(b))
        ? 0
        : isDedicatedFiddle(a)
        ? -1
        : 1;
    })
    // Then prioritize mappings with the longest `from` path
    .sort((a: FiddleFilePath, b: FiddleFilePath) => {
      return b[from].length - a[from].length;
    });
  // Pick the first mapping
  return mappings.length > 0 ? mappings[0] : undefined;
}

/**
 * Helper function used to calculate the relative path of a file from its mapping root.
 * Gets the relative path of a file within the mapping path.
 */
function getMappingRelativePath(projectRootPath: string, filePath: string, mappingPath: string[]) {
  const mappingRootPath = path.join(projectRootPath, ...mappingPath);
  const relativeFilePath = path.relative(mappingRootPath, filePath);
  return relativeFilePath;
}

/**
 * Returns the fiddle file for a given source file.
 * If no mappings are provided, it simply changes the extension of the source file to `.fiddle`.
 * If mappings are provided, it uses them to find the corresponding fiddle file.
 *   When the fiddle or a mapping end with a file extension, and the source matches,
 *   the dedicated fiddle file mapped will be returned. Otherwise the fiddle mapping will be treated
 *   as a directory mapping the relative location of the source file.
 * If no mapping can be determined for the given source file, it throws a `FiddleMappingException`.
 */
export function getFiddleForSourceFile(
  filePath: string,
  projectRootPath: string,
  fiddleFilePaths: FiddleFilePaths
): string {
  if (fiddleFilePaths === null) {
    return `${filePath.substring(
      0,
      filePath.length - path.extname(filePath).length
    )}.${FIDDLE_FILE_EXTENSION}`;
  }

  const mapping = _internal_getMapping(fiddleFilePaths, projectRootPath, filePath, 'source');
  if (mapping === undefined || mapping.fiddle === undefined) {
    throw new FiddleMappingException(`No fiddle<->source mapping found for file ${filePath}`);
  }
  if (isDedicatedFiddle(mapping)) {
    return path.join(projectRootPath, ...mapping.fiddle);
  }
  const relativeFilePath = getMappingRelativePath(projectRootPath, filePath, mapping.source);
  return path.join(projectRootPath, ...mapping.fiddle, relativeFilePath);
}

/**
 * Returns the base of the source file for a given fiddle file.
 * If no mappings are provided, it simply removes the extension from the fiddle file.
 * If mappings are provided, it uses them to find the base of the corresponding source file.
 * If no mapping can be determined for the given fiddle file, it throws a `FiddleMappingException`.
 */
export function getSourceBaseForFiddleFile(
  filePath: string,
  projectRootPath: string,
  fiddleFilePaths: FiddleFilePaths
): string {
  if (fiddleFilePaths === null || path.extname(filePath) === `.${FIDDLE_FILE_EXTENSION}`) {
    if (path.extname(filePath) !== `.${FIDDLE_FILE_EXTENSION}`) {
      throw new Error(
        `Expected fiddle file extension to be ${FIDDLE_FILE_EXTENSION}, but was ${path.extname(
          filePath
        )}`
      );
    }
    return filePath.substring(0, filePath.length - path.extname(filePath).length);
  }

  const mapping = _internal_getMapping(fiddleFilePaths, projectRootPath, filePath, 'fiddle');
  if (mapping === undefined) {
    throw new FiddleMappingException(`No fiddle<->source mapping found for file ${filePath}`);
  }
  const lastFiddlePathSegment = _.last(mapping.fiddle) || '';
  if (lastFiddlePathSegment.match(/\./)) {
    return undefined;
  }
  const rootPath = path.join(projectRootPath, ...mapping.fiddle);
  const relativeFilePath = path.relative(rootPath, filePath);
  const relativeBasePath = relativeFilePath.substring(
    0,
    relativeFilePath.length - path.extname(relativeFilePath).length
  );
  return path.join(projectRootPath, ...mapping.source, relativeBasePath);
}

/**
 * Represents a URI with a file system path.
 * This is used to mock the VS Code URI type.
 */
interface Uri {
  fsPath: string;
}

/**
 * Represents a workspace with the ability to find files.
 * This is used to mock the VS Code workspace type.
 */
export interface Workspace {
  findFiles: (pattern: string) => Thenable<Uri[]>;
  asRelativePath: (pathOrUri: string | Uri, includeWorkspaceFolder?: boolean) => string;
}

/**
 * Returns the source file for a given fiddle file.
 * If no mappings are provided, it searches the workspace for a file that has the same base
 * as the fiddle file and one of the provided extensions.
 * The search is done in the order of the extensions array, and the first matching file is returned.
 * If mappings are provided, it uses them to find the corresponding source file.
 */
export async function getSourceForFiddleFile(
  filePath: string,
  projectRootPath: string,
  fiddleFilePaths: FiddleFilePaths,
  workspace: Workspace,
  extensions: string[] = clojureFileExtensions
): Promise<string> {
  const sourceBase = getSourceBaseForFiddleFile(filePath, projectRootPath, fiddleFilePaths);
  console.log(`Searching for source file with base ${sourceBase}`);
  if (sourceBase === undefined) {
    return undefined;
  }
  if (path.extname(filePath) === `.${FIDDLE_FILE_EXTENSION}` || fiddleFilePaths === null) {
    const uris = await workspace.findFiles(
      `${workspace.asRelativePath(sourceBase)}.{${extensions.join(',')}}`
    );
    return uris.sort((a: Uri, b: Uri) => {
      const extA = a.fsPath.split('.').pop() || '';
      const extB = b.fsPath.split('.').pop() || '';
      return extensions.indexOf(extA) - extensions.indexOf(extB);
    })[0].fsPath;
  }
  return `${sourceBase}${path.extname(filePath)}`;
}

/**
 * Checks if a file is a fiddle file based on its extension and mapping.
 * A file is considered a fiddle file if its extension is the fiddle file extension or if
 * it matches a 'fiddle' mapping when such mappings are provided.
 *
 * Without a source->fiddle map:
 * - A .fiddle file anywhere (not limited to the project root) is considered a fiddle file.
 *
 * With a fiddle->source map:
 * - A file (of any extension) located in the fiddle path is considered a fiddle file.
 * - A .fiddle file anywhere in the project (not limited to the fiddle path) is considered a fiddle file.
 * - A file with a non-.fiddle extension outside the fiddle path is not considered a fiddle file.
 *
 * When multiple fiddle->source mappings are provided, a file that matches any of the fiddle paths
 * is considered a fiddle file.
 */
export function isFiddleFile(
  filePath: string,
  projectRootPath: string,
  fiddleFilePaths: FiddleFilePaths
): boolean {
  return (
    path.extname(filePath) === `.${FIDDLE_FILE_EXTENSION}` ||
    (fiddleFilePaths &&
      projectRootPath &&
      _internal_getMapping(fiddleFilePaths, projectRootPath, filePath, 'fiddle') !== undefined)
  );
}
