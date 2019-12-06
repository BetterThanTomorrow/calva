import * as model from '../../../cursor-doc/model';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor'


export class MockDocument implements model.EditableDocument {
    selectionStart: number; 
    selectionEnd: number;

    get selection() {
        return new model.ModelEditSelection(this.selectionStart, this.selectionEnd);
    }

    set selection(sel: model.ModelEditSelection) {
        this.selectionStart = sel.anchor;
        this.selectionEnd = sel.active;
    }

    model: model.LineInputModel = new model.LineInputModel();

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