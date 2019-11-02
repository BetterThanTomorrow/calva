

export class REPLInfoParser {

    private _name: string = undefined;

    private _arglist: string = undefined;

    private _formsString: string = undefined;

    private _docString: string = undefined;

    private _specialForm: boolean = false;

    constructor(msg: any) {

        if (msg) {
            this._name = '';
            if(msg.name) {
                this._name = msg.name;
                if(msg.ns) {
                    if(msg.ns !== msg.name) {
                       this._name = msg.ns + '/' + this._name;
                    }
                }
            } 
            if(msg.class) {
                this._name = msg.class; 
                if(msg.member) {
                    this._name += '/' + msg.member;
                }
            }
            if(msg["special-form"]) {
                this._specialForm = true;
                this._arglist = undefined;
                this._formsString = msg["forms-str"];
            } else {
                this._specialForm = false;
                this._arglist = msg["arglists-str"];
                this._formsString = undefined;
            }
            if(msg.doc) {
                this._docString = msg.doc;
            }
        }
    }

    private formatName(value: string) {

        if (value && value != "") {
            let result = '';
            // Format the name.
            result += '**' + value + '**  ';
            if(this._specialForm) {
                result += '(special form)'; 
            }
            return result;
        }
        return '';
    }

    private formatFormsString(value: string) {

        if (value && value != "") {
            let result = '';
            // Format the different signatures for the fn
            result += value.substring(0, value.length)
                .replace(/\)/g, ')')
                .replace(/\(/g, '* (');
            return result;
        }
        return '';
    }

    private formatArgList(value: string) {

        if (value && value != "") {
            let result = '';
            // Format the different signatures for the fn
            result += value.substring(0, value.length)
                .replace(/\]/g, ']')
                .replace(/\[/g, '* [');
            return result;
        }
        return '';
    }

    private formatDocString(value: string) {

        if (value && value != "") {
            let result = '';
            // Format the actual docstring
            result += value.replace(/\s\s+/g, ' ');
            return result;
        }
        return "";
    }

    getHover(): string {

        let result = '';
        if(this._name !== '') {
            result += this.formatName(this._name);
            result += '\n';
            if(this._specialForm) {
                if(this._formsString) {
                    result += this.formatFormsString(this._formsString); 
                    result += '\n\n';
                    result += '\n\n';
                }
            } else {
                if(this._arglist) {
                    result += this.formatArgList(this._arglist); 
                    result += '\n\n';
                    result += '\n\n';
                } 
            }
            let docString = this.formatDocString(this._docString);
            if (docString == '') {
                docString ="No documentation available"
            }
            result += docString;
            result += '  '; 
        }
        return result;
    }

    getHoverNotAvailable() {
        let result = '';
        if(this._name !== '') {
            result += this.formatName(this._name);
            result += '\n';
            result += 'No information available';
        }
        return result;   
    }

    getCompletion(): [string, string] {

        if(this._name !== '') {
            let docString = this.formatDocString(this._docString);
            if(docString == '') {
                docString = undefined;
            }
            if(this._specialForm) {
                return [docString, this._formsString];
            } else {
               return [docString, this._arglist];
            }
        }
        return [undefined, undefined];
    }
}

export function getHover(msg: any): string {
    return new REPLInfoParser(msg).getHover();
}

export function getHoverNotAvailable(text: string): string {
    return new REPLInfoParser({name: text}).getHoverNotAvailable();
}

export function getCompletion(msg: any): [string, string] {
    return new REPLInfoParser(msg).getCompletion(); 
}