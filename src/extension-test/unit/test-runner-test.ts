import * as expect from 'expect';
import * as cider from '../../nrepl/cider';

describe('test result processing', () => {
    it('shows a summary', () => {

        expect(cider.summaryMessage({
            ns: 0, var: 0, test: 0, pass: 0, fail: 0, error: 0
        })).toBe("No tests found. 😱, ns: 0, vars: 0");

        expect(cider.summaryMessage({
            ns: 1, var: 1, test: 1, pass: 1, fail: 0, error: 0
        })).toBe("1 tests finished, all passing 👍, ns: 1, vars: 1");

        expect(cider.summaryMessage({
            ns: 1, var: 2, test: 3, pass: 4, fail: 5, error: 6
        })).toBe("3 tests finished, problems found. 😭 errors: 6, failures: 5, ns: 1, vars: 2");

    });

    it('can merge results', () => {

        expect(cider.totalSummary([])).toMatchObject({
            test: 0, error: 0, ns: 0, var: 0, fail: 0, pass: 0
        });

        expect(cider.totalSummary([
            { test: 0, error: 0, ns: 0, var: 0, fail: 0, pass: 0 },
            { test: 0, error: 0, ns: 0, var: 0, fail: 0, pass: 0 }
        ])).toMatchObject({
            test: 0, error: 0, ns: 0, var: 0, fail: 0, pass: 0
        });

        expect(cider.totalSummary([
            { test: 1, error: 2, ns: 3, var: 5, fail: 7, pass: 11 },
            { test: 13, error: 17, ns: 19, var: 23, fail: 29, pass: 31 }
        ])).toMatchObject({
            test: 14, error: 19, ns: 22, var: 28, fail: 36, pass: 42
        });

    });

    it('can produce detailed messages', () => {

        expect(cider.detailedMessage({
            type: 'pass',
            ns: 'core',
            context: 'ctx',
            index: 0,
            var: 'test',
            message: ''
        })).toBe('');

        expect(cider.detailedMessage({
            type: 'fail',
            ns: 'core',
            context: 'ctx',
            index: 1,
            expected: 'apple',
            actual: 'orange',
            var: 'test',
            file: 'core.clj',
            line: 7,
            message: 'an extra message'
        })).toBe(
            `; FAIL in core/test (core.clj:7):
; ctx: an extra message
; expected:
apple
; actual:
orange`);


        expect(cider.detailedMessage({
            type: 'error',
            ns: 'core',
            context: 'ctx',
            index: 1,
            expected: 'apple',
            actual: 'orange',
            var: 'test',
            error: 'shoes fell off',
            file: 'impl.clj',
            line: 9,
            message: 'an extra message'
        })).toBe(
            `; ERROR in core/test (line 9):
; ctx: an extra message
; error: shoes fell off (impl.clj)
; expected:
apple`);


    });

});
