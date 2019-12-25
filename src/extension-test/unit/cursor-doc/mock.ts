import * as model from '../../../cursor-doc/model';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor'


export class MockDocument implements model.EditableDocument {
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

    delete: () => void;

    backspace: () => void;   
}