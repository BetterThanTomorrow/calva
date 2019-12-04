import { expect } from 'chai';
import * as paredit from '../../../cursor-doc/paredit';
import { ReplReadline } from '../../../webview/readline';
import * as mock from './mock';

describe('paredit.selectRangeFromSelectionEnd', () => {
    it('grows the selection backwards', () => {
        const doc = new mock.MockDocument();
        doc.insertString('(def foo [:foo :bar :baz])');
        const bazSelection = { anchor: 20, active: 15 },
            barRange = [15, 19] as [number, number],
            barBazSelection = { anchor: 24, active: 15 };
        doc.selection = bazSelection;
        paredit.selectRangeFromSelectionEnd(doc, barRange);
        // expect(doc.selection).deep.equal(barBazSelection);
    });
});

describe('paredit.selectRangeFromSelectionStart', () => {
    it('grows the selection backwards', () => {
        const doc = new mock.MockDocument();
        doc.insertString('(def foo [:foo :bar :baz])');
        const barSelection = { anchor: 15, active: 19 },
            bazRange = [20, 24] as [number, number],
            barBazSelection = { anchor: 15, active: 24 };
        doc.selection = barSelection;
        paredit.selectRangeFromSelectionStart(doc, bazRange);
        expect(doc.selection).deep.equal(barBazSelection);
    });
});

describe('paredit selection stack', () => {
    const doc = new mock.MockDocument();
    doc.insertString('(def foo [:foo :bar :baz])');
    const startSelection = doc.selection,
        range = [15, 20] as [number, number],
        selection = { anchor: range[0], active: range[1] };
    it('selection is topmost element on the stack', () => {
        paredit.growSelectionStack(doc, range);
        expect(doc.growSelectionStack[doc.growSelectionStack.length - 1]).deep.equal(selection);
    });
    it('shrink selection pops the last selection up', () => {
        paredit.shrinkSelection(doc);
        expect(doc.growSelectionStack[doc.growSelectionStack.length - 1]).deep.equal(startSelection);
    });
    it('shrink selection after adding the same selection twice pops the original selection up', () => {
        paredit.growSelectionStack(doc, range);
        paredit.growSelectionStack(doc, range);
        paredit.shrinkSelection(doc);
        expect(doc.growSelectionStack[doc.growSelectionStack.length - 1]).deep.equal(startSelection);
    });

});