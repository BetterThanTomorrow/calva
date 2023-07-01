import * as path from 'path';
import * as fs from 'fs';

export type SourceToFiddleFilePaths = Array<{
  source: string[];
  fiddle: string[];
}> | null;

export const FIDDLE_FILE_EXTENSION = 'fiddle';

const clojureFileExtensions = [
  'clj',
  'cljs',
  'cljc',
  'cljd',
  'cljr',
  'cljx',
  'clojure',
  'joke',
  'bb',
];

export function getFiddleForFilePath(
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
  const sourceMappings = sourceToFiddleFilePaths.filter(({ source, fiddle }) => {
    const sourcePath = path.join(projectRootPath, ...source);
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
