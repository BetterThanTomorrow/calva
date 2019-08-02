import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Range, Selection, TextDocument } from 'vscode';
import * as state from '../../state';
import * as util from '../../utilities';
import * as refactorUtil from "../utils";

export default class CalvaCodeActionProvider implements CodeActionProvider {
    state: any;
    constructor() {
        this.state = state;
    }

    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken) {
        console.log("connected?: " + this.state.deref().get("connected"));
        console.log({ document, range, context});
        if (this.state.deref().get("connected")){
            let res:CodeAction[] = [];
            console.log("isClojureFile?: " + util.isClojureFile(document));
            if (util.isClojureFile(document)){
                let nsRange = refactorUtil.findNamespaceRange(document);

                console.log("contains range/ns?: " + range.contains(nsRange) + " || " + nsRange.contains(range));

                if (range.contains(nsRange) || nsRange.contains(range)) {
                    let nsCode = new CodeAction("Clean NS", CodeActionKind.Empty);
                    nsCode.command = { title: "Clean current NS", command: "calva.cleanNS"};
                    res.push(nsCode);
                } 
            }

            console.log("codeActions:", res);

            return res;
        }
        
        return [];
    }
}