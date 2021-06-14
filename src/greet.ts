import * as vscode from 'vscode';
import * as config from './config';

export function activationGreetings(chan: vscode.OutputChannel) {
    const conf = config.getConfig();
    const jackInDependencyVersions = conf.jackInDependencyVersions;
    const clojureLspVersion = conf.clojureLspVersion;

    if (conf.showCalvaSaysOnStart) {
        chan.show();
    }

    chan.appendLine("Welcome to Calva. Happy Clojure and ClojureScript coding! ❤️")
    chan.appendLine("");
    chan.appendLine("Please check these resources out:");
    chan.appendLine("  Calva Documentation: https://calva.io/");
    chan.appendLine("  #calva at the Clojurians Slack: https://clojurians.slack.com/messages/calva/");
    chan.appendLine("  Bug reports: https://github.com/BetterThanTomorrow/calva/issues");
    chan.appendLine("");
    chan.appendLine("If you like Calva, please consider how you can contribute: https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute");
    chan.appendLine("");
    chan.appendLine("Calva is utilizing cider-nrepl and clojure-lsp to create this VS Code experience.");
    chan.appendLine("  nREPL dependencies configured:");
    for (const dep in jackInDependencyVersions) {
        chan.appendLine(`    ${dep}: ${jackInDependencyVersions[dep]}`)
    }
    chan.appendLine(` clojure-lsp version configured:  ${clojureLspVersion}`);
    chan.appendLine("");
    chan.appendLine("If you are new to Calva, please consider starting with the command:");
    chan.appendLine("  **Calva: Fire up the Getting Started REPL**");
    chan.appendLine("  https://calva.io/getting-started/");    
    chan.appendLine("");
    chan.appendLine("(See `showCalvaSaysOnStart` in Settings to control the auto-showing of this message panel.)");
}