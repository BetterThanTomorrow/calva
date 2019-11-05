import { TextDocument, Position, CancellationToken, SignatureHelp, SignatureHelpProvider, SignatureInformation } from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import { LispTokenCursor } from '../webview/token-cursor';
import * as docMirror from '../calva-fmt/src/docmirror';

export class CalvaSignatureHelpProvider implements SignatureHelpProvider {
    async provideSignatureHelp(document: TextDocument, position: Position, _token: CancellationToken): Promise<SignatureHelp> {
        if (util.getConnectedState()) {
            const ns = util.getNamespace(document),
                symbol = this.getSymbol(document, document.offsetAt(position));
            if (symbol) {
                const client = util.getSession(util.getFileType(document));
                if (client) {
                    await util.createNamespaceFromDocumentIfNotExists(document);
                    const res = await client.info(ns, symbol),
                        signatures = infoparser.getSignature(res);
                    if(signatures) {
                        const help = new SignatureHelp();
                        help.signatures = signatures;
                        return(help);
                    }
                }

            }
        }
    }

    private getSymbol(document: TextDocument, idx: number): string {
        const cursor: LispTokenCursor = docMirror.getDocument(document).getTokenCursor(idx);
        if (cursor.backwardListOfType('(')) {
            cursor.forwardWhitespace();
            const symbol = cursor.getToken();
            if (symbol.type === 'id') {
                return symbol.raw;
            }
        }
    }
}