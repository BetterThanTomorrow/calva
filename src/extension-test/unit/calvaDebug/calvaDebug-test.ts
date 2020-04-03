import { expect } from 'chai';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor';
import { getBreakpointTokenCursor } from '../../../calvaDebug';
import * as vscode from 'vscode';

describe('Calva Debug', async () => {

    //const document = await vscode.workspace.openTextDocument('../../../../test-data/calva-debug.clj');
    let debugResponse: any;

    beforeEach(() => {
        debugResponse = {
            line: 0,
            column: 0
        };
    });

    describe('getBreakpointTokenCursor', () => {

        it('should return token cursor at correct offset', async () => {
            //const document = await vscode.workspace.openTextDocument('test-data.clj');
            //const tokenCursor = getBreakpointTokenCursor(document, debugResponse);
        });
    });
});
