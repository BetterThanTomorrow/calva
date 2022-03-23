import * as expect from 'expect';
import * as util from '../../../file-switcher/util';
import * as path from 'path';

describe('getNewSourcePath', () => {
  it('should get new source path for maven style src folder', () => {
    const filePath = path.join(
      '~',
      'test.check',
      'src',
      'test',
      'clojure',
      'clojure',
      'test',
      'check',
      'generators_test.cljc'
    );
    const expected = path.join(
      '~',
      'test.check',
      'src',
      'main',
      'clojure',
      'clojure',
      'test',
      'check'
    );
    expect(util.getNewSourcePath(filePath)).toBe(expected);
  });
  it('should get new source path for maven style test folder', () => {
    const filePath = path.join(
      '~',
      'test.check',
      'src',
      'main',
      'clojure',
      'clojure',
      'test',
      'check',
      'generators.cljc'
    );
    const expected = path.join(
      '~',
      'test.check',
      'src',
      'test',
      'clojure',
      'clojure',
      'test',
      'check'
    );
    expect(util.getNewSourcePath(filePath)).toBe(expected);
  });
  it('should get new source path for leiningen style src folder', () => {
    const filePath = path.join('~', 'leiningen', 'src', 'leiningen', 'change.clj');
    const expected = path.join('~', 'leiningen', 'test', 'leiningen');
    expect(util.getNewSourcePath(filePath)).toBe(expected);
  });
  it('should get new source path for leiningen style test folder', () => {
    const filePath = path.join('~', 'leiningen', 'test', 'leiningen', 'change_test.clj');
    const expected = path.join('~', 'leiningen', 'src', 'leiningen');
    expect(util.getNewSourcePath(filePath)).toBe(expected);
  });
  it('should handle the case where source path has "src" or "test" keyword in it', () => {
    const filePath = path.join('~', 'tests', 'project-name', 'src', 'change.clj');
    const expected = path.join('~', 'tests', 'project-name', 'test');
    expect(util.getNewSourcePath(filePath)).toBe(expected);
  });
});

describe('getNewFileName', () => {
  it('should get new file name for src file', () => {
    const fileName = 'main';
    const extension = '.clj';
    const expected = 'main_test.clj';
    expect(util.getNewFilename(fileName, extension)).toBe(expected);
  });
  it('should get new file name for test file', () => {
    const fileName = 'utils_test';
    const extension = '.cljs';
    const expected = 'utils.cljs';
    expect(util.getNewFilename(fileName, extension)).toBe(expected);
  });
  it('should handle the case where src file name has multiple dots', () => {
    const fileName = 'one.two.three';
    const extension = '.clj';
    const expected = 'one.two.three_test.clj';
    expect(util.getNewFilename(fileName, extension)).toBe(expected);
  });
  it('should handle the case where test file name has multiple dots', () => {
    const fileName = 'one.two.three_test';
    const extension = '.clj';
    const expected = 'one.two.three.clj';
    expect(util.getNewFilename(fileName, extension)).toBe(expected);
  });
  it('should handle the case where test file starts with "_test"', () => {
    const fileName = 'test_abc';
    const extension = '.cljs';
    const expected = 'abc.cljs';
    expect(util.getNewFilename(fileName, extension)).toBe(expected);
  });
});

describe('isFileValid', () => {
  it('should return true if the file path is valid', () => {
    const fileName = 'change.clj';
    const pathAfterRoot = path.join('src', 'leiningen');
    const { success } = util.isFileValid(fileName, pathAfterRoot);
    expect(success).toBeTruthy();
  });
  it('should return false if the file path is invalid', () => {
    const fileName = 'main.cljc';
    const pathAfterRoot = path.join('');
    let { success } = util.isFileValid(fileName, pathAfterRoot);
    expect(success).toBeFalsy();
    const anotherFileName = 'foo';
    const anotherPathAfterRoot = path.join('leiningen');
    success = util.isFileValid(anotherFileName, anotherPathAfterRoot).success;
    expect(success).toBeFalsy();
  });
});
