import * as mocha from 'mocha';
import * as vscode from 'vscode';
import * as testUtil from './util';

// Closes the quick pick until the command, which waits for it, is done
async function closingQuickPick(command: Thenable<unknown>) {
  let done = false;
  void command.then(() => (done = true));
  await testUtil.waitForCondition(async () => {
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    return done;
  });
}

mocha.describe('Scroll Output View to End', () => {
  mocha.it('runs for the Output view its argument names', async () => {
    await vscode.commands.executeCommand('calva.scrollOutputViewToEnd', 'output-view');
    await vscode.commands.executeCommand('calva.scrollOutputViewToEnd', 'output-sidebar');
  });

  mocha.it('asks which Output view without one of their ids', async () => {
    await closingQuickPick(vscode.commands.executeCommand('calva.scrollOutputViewToEnd'));
    await closingQuickPick(
      vscode.commands.executeCommand('calva.scrollOutputViewToEnd', 'terminal')
    );
  });
});
