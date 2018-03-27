function activationGreetings(chan) {
    chan.appendLine("Clojure 4 VS Code activated. Happy coding! ❤️");
    chan.appendLine("Please file any feature requests or bug reports here: https://github.com/PEZ/clojure4vscode/issues");
    chan.appendLine("I will also respond to any @pez mentions in the #editors channel of the Clojurians Slack: https://clojurians.slack.com/messages/editors/");
    chan.appendLine("");
    chan.appendLine("Note: Autolinting is now diabled by default. You need to enable \"clojure4vscode.lintOnSave\" in your editor settings to use it. But first install Joker: https://github.com/candid82/joker")
    chan.appendLine("-".repeat(25));
}

module.exports = {
    activationGreetings
};