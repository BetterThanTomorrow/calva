import * as assert from 'assert';
import { after } from 'mocha';
import * as path from "path";
import * as vscode from "vscode";

const testFolderLocation = "./examples/";

suite("opening file", () => {
    test("", async () => {
        const testClj = await openFile("test.clj");
        //Do stuff with the file
        assert.equal(1, 1);

        vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    })
    
});

async function openFile(fileName :string) {
    const uri = vscode.Uri.file(path.join(__dirname + testFolderLocation + fileName));
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    
    await sleep(500);

    return editor;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }