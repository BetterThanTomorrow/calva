import * as expect from 'expect';
import { moveTokenCursorToBreakpoint } from '../../../debugger/util';
import * as mock from '../common/mock';
import * as fs from "fs";

function getCoordinates(text: string): (string | number)[] {
    return text.split('\n')[0].split(',').map(s => {
        const coor = s.replace(/;/g, '').trim();
        if (coor.startsWith('"')) {
            return coor.replace(/"/g, '');
        } else {
            return parseInt(coor);
        }
    });
}

function getTestFileText(fileName: string): string {
    return fs.readFileSync(__dirname + '/test-files/' + fileName, 'utf8');
}

describe('Debugger Util', async () => {

    let doc: mock.MockDocument;
    let debugResponse: any;

    beforeEach(() => {
        doc = new mock.MockDocument();

        debugResponse = {
            line: 0,
            column: 0
        };
    });

    // Cider's test cases: https://github.com/clojure-emacs/cider/blob/f1c2a797291fd3d2a44cb32372852950d5ecf8a2/test/cider-debug-tests.el#L82
    describe('moveTokenCursorToBreakpoint', () => {

        function expectBreakpointToBeFound(fileName: string) {
            const docText = getTestFileText(fileName);
            debugResponse.coor = getCoordinates(docText);
            doc.insertString(docText);
            const tokenCursor = doc.getTokenCursor(0);
            moveTokenCursorToBreakpoint(tokenCursor, debugResponse);
            expect(tokenCursor.getPrevToken().raw.endsWith('|')).toBe(true);
        }

        function expectBreakpointToBeFound2(code: string, coor: number[]) {
            doc.insertString(code);
            const tokenCursor = doc.getTokenCursor(0);
            moveTokenCursorToBreakpoint(tokenCursor, { coor });
            expect(tokenCursor.getPrevToken().raw.endsWith('|')).toBe(true);
        }

        it('navigates the clojure sexpresions guided by the given coordinates', () => {
            expectBreakpointToBeFound('simple.clj');
            expectBreakpointToBeFound2('(defn a [] (let [x 1] (inc x|)) {:a 1, :b 2})', [3, 2, 1]);
        });

        it('handles function shorthand', () => {
            expectBreakpointToBeFound('fn-shorthand.clj');
        });

        it('handles map', () => {
            expectBreakpointToBeFound('map.clj');
        });

        it('handles metadata symbol', () => {
            expectBreakpointToBeFound('metadata-symbol.clj');
        });

        it('handles ignored forms', () => {
            expectBreakpointToBeFound('ignored-forms.clj');
        });

        it('handles syntax quote', () => {
            expectBreakpointToBeFound('syntax-quote.clj');
        });

        it('handles syntax quoted map 1', () => {
            expectBreakpointToBeFound('syntax-quoted-map-1.clj');
        });

        it('handles syntax quoted list 1', () => {
            expectBreakpointToBeFound('syntax-quoted-list-1.clj');
        });

        it('handles syntax quoted vector 1', () => {
            expectBreakpointToBeFound('syntax-quoted-vector-1.clj');
        });
    });
});
