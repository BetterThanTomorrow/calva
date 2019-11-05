import { TextDocument, Position, Range, CancellationToken, SignatureHelp, SignatureHelpProvider, SignatureInformation } from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import { LispTokenCursor } from '../webview/token-cursor';
import * as docMirror from '../calva-fmt/src/docmirror';

export class CalvaSignatureHelpProvider implements SignatureHelpProvider {
    async provideSignatureHelp(document: TextDocument, position: Position, _token: CancellationToken): Promise<SignatureHelp> {
        if (util.getConnectedState()) {
            const ns = util.getNamespace(document),
                idx = document.offsetAt(position),
                symbol = this.getSymbol(document, idx);
            if (symbol) {
                const client = util.getSession(util.getFileType(document));
                if (client) {
                    await util.createNamespaceFromDocumentIfNotExists(document);
                    const res = await client.info(ns, symbol),
                        currentArgsRanges = this.getCurrentArgsRanges(document, idx),
                        currentArgIdx = currentArgsRanges.findIndex(range => range.contains(position)),
                        signatures = infoparser.getSignatures(res);
                    if (signatures) {
                        const help = new SignatureHelp();
                        help.signatures = signatures;
                        const activeSignatureIdx = signatures.findIndex(signature => signature.parameters && signature.parameters.length >= currentArgsRanges.length);
                        help.activeSignature = activeSignatureIdx !== -1 ? activeSignatureIdx : signatures.length - 1;
                        if (signatures[help.activeSignature].parameters !== undefined) {
                            help.activeParameter = signatures[help.activeSignature].label.match(/&/) !== null ?
                                Math.min(currentArgIdx, signatures[help.activeSignature].parameters.length - 1) : 
                                currentArgIdx;
                        }
                        return (help);
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

    private getCurrentArgsRanges(document: TextDocument, idx: number): Range[] {
        const cursor: LispTokenCursor = docMirror.getDocument(document).getTokenCursor(idx),
            allRanges = cursor.rangesForSexpsInList('(');
        if (allRanges !== undefined) {
            return allRanges
                .slice(1)
                .map(r => {
                    return new Range(new Position(...r[0]), new Position(...r[1]));
                })
        }
    }

    private findMatchingSignature(signatures: SignatureInformation[], currentArgsCound: number): SignatureInformation {
        return signatures[0];
    }
}