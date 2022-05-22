import { SignatureInformation, ParameterInformation, MarkdownString } from 'vscode';
import * as tokenCursor from '../cursor-doc/token-cursor';
import { getConfig } from '../config';

export type Completion =
  | [string, string]
  | [MarkdownString, string | undefined]
  | [undefined, undefined];

export class REPLInfoParser {
  private _name: string | undefined = undefined;

  private _arglist: string | undefined = undefined;

  private _formsString: string | undefined = undefined;

  private _docString: string | undefined = undefined;

  private _specialForm: boolean = false;

  private _isMacro: boolean = false;

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
      if (msg.macro) {
        this._isMacro = true;
      }
      if (msg['arglists-str']) {
        this._arglist = msg['arglists-str'];
      }
      if (msg['forms-str']) {
        this._specialForm = true;
        this._formsString = msg['forms-str'];
      }
      if (msg.doc) {
        this._docString = msg.doc;
      }
    }
  }

  private getParameters(symbol: string, argList: string): ParameterInformation[] | undefined {
    const offsets = this.getParameterOffsets(symbol, argList);
    if (offsets !== undefined) {
      return offsets.map((o) => {
        return new ParameterInformation(o);
      });
    }
  }

  private getParameterOffsets(symbol: string, argList: string): [number, number][] | undefined {
    const cursor: tokenCursor.LispTokenCursor = tokenCursor.createStringCursor(argList);
    if (cursor.downList()) {
      const ranges = cursor.rowColRangesForSexpsInList('[');
      if (ranges !== undefined) {
        const symbolOffset = symbol.length + 2;
        // We need to keep track of special `& args` and treat it as one argument
        let previousArg: [string, [number, number]];
        return ranges
          .map((r) => {
            const columnOffset: [number, number] = [r[0][1], r[1][1]];
            const arg = argList.slice(...columnOffset);
            const argOffset = [
              arg,
              [
                // If the previous arg was a `&` use its start offset instead
                previousArg !== undefined && previousArg[0] === '&'
                  ? previousArg[1][0]
                  : columnOffset[0] + symbolOffset,
                columnOffset[1] + symbolOffset,
              ],
            ] as [string, [number, number]];
            previousArg = argOffset;
            return argOffset;
          })
          .filter((argOffset) => {
            return argOffset[0] !== '&'; // Discard, because its start offset is used for the next arg
          })
          .map((argOffset) => {
            return argOffset[1]; // Only return the offset part
          });
      }
    }
  }

  getHover(): MarkdownString {
    const hover = new MarkdownString();
    if (this._name !== '') {
      if (!this._specialForm || this._isMacro) {
        hover.appendCodeblock(this._name, 'clojure');
        if (this._arglist) {
          hover.appendCodeblock(this._arglist, 'clojure');
        }
      } else {
        if (this._formsString) {
          hover.appendCodeblock(this._formsString, 'clojure');
        }
      }
      if (this._specialForm || this._isMacro) {
        hover.appendText(
          `${this._specialForm ? '(special form) ' : ''}${this._isMacro ? '(macro)' : ''}\n`
        );
      } else {
        hover.appendText('\n');
      }
      hover.appendMarkdown(this._docString || '*(No doc string)*');
    }
    return hover;
  }

  getHoverNotAvailable() {
    let result = '';
    if (this._name !== '') {
      result += this._name;
      result += '\n';
      result += 'No information available';
    }
    return result;
  }

  getCompletion(): Completion {
    const name = new MarkdownString(this._docString);
    if (this._name !== '') {
      if (this._specialForm) {
        return [name, this._formsString];
      } else {
        return [name, this._arglist];
      }
    }
    return [undefined, undefined];
  }

  getSignatures(symbol: string): SignatureInformation[] | undefined {
    if (this._name !== '') {
      const argLists = this._arglist ? this._arglist : this._formsString;
      if (argLists) {
        return argLists
          .split('\n')
          .map((argList) => argList.trim())
          .map((argList) => {
            if (argList !== '') {
              const signature = new SignatureInformation(`(${symbol} ${argList})`);
              // Skip parameter help on special forms and forms with optional arguments, for now
              if (this._arglist && !argList.match(/\?/)) {
                signature.parameters = this.getParameters(symbol, argList);
              }
              if (this._docString && getConfig().showDocstringInParameterHelp) {
                signature.documentation = new MarkdownString(this._docString);
              }
              return signature;
            } else {
              return undefined;
            }
          });
      }
    }
    return undefined;
  }
}

export function getHover(msg: any): MarkdownString {
  return new REPLInfoParser(msg).getHover();
}

export function getHoverNotAvailable(text: string): string {
  return new REPLInfoParser({ name: text }).getHoverNotAvailable();
}

export function getCompletion(msg: any): Completion {
  return new REPLInfoParser(msg).getCompletion();
}

export function getSignatures(msg: any, symbol: string): SignatureInformation[] | undefined {
  return new REPLInfoParser(msg).getSignatures(symbol);
}
