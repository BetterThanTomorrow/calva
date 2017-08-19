module.exports = class ClojureLanguageConfiguration {
    constructor() {
        this.wordPattern = /[\w\-\.:<>\*][\w\d\.\\/\-\?<>\*!]+/;
        this.indentationRules = {
            decreaseIndentPattern: undefined,
            increaseIndentPattern: /^\s*\(.*[^)]\s*$/
        }
    }
};
