import { expect } from 'chai';
import * as paredit from '../../../cursor-doc/paredit';
import { ReplReadline } from '../../../webview/readline';
import * as mock from './mock';
import { ModelEditSelection } from '../../../cursor-doc/model';

/**
 * Prose gets a bit clumsy when describing the expectations of many Paredit operations and functions.
 * Therefore we here use a made-up ”language” to denote things. We have:
 * * Forms, lists of different kinds and symbols of different kinds.
 *   * The current form is denoted surrounded by `*`.
 * * Positions, identifying a position in the text
 *   * Single positions are denoted with `|`.
 *   * Positions that are port of something else are denoted differently depending, read on.
 * * Selections, something selected in the editor.
 *   * Selections have direction, an anchor position and an active position, the active position is where the caret is shown.
 *   * selections are denoted with `>` before and after forward selections, and using`<` for backward selections.
 * * Ranges, used more internally (even if visible in the API) by Paredit to denote a range of positions in the text.
 *   * Ranges can have direction, but most often they don't.
 *   * Ranges w/o direction are denoted with `|` at the range's boundaries.
 *   * Ranges with direction are denoted with `>|` and `<|`, using the same semantics as selections.
 */

describe('paredit', () => {
    const docText = '(def foo [:foo :bar :baz])';
    let doc: mock.MockDocument,
        startSelection = new ModelEditSelection(0, 0);

    beforeEach(() => {
        doc = new mock.MockDocument();
        doc.insertString(docText);
        doc.selection = startSelection.clone();
    });

    describe('movement', () => {
        describe('rangeToSexprForward', () => {
            it('|(def foo [vec]) => |(def foo [vec])|', () => {
                const topLevelRange = [0, docText.length];
                expect(paredit.forwardSexpRange(doc)).deep.equal(topLevelRange);
            });
            it('(|def foo [vec]) => (|def| foo [vec])', () => {
                const [defStart, defEnd] = [1, 4];
                doc.selection = new ModelEditSelection(defStart);
                expect(paredit.forwardSexpRange(doc)).deep.equal([defStart, defEnd]);
            });
            it('(d|ef foo [vec]) => (d|ef| foo [vec])', () => {
                const [defMid, defEnd] = [2, 4];
                doc.selection = new ModelEditSelection(defMid, defMid);
                expect(paredit.forwardSexpRange(doc)).deep.equal([defMid, defEnd]);
            });
            it('(def foo [:foo :bar :ba|z]) => (def foo [:foo :bar :ba|z|])', () => {
                const [bazMid, bazEnd] = [22, 24];
                doc.selection = new ModelEditSelection(bazMid, bazMid);
                expect(paredit.forwardSexpRange(doc)).deep.equal([bazMid, bazEnd]);
            });
            it('(def| foo [vec]) => (def| foo| [vec])', () => {
                const [defEnd, fooEnd] = [4, 8];
                doc.selection = new ModelEditSelection(defEnd, defEnd);
                expect(paredit.forwardSexpRange(doc)).deep.equal([defEnd, fooEnd]);
            });
            it('(def foo |[vec]) => (def foo |[vec]|)', () => {
                const [vecStart, vecEnd] = [9, 25];
                doc.selection = new ModelEditSelection(vecStart, vecStart);
                expect(paredit.forwardSexpRange(doc)).deep.equal([vecStart, vecEnd]);
            });
            it('(def foo [:foo :bar :|baz]) => (def foo [:foo :bar |:baz|])', () => {
                const [bazStart, bazEnd] = [20, 24];
                doc.selection = new ModelEditSelection(bazStart, bazStart);
                expect(paredit.forwardSexpRange(doc)).deep.equal([bazStart, bazEnd]);
            });
            it('(def foo [:foo :bar :baz|]) => (def foo [:foo :bar :baz|])', () => {
                const bazEnd = 24;
                doc.selection = new ModelEditSelection(bazEnd, bazEnd);
                expect(paredit.forwardSexpRange(doc)).deep.equal([bazEnd, bazEnd]);
            });
            it('(>def> foo [vec]) => (def| foo| [vec])', () => {
                const [defLeft, defRight] = [1, 4],
                    existingSelection = new ModelEditSelection(defLeft, defRight),
                    fooRight = 8;
                doc.selection = existingSelection;
                const range = paredit.forwardSexpRange(doc);
                expect(range).deep.equal([defRight, fooRight]);
            });
            it('()>def foo> [vec]) => (def foo| [vec]|)', () => {
                const [defLeft, fooRight] = [1, 8],
                    vecRight = 25,
                    existingSelection = new ModelEditSelection(defLeft, fooRight);
                doc.selection = existingSelection;
                expect(paredit.forwardSexpRange(doc)).deep.equal([fooRight, vecRight]);
            });
            it('(<def foo< [vec]) => (def foo| [vec]|)', () => {
                const [fooRight, defLeft] = [8, 1],
                    vecRight = 25,
                    existingSelection = new ModelEditSelection(fooRight, defLeft);
                doc.selection = existingSelection;
                expect(paredit.forwardSexpRange(doc)).deep.equal([fooRight, vecRight]);
            });
        });

        describe('rangeToSexprBackward', () => {
            it('(def <foo [vec]<) => (|def| foo [vec])', () => {
                const [vecRight, fooLeft] = [25, 5],
                    defLeft = 1,
                    existingSelection = new ModelEditSelection(vecRight, fooLeft);
                doc.selection = existingSelection;
                expect(paredit.backwardSexpRange(doc)).deep.equal([defLeft, fooLeft]);
            });
        })

        describe('moveToRangeRight', () => {
            it('(|def >|foo>| [vec]) => (def foo| [vec])', () => {
                const existingSelection = new ModelEditSelection(1, 1),
                    [fooLeft, fooRight] = [5, 8];
                doc.selection = existingSelection;
                paredit.moveToRangeRight(doc, [fooLeft, fooRight]);
                expect(doc.selection).deep.equal(new ModelEditSelection(fooRight));
            });
            it('(|def <|foo<| [vec]) => (def foo| [vec])', () => {
                const existingSelection = new ModelEditSelection(1, 1),
                    [fooRight, fooLeft] = [8, 5];
                doc.selection = existingSelection;
                paredit.moveToRangeRight(doc, [fooLeft, fooRight]);
                expect(doc.selection).deep.equal(new ModelEditSelection(fooRight));
            });
            it('(<def< foo >|[vec]>|) => (def foo [vec]|)', () => {
                const [defRight, defLeft] = [4, 1],
                    existingSelection = new ModelEditSelection(defRight, defLeft),
                    [vecLeft, vecRight] = [9, 25];
                doc.selection = existingSelection;
                paredit.moveToRangeRight(doc, [vecLeft, vecRight]);
                expect(doc.selection).deep.equal(new ModelEditSelection(vecRight));
            });
        })

        describe('moveToRangeLeft', () => {
            it('(def >|foo>| |[vec]) => (def |foo [vec])', () => {
                const vecLeft = 9,
                    existingSelection = new ModelEditSelection(vecLeft, vecLeft),
                    [fooLeft, fooRight] = [5, 8];
                doc.selection = existingSelection;
                paredit.moveToRangeLeft(doc, [fooLeft, fooRight]);
                expect(doc.selection).deep.equal(new ModelEditSelection(fooLeft));
            });
            it('(def <|foo<| |[vec]) => (def |foo [vec])', () => {
                const vecLeft = 9,
                    existingSelection = new ModelEditSelection(vecLeft, vecLeft),
                    [fooRight, fooLeft] = [8, 5];
                doc.selection = existingSelection;
                paredit.moveToRangeLeft(doc, [fooRight, fooLeft]);
                expect(doc.selection).deep.equal(new ModelEditSelection(fooLeft));
            });
            it('(<|def<| foo >[vec]>) => (|def foo [vec])', () => {
                const [defRight, defLeft] = [4, 1],
                    [vecLeft, vecRight] = [9, 25],
                    existingSelection = new ModelEditSelection(vecLeft, vecRight);
                doc.selection = existingSelection;
                paredit.moveToRangeLeft(doc, [defRight, defLeft]);
                expect(doc.selection).deep.equal(new ModelEditSelection(defLeft));
            });
        })
    });

    describe('selection', () => {
        describe('selectRangeFromSelectionRight', () => {
            // TODO: Fix #498
            it('(def foo [:foo >|:bar>| <:baz<]) => (def foo [:foo <:bar :baz<])', () => {
                const bazSelection = new ModelEditSelection(24, 20),
                    barRange = [15, 19] as [number, number],
                    barBazSelection = new ModelEditSelection(24, 15);
                doc.selection = bazSelection;
                paredit.selectRangeFromSelectionRight(doc, barRange);
                expect(doc.selection).deep.equal(barBazSelection);
            });
        });
        
        describe('selectRangeFromSelectionLeft', () => {
            it('(def foo [:foo >:bar> >|:baz>|]) => (def foo [:foo >:bar :baz>])', () => {
                const barSelection = new ModelEditSelection(15, 19),
                    bazRange = [20, 24] as [number, number],
                    barBazSelection = new ModelEditSelection(15, 24);
                doc.selection = barSelection;
                paredit.selectRangeFromSelectionLeft(doc, bazRange);
                expect(doc.selection).deep.equal(barBazSelection);
            });
        });
    });

    describe('selection stack', () => {
        const range = [15, 20] as [number, number];
        it('should make grow selection the topmost element on the stack', () => {
            paredit.growSelectionStack(doc, range);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).deep.equal(new ModelEditSelection(range[0], range[1]));
        });
        it('get us back to where we started if we just grow, then shrink', () => {
            const selectionBefore = startSelection.clone();
            paredit.growSelectionStack(doc, range);
            paredit.shrinkSelection(doc);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).deep.equal(selectionBefore);
        });
        it('should not add selections identical to the topmost', () => {
            const selectionBefore = doc.selection.clone();
            paredit.growSelectionStack(doc, range);
            paredit.growSelectionStack(doc, range);
            paredit.shrinkSelection(doc);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).deep.equal(selectionBefore);
        });
        it('should have A topmost after adding A, then B, then shrinking', () => {
            const a = range,
                b: [number, number] = [10, 24];
            paredit.growSelectionStack(doc, a);
            paredit.growSelectionStack(doc, b);
            paredit.shrinkSelection(doc);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).deep.equal(new ModelEditSelection(a[0], a[1]));
        });
    });
});


