import * as expect from 'expect';
import * as util from '../../../file-switcher/util';
import * as path from 'path';

describe('getNewSourcePath', () => {
    it('should get new source path for maven style src folder', () => {
        const filePath = path.join('~', 'test.check', 'src', 'test', 'clojure', 'clojure', 'test', 'check', 'generators_test.cljc');
        const expected = path.join('~', 'test.check', 'src', 'main', 'clojure', 'clojure', 'test', 'check');
        expect(util.getNewSourcePath(filePath)).toBe(expected);
    });
    it('should get new source path for maven style test folder', () => {
        const filePath = path.join('~', 'test.check', 'src', 'main', 'clojure', 'clojure', 'test', 'check', 'generators.cljc');
        const expected = path.join('~', 'test.check', 'src', 'test', 'clojure', 'clojure', 'test', 'check');
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
});

describe('isFileValid', () => {
    it('should return true if the file path is valid', () => {
        const filePath = path.join('~', 'leiningen', 'src', 'leiningen', 'change.clj');
        expect(util.isFileValid(filePath)).toBeTruthy();
    });
    it('should return false if the file path is valid', () => {
        const filePath = path.join('~', 'leiningen', 'main.cljc');
        expect(util.isFileValid(filePath)).toBeFalsy();
        const anotherFilePath = path.join('~', 'leiningen', 'src', 'leiningen', 'foo');
        expect(util.isFileValid(anotherFilePath)).toBeFalsy();
    });
});