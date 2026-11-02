import * as mocha from 'mocha';
import * as vscode from 'vscode';

mocha.describe('Scroll Output View to End', () => {
  mocha.it(
    'runs for an Output view, for every Output view, and for an id that names none',
    async () => {
      await vscode.commands.executeCommand('calva.scrollOutputViewToEnd', 'output-view');
      await vscode.commands.executeCommand('calva.scrollOutputViewToEnd', 'output-sidebar');
      await vscode.commands.executeCommand('calva.scrollOutputViewToEnd');
      await vscode.commands.executeCommand('calva.scrollOutputViewToEnd', 'terminal');
    }
  );
});
