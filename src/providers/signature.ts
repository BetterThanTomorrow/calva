import { TextDocument, Position, CancellationToken, SignatureHelp, SignatureHelpProvider, SignatureInformation } from 'vscode';
import select from '../select';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import { LispTokenCursor } from '../webview/token-cursor';
const paredit = require('paredit.js');
import * as docMirror from '../calva-fmt/src/docmirror';
import { SSL_OP_NETSCAPE_CA_DN_BUG } from 'constants';


export class CalvaSignatureHelpProvider implements SignatureHelpProvider {

    async provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp> {
        if (util.getConnectedState()) {
            const ns = util.getNamespace(document),
                symbol = this.getSymbol(document, document.offsetAt(position));
            if (symbol && symbol !== '') {
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
        cursor.backwardList();
        const open = cursor.getPrevToken();
        if (open.type === 'open' && open.raw === '(') {
            cursor.forwardWhitespace();
            const symbol = cursor.getToken();
            if (symbol.type === 'id') {
                return symbol.raw;
            }
        }
    }
}