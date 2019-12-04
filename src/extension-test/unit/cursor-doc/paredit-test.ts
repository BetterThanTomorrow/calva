import { expect } from 'chai';
import * as paredit from '../../../cursor-doc/paredit';
import { ReplReadline } from '../../../webview/readline';
import * as mock from './mock';


describe('paredit.selectRangeFromSelectionEnd', function () {
    it('grows the selection backwards', function () {
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

describe('paredit.selectRangeFromSelectionStart', function () {
    it('grows the selection backwards', function () {
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