import * as model from '../../../cursor-doc/model';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor'

model.initScanner(20000);

export class MockDocument implements model.EditableDocument {
    isIndentationHealthy = true;
    isStructureHealthy = true;
    selectionLeft: number;
    selectionRight: number;

    get selection() {
        return new model.ModelEditSelection(this.selectionLeft, this.selectionRight);
    }

    set selection(sel: model.ModelEditSelection) {
        this.selectionLeft = sel.anchor;
        this.selectionRight = sel.active;
    }

    model: model.LineInputModel = new model.LineInputModel(1, this);

    selectionStack: model.ModelEditSelection[] = [];

    getTokenCursor(offset?: number, previous?: boolean): LispTokenCursor  {
        return this.model.getTokenCursor(offset);
    };

    insertString(text: string) {
        this.model.insertString(0, text);
    };

    getSelectionText: () => string;

    delete(){
        // TODO: Figure if this mock really should implement this
        //       Maybe this class should be a more complete implementation
        //       in the cursor-doc (i.e. not a test utility)?
        const p = this.selectionLeft;
        return this.model.edit([
            new model.ModelEdit('deleteRange', [p, 1])
        ], { selection: new model.ModelEditSelection(p) });
    };
    
    backspace() {
        // TODO: Figure if this mock really should implement this
        //       Maybe this class should be a more complete implementation
        //       in the cursor-doc (i.e. not a test utility)?
        const p = this.selectionLeft;
        return this.model.edit([
            new model.ModelEdit('deleteRange', [p - 1, 1])
        ], { selection: new model.ModelEditSelection(p - 1) });
    };
}