import * as util from '../utilities';
import * as state from '../state';
import { ProviderResult, Location, TextDocument, Position, ReferenceContext, CancellationToken, ReferenceProvider, Uri} from 'vscode';

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
            file: "G:\\repos\\modern-wingchun-website\\src\\clj\\modern_wingchun\\pages.clj",
            dir: "G:\\repos\\modern-wingchun-website",  //util.getProjectDir(document),
            ns: "modern-wingchun.pages",
            name: "Pages",
            column: 13 ,//document.lineAt(position.line).text.indexOf(text),
            line: 11 ,//position.line,
            "ignore-errors": true
        };

        let result = await client.findSymbol(params);

        console.log({ text, document, position, context, token, params, result});

        return new Array<Location>();
    }

}