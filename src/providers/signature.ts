import { TextDocument, Position, CancellationToken, SignatureHelp, SignatureHelpProvider, SignatureInformation } from 'vscode';
import select from '../select';
import * as util from '../utilities';
import * as infoparser from './infoparser';
const paredit = require('paredit.js');

export class CalvaSignatureHelpProvider implements SignatureHelpProvider {

    async provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp> {
        let text = util.getWordAtPosition(document, position);

        if (util.getConnectedState()) {
            const ns = util.getNamespace(document),
                currentFormSelection = select.getFormSelection(document, position, false),
                toplevelFormSelection = select.getFormSelection(document, position, true),
                currentFormIdx = document.offsetAt(currentFormSelection.start) - document.offsetAt(toplevelFormSelection.start),
                toplevelForm = document.getText(toplevelFormSelection);

            let symbol = this.getSymbol(toplevelForm, currentFormIdx);
            if (symbol && symbol !== '') {
                let client = util.getSession(util.getFileType(document));
                if (client) {
                    await util.createNamespaceFromDocumentIfNotExists(document);
                    let res = await client.info(ns, symbol);
                    let signatures = infoparser.getSignature(res);
                    if(signatures) {
                        let help = new SignatureHelp();
                        help.signatures = signatures;
                        return(help);
                    }
                }

            }
        }
        return undefined;
    }

    private getSymbol(str: string, idx: number): string {

        let toplevelAst = paredit.parse(str);
        if (toplevelAst) {
            let sexps = paredit.walk.containingSexpsAt(toplevelAst, idx);
            if (sexps && sexps.length > 0) {
                for (let i = sexps.length - 1; i >= 0; i--) {
                    let sexp = sexps[i];
                    if (sexp.type === 'list' &&
                        sexp.open === "(") {
                        if (sexp.children[0] &&
                            sexp.children[0].type &&
                            sexp.children[0].source &&
                            sexp.children[0].type === "symbol" &&
                            sexp.children[0].source !== "") {
                            return sexp.children[0].source;
                        }
                    }
                }
            }
        }
        return undefined;
    }
}