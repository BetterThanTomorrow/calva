import * as util from '../utilities';
import * as state from '../state';
import { ProviderResult, Location, TextDocument, Position, ReferenceContext, CancellationToken, ReferenceProvider, Uri, Range } from 'vscode';

function refToLocation(r: any): Location {
    let startPos = new Position(r[":line-beg"] - 1, r[":col-beg"] - 1);
    let endPos = new Position(r[":line-end"] - 1, r[":col-end"] - 1);
    return new Location(Uri.file(r[":file"]), new Range(startPos, endPos))
}

export default class CalvaReferenceProvider implements ReferenceProvider {
    state: any;
    constructor() {
        this.state = state;
    }

    async provideReferences(document: TextDocument,
        position: Position,
        context: ReferenceContext,
        token: CancellationToken) {
        let text = util.getWordAtPosition(document, position);
        let client = util.getSession(util.getFileType(document));

        let ns = util.getDocumentNamespace(document);

        let params = {
            file: document.uri.fsPath, //"G:\\repos\\modern-wingchun-website\\src\\clj\\modern_wingchun\\pages.clj",
            dir: util.getProjectDir(document),
            ns: ns,
            name: text,
            column: document.lineAt(position.line).text.indexOf(text),
            line: position.line,
        };

        let { refs, count } = await client.findSymbol(params);

        let locs = refs.map(r => refToLocation(r));

        //console.log({ text, document, position, context, token, params, refs});

        return locs;
    }

}