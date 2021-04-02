import * as mock from './mock';
import * as model from '../../../cursor-doc/model';


/**
 * Text Notation for expressing states of a document, including
 * current text and selection. 
 * * Since JavasScript makes it clumsy with multiline strings,
 *   newlines are denoted with a middle dot character: `•`
 * * Selections are denoted like so
 *   * Single position selections are denoted with a single `|`.
 *   * Selections w/o direction are denoted with `|` at the range's boundaries.
 *   * Selections with direction left->right are denoted with `|>|` at the range boundaries
 *   * Selections with direction left->right are denoted with `|<|` at the range boundaries
 */

export function dotToNl(s: string): [string, model.ModelEditSelection] {
    const text = s.replace(/•/g, '\n').replace(/\|?[<>]?\|/g, '');
    let anchor = undefined;
    let active = undefined;
    anchor = s.indexOf('|>|')
    if (anchor >= 0) {
        active = s.lastIndexOf('|>|') - 3;
    } else {
        anchor = s.lastIndexOf('|<|');
        if (anchor >= 0) {
            anchor -= 3;
            active = s.indexOf('|<|');
        } else {
            anchor = s.indexOf('|');
            if (anchor >= 0) {
                active = s.lastIndexOf('|');
                if (active !== anchor) {
                    active -= 1;
                } else {
                    active = undefined;
                }
            }
        }
    }
    return [
        text,
        new model.ModelEditSelection(anchor, active)
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
