import { expect } from 'chai';
import * as paredit from '../../../cursor-doc/paredit';
import { ReplReadline } from '../../../webview/readline';
import * as mock from './mock';

describe('paredit.selectRangeFromSelectionEnd', () => {
    // TODO: Fix #498
    xit('grows the selection backwards', () => {
        const doc = new mock.MockDocument();
        doc.insertString('(def foo [:foo :bar :baz])');
        const bazSelection = { anchor: 20, active: 15 },
            barRange = [15, 19] as [number, number],
            barBazSelection = { anchor: 24, active: 15 };
        doc.selection = bazSelection;
        paredit.selectRangeFromSelectionEnd(doc, barRange);
        expect(doc.selection).deep.equal(barBazSelection);
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
    let doc: mock.MockDocument,
        startSelection: { anchor: number, active: number };
    const range = [15, 20] as [number, number],
        selection = { anchor: range[0], active: range[1] }

    before(() => {
        doc = new mock.MockDocument();
        doc.insertString('(def foo [:foo :bar :baz])');
        startSelection = doc.selection;
    });
    it('should make grow selection the topmost element on the stack', () => {
        paredit.growSelectionStack(doc, range);
        expect(doc.growSelectionStack[doc.growSelectionStack.length - 1]).deep.equal(selection);
    });
    it('get us back to where we started if we just grow, then shrink', () => {
        paredit.growSelectionStack(doc, range);
        paredit.shrinkSelection(doc);
        expect(doc.growSelectionStack[doc.growSelectionStack.length - 1]).deep.equal(startSelection);
    });
    it('should not add selections identical to the topmost', () => {
        paredit.growSelectionStack(doc, range);
        paredit.growSelectionStack(doc, range);
        paredit.shrinkSelection(doc);
        expect(doc.growSelectionStack[doc.growSelectionStack.length - 1]).deep.equal(startSelection);
    });
    it('should have A topmost after adding A, then B, then shrinking', () => {
        const a = range,
            b: [number, number] = [10, 24];
        paredit.growSelectionStack(doc, a);
        paredit.growSelectionStack(doc, b);
        paredit.shrinkSelection(doc);
        expect(doc.growSelectionStack[doc.growSelectionStack.length - 1]).deep.equal({ anchor: a[0], active: a[1] });
    });
});