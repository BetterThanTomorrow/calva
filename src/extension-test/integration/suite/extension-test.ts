import * as assert from 'assert';
import { expect } from 'chai';
import { after } from 'mocha';
import * as path from 'path';
import * as util from './util';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';
import * as calvaState from '../../../state';

vscode.window.showInformationMessage('Tests running. Yay!');

suite('Extension Test Suite', () => {
    after(() => {
        vscode.window.showInformationMessage('All tests done!');
    });

    // test("We have a context", async () => {
    //   const context = calvaState.extensionContext; // Makes things croak with message "state.config is not a function"
    //   expect(context).not.undefined("foo");
    //   context.workspaceState.get('selectedCljTypeName')
    // });

    test('open a file and close it again, w/o croaking', async () => {
        expect(vscode.window.activeTextEditor).undefined;
        const testClj = await openFile(path.join(util.testDataDir, 'test.clj'));
        vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        await sleep(1000);
        expect(vscode.window.activeTextEditor).undefined;
    });

    // TODO: Add more smoke tests for the extension
    // TODO: Start building integration test coverage
});

async function openFile(filePath: string) {
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    await sleep(300);

    return editor;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
