import { SignatureInformation, ParameterInformation } from 'vscode';
import * as tokenCursor from '../webview/token-cursor';

export class REPLInfoParser {
    private _name: string = undefined;

    private _arglist: string = undefined;

    private _formsString: string = undefined;

    private _docString: string = undefined;

    private _specialForm: boolean = false;

    constructor(msg: any) {
        if (msg) {
            this._name = '';
            if (msg.name) {
                this._name = msg.name;
                if (msg.ns) {
                    if (msg.ns !== msg.name) {
                        this._name = msg.ns + '/' + this._name;
                    }
                }
            }
            if (msg.class) {
                this._name = msg.class;
                if (msg.member) {
                    this._name += '/' + msg.member;
                }
            }
            if (msg["special-form"]) {
                this._specialForm = true;
                this._arglist = undefined;
                this._formsString = msg["forms-str"];
            } else {
                this._specialForm = false;
                this._arglist = msg["arglists-str"];
                this._formsString = undefined;
            }
            if (msg.doc) {
                this._docString = msg.doc;
            }
        }
    }

    private formatName(value: string) {
        if (value && value != "") {
            let result = '';
            // Format the name.
            result += '**' + value + '**  ';
            if (this._specialForm) {
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

    private getParameters(symbol: string, argList: string): ParameterInformation[] {
        const offsets = this.getParameterOffsets(symbol, argList);
        if (offsets !== undefined) {
            return offsets.map(o => {
                return new ParameterInformation(o);
            })
        }
    }

    private getParameterOffsets(symbol: string, argList: string): [number, number][] {
        const cursor: tokenCursor.LispTokenCursor = tokenCursor.createStringCursor(argList);
        if (cursor.downList()) {
            const ranges = cursor.rangesForSexpsInList('[');
            if (ranges !== undefined) {
                const symbolOffset = symbol.length + 2;
                // We need to keep track of special `& args` and treat it as one argument
                let previousArg: [string, [number, number]];
                return ranges
                    .map(r => {
                        const columnOffset: [number, number] = [r[0][1], r[1][1]];
                        const arg = argList.slice(...columnOffset);
                        const argOffset = [
                            arg,
                            [
                                previousArg !== undefined && previousArg[0] === '&' ? previousArg[1][0]: columnOffset[0] + symbolOffset,
                                columnOffset[1] + symbolOffset
                            ]
                        ] as [string, [number, number]];
                        previousArg = argOffset;
                        return argOffset;
                    }).filter(argOffset => {
                        return argOffset[0] !== '&';
                    }).map(argOffset => {
                        return argOffset[1];
                    });
            }
        }
    }

    getHover(): string {
        let result = '';
        if (this._name !== '') {
            result += this.formatName(this._name);
            result += '\n';
            if (this._specialForm) {
                if (this._formsString) {
                    result += this.formatFormsString(this._formsString);
                    result += '\n\n';
                    result += '\n\n';
                }
            } else {
                if (this._arglist) {
                    result += this.formatArgList(this._arglist);
                    result += '\n\n';
                    result += '\n\n';
                }
            }
            let docString = this.formatDocString(this._docString);
            if (docString == '') {
                docString = "No documentation available"
            }
            result += docString;
            result += '  ';
        }
        return result;
    }

    getHoverNotAvailable() {
        let result = '';
        if (this._name !== '') {
            result += this.formatName(this._name);
            result += '\n';
            result += 'No information available';
        }
        return result;
    }

    getCompletion(): [string, string] {
        if (this._name !== '') {
            let docString = this.formatDocString(this._docString);
            if (docString == '') {
                docString = undefined;
            }
            if (this._specialForm) {
                return [docString, this._formsString];
            } else {
                return [docString, this._arglist];
            }
        }
        return [undefined, undefined];
    }

    getSignatures(symbol: string): SignatureInformation[] {
        if (this._name !== '') {
            const argLists = this._specialForm ? this._formsString : this._arglist;
            if (argLists) {
                return argLists.split('\n')
                    .map(argList => argList.trim())
                    .map(argList => {
                        if (argList !== '') {
                            const signature = new SignatureInformation(this._specialForm ? argList : `(${symbol} ${argList})`);
                            if (!this._specialForm) {
                                signature.parameters = this.getParameters(symbol, argList);
                            }
                            return signature;
                        }
                    });
            }
        }
        return undefined;
    }
}

export function getHover(msg: any): string {
    return new REPLInfoParser(msg).getHover();
}

export function getHoverNotAvailable(text: string): string {
    return new REPLInfoParser({ name: text }).getHoverNotAvailable();
}

export function getCompletion(msg: any): [string, string] {
    return new REPLInfoParser(msg).getCompletion();
}

export function getSignatures(msg: any, symbol: string): SignatureInformation[] {
    return new REPLInfoParser(msg).getSignatures(symbol);
}