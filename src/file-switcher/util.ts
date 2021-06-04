import * as path from 'path';

function isFileValid(openedFilename) {
    const fullFileName = openedFilename.split(path.sep).slice(-1)[0];
    return (openedFilename.includes('src')
        || openedFilename.includes('test'))
        && (fullFileName.includes('.'));
}

function getNewFilename(fileName, extension) {
    if (fileName.includes('_test')) {
        const strippedFileName = fileName.replace('_test', '');
        return `${strippedFileName}${extension}`;
    }
    return `${fileName}_test${extension}`;
}

function getNewSourcePath(sourcePath) {
    let replacedSourcePath = '';
    const srcMainPath = path.join('src', 'main');
    const srcTestPath = path.join('src', 'test');

    if (sourcePath.includes(srcMainPath)) {
        replacedSourcePath = sourcePath.replace(srcMainPath, srcTestPath);
    } else if (sourcePath.includes(srcTestPath)) {
        replacedSourcePath = sourcePath.replace(srcTestPath, srcMainPath);
    } else if (sourcePath.includes('src')) {
        replacedSourcePath = sourcePath.replace('src', 'test');
    } else if (sourcePath.includes('test')) {
        replacedSourcePath = sourcePath.replace('test', 'src');
    }
    return path.dirname(replacedSourcePath);
}

export {
    isFileValid,
    getNewFilename,
    getNewSourcePath
};