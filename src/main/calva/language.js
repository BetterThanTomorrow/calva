export default class ClojureLanguageConfiguration {
    constructor() {
        this.wordPattern = /[^\s()[\]{};"\\]+/;
        this.indentationRules = {
            increaseIndentPattern: /[[({]/,
            decreaseIndentPattern: undefined
        };
    }
};
