import * as vscode from 'vscode';
import * as config from './config';

export function activationGreetings(chan: vscode.OutputChannel) {
  const conf = config.getConfig();
  const jackInDependencyVersions = conf.jackInDependencyVersions;
  const clojureLspVersion = conf.clojureLspVersion;
  const clojureLspPath = conf.clojureLspPath;

  if (conf.showCalvaSaysOnStart) {
    chan.show(true);
  }

  chan.appendLine('Welcome to Calva. Happy Clojure and ClojureScript coding! ❤️');
  chan.appendLine('');
  chan.appendLine('Please check these resources out:');
  chan.appendLine('  Calva Documentation: https://calva.io/');
  chan.appendLine('  #calva at the Clojurians Slack: https://clojurians.slack.com/messages/calva/');
  chan.appendLine('  Bug reports: https://github.com/BetterThanTomorrow/calva/issues');
  chan.appendLine('');
  chan.appendLine(
    'If you like Calva, please consider how you can contribute: https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute'
  );
  chan.appendLine('');
  chan.appendLine(
    'Calva is utilizing cider-nrepl and clojure-lsp to create this VS Code experience.'
  );
  chan.appendLine('  nREPL dependencies configured:');
  for (const dep in jackInDependencyVersions) {
    chan.appendLine(`    ${dep}: ${jackInDependencyVersions[dep]}`);
  }
  if (clojureLspPath) {
    chan.appendLine(`  clojure-lsp path configured: ${clojureLspPath}`);
  } else {
    chan.appendLine(`  clojure-lsp version configured: ${clojureLspVersion}`);
  }
  chan.appendLine('');
  chan.appendLine('If you are new to Calva, please see: https://calva.io/getting-started/');
  chan.appendLine(
    '  And please consider the command: **Calva: Create a Getting Started REPL project**'
  );
  chan.appendLine('');
  chan.appendLine(
    'Calva version used: v' +
      vscode.extensions.getExtension('betterthantomorrow.calva').packageJSON.version
  );
}
