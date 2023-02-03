const vscode = require('vscode');

exports.run = async () => {
  await vscode.commands.executeCommand('calva.activateCalva');
  return vscode.commands.executeCommand(
    'joyride.runCode',
    "(require '[test-runner :as runner]) (runner/run-all-tests)"
  );
};
