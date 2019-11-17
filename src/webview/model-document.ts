import { LineInputModel } from "./model";
import { LispTokenCursor } from "./token-cursor";

export interface ModelDocument {
    selectionStart: number,
    selectionEnd: number,
    model: LineInputModel,
    growSelectionStack: [number, number][],
    getTokenCursor: (offset?: number, previous?: boolean) => LispTokenCursor,
    insertString: (text: string) => void,
    getSelection: () => string,
    delete: () => void,
    backspace: () => void
}