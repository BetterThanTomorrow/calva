import * as path from 'path';

function isFileValid(fileName, pathAfterRoot) {
  if (!fileName.includes('.')) {
    return {
      success: false,
      message:
        "Toggle between implementation and file command doesn't" +
        ' work with extension-less files.',
    };
  }
  if (!pathAfterRoot.includes('src') && !pathAfterRoot.includes('test')) {
    return {
      success: false,
      message:
        'File path should include src or test to switch between ' + 'implementation and test.',
    };
  }
  return { success: true, message: '' };
}

function getNewFilename(fileName, extension) {
  if (fileName.includes('_test')) {
    const strippedFileName = fileName.replace('_test', '');
    return `${strippedFileName}${extension}`;
  }
  if (fileName.includes('test_')) {
    const strippedFileName = fileName.replace('test_', '');
    return `${strippedFileName}${extension}`;
  }
  return `${fileName}_test${extension}`;
}

function getNewSourcePath(sourcePath) {
  let replacedSourcePath = '';
  const srcMainPath = path.join(path.sep, 'src', 'main', path.sep);
  const srcTestPath = path.join(path.sep, 'src', 'test', path.sep);
  const srcPath = path.sep + 'src' + path.sep;
  const testPath = path.sep + 'test' + path.sep;

  if (sourcePath.includes(srcMainPath)) {
    replacedSourcePath = sourcePath.replace(srcMainPath, srcTestPath);
  } else if (sourcePath.includes(srcTestPath)) {
    replacedSourcePath = sourcePath.replace(srcTestPath, srcMainPath);
  } else if (sourcePath.includes(srcPath)) {
    replacedSourcePath = sourcePath.replace(srcPath, testPath);
  } else if (sourcePath.includes(testPath)) {
    replacedSourcePath = sourcePath.replace(testPath, srcPath);
  }
  return path.dirname(replacedSourcePath);
}

export { isFileValid, getNewFilename, getNewSourcePath };
