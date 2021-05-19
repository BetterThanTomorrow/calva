import * as expect from 'expect';
import { moveTokenCursorToBreakpoint, getProjectStackFrames } from '../../../debugger/util';
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

    describe('moveTokenCursorToBreakpoint', () => {

        let doc: mock.MockDocument;
        let debugResponse: any;

        beforeEach(() => {
            doc = new mock.MockDocument();

            debugResponse = {
                line: 0,
                column: 0
            };
        });

        function expectBreakpointToBeFound(fileName: string) {
            const docText = getTestFileText(fileName);
            debugResponse.coor = getCoordinates(docText);
            doc.insertString(docText);
            const tokenCursor = doc.getTokenCursor(0);
            moveTokenCursorToBreakpoint(tokenCursor, debugResponse);
            expect(tokenCursor.getPrevToken().raw.endsWith('|')).toBe(true);
        }

        it('simple example', () => {
            expectBreakpointToBeFound('simple.clj');
        });

        it('function shorthand', () => {
            expectBreakpointToBeFound('fn-shorthand.clj');
        });

        it('map', () => {
            expectBreakpointToBeFound('map.clj');
        });

        it('metadata symbol', () => {
            expectBreakpointToBeFound('metadata-symbol.clj');
        });

        it('ignored forms', () => {
            expectBreakpointToBeFound('ignored-forms.clj');
        });

        it('syntax quote', () => {
            expectBreakpointToBeFound('syntax-quote.clj');
        });
    });

    describe('getProjectStackFrames', () => {
        const frames = [
            {
                var: 'some/var',
                line: 100,
                flags: ['project', 'repl'],
                file: 'some-file'
            },
            {
                var: 'some/var',
                line: 100,
                flags: ['project', 'repl', 'dup'],
                file: 'some-file'
            },
            {
                var: 'some/var2',
                line: 100,
                flags: ['tooling'],
                file: 'some-file'
            }  
        ];

        it('returns only frames flagged with "project"', () => {
            const projectFrames = getProjectStackFrames(frames);
            const areOnlyProjectFrames = projectFrames.every(frame => frame.flags.includes('project'));
            expect(areOnlyProjectFrames).toBe(true);
        });

        it('returns no duplicate frames', () => {
            const projectFrames = getProjectStackFrames(frames);
            const duplicates = projectFrames.some(frame => frame.flags.includes('dup'));
            expect(duplicates).toBe(false);
        });

        it('returns name, line, flags and file for each frame', () => {
            const projectFrames = getProjectStackFrames(frames);
            const requiredPropsExist = projectFrames.every(frame => {
                return frame.name !== undefined &&
                    frame.line !== undefined &&
                    frame.file !== undefined &&
                    frame.flags !== undefined;
            });
            expect(requiredPropsExist).toBe(true);
        });
    });
});
