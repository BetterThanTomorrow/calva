import * as model from '../../../cursor-doc/model';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor'


export class MockDocument implements model.EditableDocument {
    selectionStart: number; 
    selectionEnd: number;

    get selection() {
        return { anchor: this.selectionStart, active: this.selectionEnd };
    }

    set selection(sel: { anchor: number; active: number; }) {
        this.selectionStart = sel.anchor;
        this.selectionEnd = sel.active;
    }

    model: model.LineInputModel = new model.LineInputModel();

    growSelectionStack: { anchor: number; active: number; }[] = [];

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