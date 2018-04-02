module.exports = class ClojureLanguageConfiguration {
    constructor() {
        this.wordPattern = /[^\s()[\]{};"\\]+/;
        this.indentationRules = {
            increaseIndentPattern: /^.*\([^)"]*$/,
            decreaseIndentPattern: undefined
        };
    }
};
