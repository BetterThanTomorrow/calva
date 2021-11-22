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

function textNotationToTextAndSelection(s: string): [string, { anchor: number, active: number }] {
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
                    active = anchor;
                }
            }
        }
    }
    return [
        text,
        { anchor, active }
    ];
}

/**
 * Utility function to create a doc from text-notated strings
 */
export function docFromTextNotation(s: string): mock.MockDocument {
    const [text, selection] = textNotationToTextAndSelection(s);
    const doc = new mock.MockDocument();
    doc.insertString(text);
    doc.selection = new model.ModelEditSelection(selection.anchor, selection.active);
    return doc;
}

/**
 * Utility function to get the text from a document.
 * @param doc
 * @returns string
 */
export function text(doc: mock.MockDocument): string {
    return doc.model.getText(0, Infinity);
}

/**
 * Utility function to create a comparable structure with the text and
 * selection from a document
 */
export function textAndSelection(doc: mock.MockDocument): [string, [number, number]] {
    return [text(doc), [doc.selection.anchor, doc.selection.active]]
}
