export function activationGreetings(chan, lintEnabled) {
    chan.appendLine("Happy Clojure(script) coding! ❤️");
    chan.appendLine("Please file any feature requests or bug reports here: https://github.com/BetterThanTomorrow/calva/issues");
    chan.appendLine("I will also respond to any @pez mentions in the #calva-dev channel of the Clojurians Slack: https://clojurians.slack.com/messages/calva-dev/");
    chan.appendLine("");
    if (!lintEnabled) {
        chan.appendLine("")
        chan.appendLine("NOTE: Autolinting is disabled. You need to enable \"calva.lintOnSave\" in your editor settings to use it. But first install Joker: https://github.com/candid82/joker");
    }
    chan.appendLine("--");
}