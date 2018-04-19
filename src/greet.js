const state = require('./state');

function activationGreetings(chan) {
    chan.appendLine("Calva activated. Happy Clojure coding! ❤️");
    chan.appendLine("Please file any feature requests or bug reports here: https://github.com/PEZ/clojure4vscode/issues");
    chan.appendLine("I will also respond to any @pez mentions in the #editors channel of the Clojurians Slack: https://clojurians.slack.com/messages/editors/");
    chan.appendLine("");
    chan.appendLine("NOTE: Files are no longer automatically evaluated when opened. You will need to issue the evaluate file command at will instead.");
    chan.appendLine("NOTE: The evaluate file command does not seem to work in shadow-cljs clojurescript repls. A workaround, that someetimes suffices, is to select all contents of the file and evaluate it.");
    chan.appendLine("");

    if (!state.config().lint) {
        chan.appendLine("NOTE: Autolinting is disabled. You need to enable \"calva.lintOnSave\" in your editor settings to use it. But first install Joker: https://github.com/candid82/joker")
    }
    chan.appendLine("-".repeat(3));
}

module.exports = {
    activationGreetings
};