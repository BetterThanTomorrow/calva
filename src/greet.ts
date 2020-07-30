export function activationGreetings(chan) {
    chan.appendLine("Happy Clojure(Script) coding! ❤️");
    chan.appendLine("If you like Calva, please consider how you can contribute: https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute");
    chan.appendLine("Please check these resources out:");
    chan.appendLine("* Calva Documentation: https://calva.io/");
    chan.appendLine("* #calva at the Clojurians Slack: https://clojurians.slack.com/messages/calva/");
    chan.appendLine("* Bug reports: https://github.com/BetterThanTomorrow/calva/issues");
    chan.appendLine("--");
    chan.appendLine('Start the REPL with the command *Start Project REPL and connect (aka Jack-in)*.');
    chan.appendLine('  Default keybinding for REPL Jack-in: `ctrl+alt+c ctrl+alt+j`');
    chan.appendLine('  Or connect to a running REPL using `ctrl+alt+c ctrl+alt+c`');
}