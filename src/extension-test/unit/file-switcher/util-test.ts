import * as expect from 'expect';
import * as util from '../../../file-switcher/util';


describe('getNewSourcePath', () => {
    it('should get new source path for maven style src folder', () => {
        const path = '~/test.check/src/test/clojure/clojure/test/check/generators_test.cljc';
        const expected = '~/test.check/src/main/clojure/clojure/test/check';
        expect(util.getNewSourcePath(path)).toBe(expected);
    });
    it('should get new source path for maven style test folder', () => {
        const path = '~/test.check/src/main/clojure/clojure/test/check/generators.cljc';
        const expected = '~/test.check/src/test/clojure/clojure/test/check';
        expect(util.getNewSourcePath(path)).toBe(expected);
    });
    it('should get new source path for leiningen style src folder', () => {
        const path = '~/leiningen/src/leiningen/change.clj';
        const expected = '~/leiningen/test/leiningen';
        expect(util.getNewSourcePath(path)).toBe(expected);
    });
    it('should get new source path for leiningen style test folder', () => {
        const path = '~/leiningen/test/leiningen/change_test.clj';
        const expected = '~/leiningen/src/leiningen';
        expect(util.getNewSourcePath(path)).toBe(expected);
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
});

describe('isFileValid', () => {
    it('should return true if the file path is valid', () => {
        const path = '~/leiningen/src/leiningen/change.clj';
        expect(util.isFileValid(path)).toBeTruthy();
    });
    it('should return true if the file path is valid', () => {
        const path = '~/leiningen/main.cljc';
        expect(util.isFileValid(path)).toBeFalsy();
    });
});