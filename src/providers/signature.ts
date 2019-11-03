import { TextDocument, Position, CancellationToken, SignatureHelp, SignatureHelpProvider, SignatureInformation } from 'vscode';
import select from '../select';
import * as util from '../utilities';
import * as infoparser from './infoparser';

export class CalvaSignatureHelpProvider implements SignatureHelpProvider {

    async provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp> {
        let text = util.getWordAtPosition(document, position);

        if (util.getConnectedState()) {
            const ns = util.getNamespace(document),
                currentFormSelection = select.getFormSelection(document, position, false),
                currentForm = document.getText(currentFormSelection);

            let symbol = this.getSymbol(currentForm);
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

    private getSymbol(str: string): string {
        let pos = str.indexOf(' ');
        if (pos === -1) {
            return undefined;
        }
        return str.substr(0, pos).trim();
    }
}