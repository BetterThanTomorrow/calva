function activationGreetings(chan) {
    chan.appendLine("Clojure 4 VS Code activated. Happy coding! ❤️");
    chan.appendLine("Please file any feature requests or bug reports here: https://github.com/PEZ/clojure4vscode/issues");
    chan.appendLine("I will also respond to any @pez mentions in the #editors shannel of the Clojurians Slack: https://clojurians.slack.com/messages/editors/");
    chan.appendLine("-".repeat(25));
}

module.exports = {
    activationGreetings
};