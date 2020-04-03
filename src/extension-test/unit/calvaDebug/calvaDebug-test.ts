import { expect } from 'chai';
import { moveTokenCursorToBreakpoint } from '../../../debugger/util';
import * as mock from '../common/mock';
import * as fs from "fs";

describe('Calva Debug', async () => {

    let debugResponse: any;
    let doc: mock.MockDocument;

    beforeEach(() => {
        debugResponse = {
            line: 0,
            column: 0
        };
    });

    describe('moveTokenCursorToBreakpoint', () => {

        // it('should return token cursor at correct offset', async () => {
        //     const path = __dirname + '/test-code.clj';
        //     const docText = fs.readFileSync(path, "utf8");
        //     doc.insertString(docText);
        //     const tokenCursor = doc.getTokenCursor(0);
        //     debugResponse.coor = [3, 2];
        //     moveTokenCursorToBreakpoint(tokenCursor, debugResponse);
        //     expect(tokenCursor.getPrevToken().raw).equal('x');
        // });
    });
});
