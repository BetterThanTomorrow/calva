import * as mock from './mock';
import { ModelEditSelection } from '../../../cursor-doc/model';

/**
 * Utility function to get text and selection from dot-notated strings
 * Only handles translation of `•` to newline and `|` to selection for now
 * Also only considers left->right selections for now (left is anchor)
 */
export function dotToNl(s: string): [string, ModelEditSelection] {
    const text = s.replace(/•/g, '\n').replace(/\|/, '');
    const left = s.indexOf('|');
    let right = s.lastIndexOf('|');
    if (right === left) {
        right = undefined;
    } else {
        right--;
    }
    return [
        text,
        new ModelEditSelection(left, right)
    ];
}

/**
 * Utility function to create a doc from dot-notated strings
 * Only handles translation of `•` to newline and `|` to selection for now
 */
export function docFromDot(s: string): mock.MockDocument {
    const [text, selection] = dotToNl(s);
    const doc = new mock.MockDocument();
    doc.insertString(text);
    doc.selection = selection;
    return doc;
}

/**
 * Utility function to create a comparable structure with the text and 
 * selection from a document
 */
export function textAndSelection(doc: mock.MockDocument): [string, [number, number]] {
    return [doc.model.getText(0, Infinity), [doc.selection.anchor, doc.selection.active]]
}
