import * as path from 'path';

function isPrefix(parentPath: string, filePath: string): boolean {
    const relative = path.relative(parentPath, filePath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function pathToNs(filePath: string): string {
    const extName: string = path.extname(filePath);
    return filePath
        .substring(0, filePath.length - extName.length)
        .replace(/[\/\\]/g, '.')
        .replace(/\_/g, '-');
}

function resolveNsName(sourcePaths: string[], filePath: string): string {
    if (sourcePaths) {
        for (const sourcePath of sourcePaths) {
            if (isPrefix(sourcePath, filePath)) {
                const relative = path.relative(sourcePath, filePath);
                return pathToNs(relative);
            }
        }
    }
    return pathToNs(path.basename(filePath));
}

export { isPrefix, pathToNs, resolveNsName };
