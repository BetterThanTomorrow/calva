import { expect } from 'chai';
import * as paredit from '../../../cursor-doc/paredit';
import { ReplReadline } from '../../../webview/readline';
import * as mock from './mock';
import { emptySelectionOption } from '../../../cursor-doc/model';

describe('paredit movement', () => {
    const docText = '(def foo [:foo :bar :baz])';
    let doc: mock.MockDocument,
        startSelection = { anchor: 0, active: 0 };

    before(() => {
        doc = new mock.MockDocument();
        doc.insertString(docText);
    });
    describe('rangeToSexprForward', () => {
        it('when adjacent right to a sexpr, the range is the range of the sexpr', () => {
            const topLevelRange = [0, docText.length];
            doc.selection = startSelection;
            expect(paredit.forwardSexpRange(doc)).deep.equal(topLevelRange);
            const [defStart, defEnd] = [1, 4];
            doc.selection = { anchor: defStart, active: defStart };
            expect(paredit.forwardSexpRange(doc)).deep.equal([defStart, defEnd]);
        });
        it('when "in" a sexpr, the range is the range from cursor to the end the sexpr', () => {
            const [defMid, defEnd] = [2, 4];
            doc.selection = { anchor: defMid, active: defMid };
            expect(paredit.forwardSexpRange(doc)).deep.equal([defMid, defEnd]);
            const [bazMid, bazEnd] = [22, 24];
            doc.selection = { anchor: bazMid, active: bazMid };
            expect(paredit.forwardSexpRange(doc)).deep.equal([bazMid, bazEnd]);
        });
        it('when adjacent to the right of a sexpr, the range is the range from cursor to the end the next sexpr', () => {
            const defEnd = 4,
                [fooMid, fooEnd] = [4, 8];
            doc.selection = { anchor: defEnd, active: defEnd };
            expect(paredit.forwardSexpRange(doc)).deep.equal([fooMid, fooEnd]);
        });
        it('when adjacent to the left of the last sexpr in the list, the range is the range of the sexpr', () => {
            const [vecStart, vecEnd] = [9, 25];
            doc.selection = { anchor: vecStart, active: vecStart };
            expect(paredit.forwardSexpRange(doc)).deep.equal([vecStart, vecEnd]);
            const [bazStart, bazEnd] = [20, 24];
            doc.selection = { anchor: bazStart, active: bazStart };
            expect(paredit.forwardSexpRange(doc)).deep.equal([bazStart, bazEnd]);
        });
        it('when to the right of the last sexpr, the range is the same range as the cursor', () => {
            const bazEnd = 24;
            doc.selection = { anchor: bazEnd, active: bazEnd };
            expect(paredit.forwardSexpRange(doc)).deep.equal([bazEnd, bazEnd]);
        });
        it('extends an existing forwards selection to the right of the range', () => {
            const existingSelection = { anchor: 1, active: 4 },
                fooEnd = 8;
            doc.selection = existingSelection;
            const range = paredit.forwardSexpRange(doc);
            expect(range).deep.equal([existingSelection.active, fooEnd]);
        });
        it('>def foo> [vec] => def foo> [vec]>', () => {
            const [defLeft, fooRight] = [1, 8],
                vecRight = 25,
                existingSelection = { anchor: defLeft, active: fooRight };
            doc.selection = existingSelection;
            expect(paredit.forwardSexpRange(doc)).deep.equal([fooRight, vecRight]);
        });
        it('<def foo< [vec] => def foo> [vec]>', () => {
            const [fooRight, defLeft] = [8, 1],
                vecRight = 25,
                existingSelection = { anchor: fooRight, active: defLeft };
            doc.selection = existingSelection;
            expect(paredit.forwardSexpRange(doc)).deep.equal([fooRight, vecRight]);
        });
    });
    describe('rangeToSexprBackward', () => {
        it('def <foo [vec]< => >def >foo [vec]', () => {
            const [vecRight, fooLeft] = [25, 5],
                defLeft = 1,
                existingSelection = { anchor: vecRight, active: fooLeft };
            doc.selection = existingSelection;
            expect(paredit.backwardSexpRange(doc)).deep.equal([defLeft, fooLeft]);
        });
    })
    describe('moveToRangeRight', () => {
        it('moves to the right of a forward directed range', () => {
            const existingSelection = { anchor: 1, active: 1 },
                [fooLeft, fooRight] = [5, 8];
            doc.selection = existingSelection;
            paredit.moveToRangeRight(doc, [fooLeft, fooRight]);
            expect(doc.selection).deep.equal(emptySelectionOption(fooRight));
        });
        it('moves to the right of a backward directed range', () => {
            const existingSelection = { anchor: 1, active: 1 },
                [fooRight, fooLeft] = [8, 5];
            doc.selection = existingSelection;
            paredit.moveToRangeRight(doc, [fooLeft, fooRight]);
            expect(doc.selection).deep.equal(emptySelectionOption(fooRight));
        });
        it('moves to the right of a forward directed when current selection is two sexps back', () => {
            const [defRight, defLeft] = [4, 1],
                [vecLeft, vecRight] = [9, 25],
                existingSelection = { anchor: defRight, active: defLeft };
            doc.selection = existingSelection;
            paredit.moveToRangeRight(doc, [vecLeft, vecRight]);
            expect(doc.selection).deep.equal(emptySelectionOption(vecRight));
        });
    })
    describe('moveToRangeLeft', () => {
        it('moves to the left of a forward directed range', () => {
            const vecLeft = 9,
                existingSelection = { anchor: vecLeft, active: vecLeft },
                [fooLeft, fooRight] = [5, 8];
            doc.selection = existingSelection;
            paredit.moveToRangeLeft(doc, [fooLeft, fooRight]);
            expect(doc.selection).deep.equal(emptySelectionOption(fooLeft));
        });
        it('moves to the left of a backward directed range', () => {
            const vecLeft = 9,
                existingSelection = { anchor: vecLeft, active: vecLeft },
                [fooRight, fooLeft] = [8, 5];
            doc.selection = existingSelection;
            paredit.moveToRangeLeft(doc, [fooRight, fooLeft]);
            expect(doc.selection).deep.equal(emptySelectionOption(fooLeft));
        });
        it('moves to the left of a backward directed selection when current selection is two sexps forward', () => {
            const [defRight, defLeft] = [4, 1],
                [vecLeft, vecRight] = [9, 25],
                existingSelection = { anchor: vecLeft, active: vecRight };
            doc.selection = existingSelection;
            paredit.moveToRangeLeft(doc, [defRight, defLeft]);
            expect(doc.selection).deep.equal(emptySelectionOption(defLeft));
        });
    })
});


describe('selectRangeFromSelectionRight', () => {
    // TODO: Fix #498
    it('grows the selection backwards', () => {
        const doc = new mock.MockDocument();
        doc.insertString('(def foo [:foo :bar :baz])');
        const bazSelection = { anchor: 24, active: 20 },
            barRange = [15, 19] as [number, number],
            barBazSelection = { anchor: 24, active: 15 };
        doc.selection = bazSelection;
        paredit.selectRangeFromSelectionRight(doc, barRange);
        expect(doc.selection).deep.equal(barBazSelection);
    });
});

describe('selectRangeFromSelectionLeft', () => {
    it('grows the selection backwards', () => {
        const doc = new mock.MockDocument();
        doc.insertString('(def foo [:foo :bar :baz])');
        const barSelection = { anchor: 15, active: 19 },
            bazRange = [20, 24] as [number, number],
            barBazSelection = { anchor: 15, active: 24 };
        doc.selection = barSelection;
        paredit.selectRangeFromSelectionLeft(doc, bazRange);
        expect(doc.selection).deep.equal(barBazSelection);
    });
});

describe('selection stack', () => {
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