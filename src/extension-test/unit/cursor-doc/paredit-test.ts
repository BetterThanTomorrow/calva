import * as expect from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as mock from '../common/mock';
import { docFromDot, textAndSelection } from '../common/text-notation';
import { ModelEditSelection } from '../../../cursor-doc/model';

/**
 * TODO: Use text-notation for these tests
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
            it('><(def foo [vec]) => |(def foo [vec])|', () => {
                const topLevelRange = [0, docText.length];
                expect(paredit.forwardSexpRange(doc)).toEqual(topLevelRange);
            });
            it('(><def foo [vec]) => (|def| foo [vec])', () => {
                const [defLeft, defRight] = [1, 4];
                doc.selection = new ModelEditSelection(defLeft);
                expect(paredit.forwardSexpRange(doc)).toEqual([defLeft, defRight]);
            });
            it('(d><ef foo [vec]) => (d|ef| foo [vec])', () => {
                const [defMid, defRight] = [2, 4];
                doc.selection = new ModelEditSelection(defMid, defMid);
                expect(paredit.forwardSexpRange(doc)).toEqual([defMid, defRight]);
            });
            it('(def foo [:foo :bar :ba><z]) => (def foo [:foo :bar :ba|z|])', () => {
                const [bazMid, bazRight] = [22, 24];
                doc.selection = new ModelEditSelection(bazMid, bazMid);
                expect(paredit.forwardSexpRange(doc)).toEqual([bazMid, bazRight]);
            });
            it('(def>< foo [vec]) => (def| foo| [vec])', () => {
                const [defRight, fooRight] = [4, 8];
                doc.selection = new ModelEditSelection(defRight, defRight);
                expect(paredit.forwardSexpRange(doc)).toEqual([defRight, fooRight]);
            });
            it('(def foo ><[vec]) => (def foo |[vec]|)', () => {
                const [vecLeft, vecRight] = [9, 25];
                doc.selection = new ModelEditSelection(vecLeft, vecLeft);
                expect(paredit.forwardSexpRange(doc)).toEqual([vecLeft, vecRight]);
            });
            it('(def foo [:foo :bar :><baz]) => (def foo [:foo :bar |:baz|])', () => {
                const [bazLeft, bazRight] = [20, 24];
                doc.selection = new ModelEditSelection(bazLeft, bazLeft);
                expect(paredit.forwardSexpRange(doc)).toEqual([bazLeft, bazRight]);
            });
            it('(def foo [:foo :bar :baz><]) => (def foo [:foo :bar :baz|])', () => {
                const bazRight = 24;
                doc.selection = new ModelEditSelection(bazRight, bazRight);
                expect(paredit.forwardSexpRange(doc)).toEqual([bazRight, bazRight]);
            });
            it('(>def> foo [vec]) => (def| foo| [vec])', () => {
                const [defLeft, defRight] = [1, 4],
                    existingSelection = new ModelEditSelection(defLeft, defRight),
                    fooRight = 8;
                doc.selection = existingSelection;
                const range = paredit.forwardSexpRange(doc);
                expect(range).toEqual([defRight, fooRight]);
            });
            it('(>def foo> [vec]) => (def foo| [vec]|)', () => {
                const [defLeft, fooRight] = [1, 8],
                    vecRight = 25,
                    existingSelection = new ModelEditSelection(defLeft, fooRight);
                doc.selection = existingSelection;
                expect(paredit.forwardSexpRange(doc)).toEqual([fooRight, vecRight]);
            });
            it('(<def foo< [vec]) => (def foo| [vec]|)', () => {
                const [defLeft, fooRight] = [1, 8],
                    vecRight = 25,
                    existingSelection = new ModelEditSelection(fooRight, defLeft);
                doc.selection = existingSelection;
                expect(paredit.forwardSexpRange(doc)).toEqual([fooRight, vecRight]);
            });
        });

        describe('rangeToSexprBackward', () => {
            it('(def <foo [vec]<) => (|def| foo [vec])', () => {
                const [vecRight, fooLeft] = [25, 5],
                    defLeft = 1,
                    existingSelection = new ModelEditSelection(vecRight, fooLeft);
                doc.selection = existingSelection;
                expect(paredit.backwardSexpRange(doc)).toEqual([defLeft, fooLeft]);
            });
        })

        describe('moveToRangeRight', () => {
            it('(|def >|foo>| [vec]) => (def foo>< [vec])', () => {
                const existingSelection = new ModelEditSelection(1, 1),
                    [fooLeft, fooRight] = [5, 8];
                doc.selection = existingSelection;
                paredit.moveToRangeRight(doc, [fooLeft, fooRight]);
                expect(doc.selection).toEqual(new ModelEditSelection(fooRight));
            });
            it('(|def <|foo<| [vec]) => (def foo>< [vec])', () => {
                const existingSelection = new ModelEditSelection(1, 1),
                    [fooRight, fooLeft] = [8, 5];
                doc.selection = existingSelection;
                paredit.moveToRangeRight(doc, [fooLeft, fooRight]);
                expect(doc.selection).toEqual(new ModelEditSelection(fooRight));
            });
            it('(<def< foo >|[vec]>|) => (def foo [vec]><)', () => {
                const [defRight, defLeft] = [4, 1],
                    existingSelection = new ModelEditSelection(defRight, defLeft),
                    [vecLeft, vecRight] = [9, 25];
                doc.selection = existingSelection;
                paredit.moveToRangeRight(doc, [vecLeft, vecRight]);
                expect(doc.selection).toEqual(new ModelEditSelection(vecRight));
            });
        })

        describe('moveToRangeLeft', () => {
            it('(def >|foo>| ><[vec]) => (def ><foo [vec])', () => {
                const vecLeft = 9,
                    existingSelection = new ModelEditSelection(vecLeft, vecLeft),
                    [fooLeft, fooRight] = [5, 8];
                doc.selection = existingSelection;
                paredit.moveToRangeLeft(doc, [fooLeft, fooRight]);
                expect(doc.selection).toEqual(new ModelEditSelection(fooLeft));
            });
            it('(def <|foo<| ><[vec]) => (def ><foo [vec])', () => {
                const vecLeft = 9,
                    existingSelection = new ModelEditSelection(vecLeft, vecLeft),
                    [fooRight, fooLeft] = [8, 5];
                doc.selection = existingSelection;
                paredit.moveToRangeLeft(doc, [fooRight, fooLeft]);
                expect(doc.selection).toEqual(new ModelEditSelection(fooLeft));
            });
            it('(<|def<| foo >[vec]>) => (><def foo [vec])', () => {
                const [defRight, defLeft] = [4, 1],
                    [vecLeft, vecRight] = [9, 25],
                    existingSelection = new ModelEditSelection(vecLeft, vecRight);
                doc.selection = existingSelection;
                paredit.moveToRangeLeft(doc, [defRight, defLeft]);
                expect(doc.selection).toEqual(new ModelEditSelection(defLeft));
            });
        });
    });

    describe('Reader tags', () => {
        const docText = '(a(b(c\n#f\n(#b \n[:f :b :z])\n#z\n1)))';
        let doc: mock.MockDocument;

        beforeEach(() => {
            doc = new mock.MockDocument();
            doc.insertString(docText);
        });

        it('rangeToForwardDownList: (a(b(|c•#f•(#b •[:f :b :z])•#z•1))) => (a(b(c•#f•(|#b •[:f :b :z])•#z•1)))', () => {
            doc.selection = new ModelEditSelection(5, 5);
            const newRange = paredit.rangeToForwardDownList(doc);
            expect(newRange).toEqual([5, 11]);
        });
        it('rangeToBackwardUpList: (a(b(c•#f•(|#b •[:f :b :z])•#z•1))) => (a(b(c•|#f•(#b •[:f :b :z])•#z•1)))', () => {
            doc.selection = new ModelEditSelection(11, 11);
            const newRange = paredit.rangeToBackwardUpList(doc);
            expect(newRange).toEqual([7, 11]);
        });
        it('rangeToBackwardUpList: (a(b(c•#f•(#b •|[:f :b :z])•#z•1))) => (a(b(c•<•#f•(#b •<[:f :b :z])•#z•1)))', () => {
            doc.selection = new ModelEditSelection(15, 15);
            const newRange = paredit.rangeToBackwardUpList(doc);
            expect(newRange).toEqual([4, 15]);
        });
        it('dragSexprBackward: (a(b(c•#f•|(#b •[:f :b :z])•#z•1))) => (a(b(#f•|(#b •[:f :b :z])•c•#z•1)))', () => {
            doc.selection = new ModelEditSelection(10, 10);
            paredit.dragSexprBackward(doc);
            expect(doc.model.getText(0, Infinity)).toBe('(a(b(#f\n(#b \n[:f :b :z])\nc\n#z\n1)))');
            expect(doc.selection).toEqual(new ModelEditSelection(8));
        });
        it('dragSexprForward: (a(b(c•#f•|(#b •[:f :b :z])•#z•1))) => (a(b(c•#z•1•#f•|(#b •[:f :b :z]))))', () => {
            doc.selection = new ModelEditSelection(10, 10);
            paredit.dragSexprForward(doc);
            expect(doc.model.getText(0, Infinity)).toBe('(a(b(c\n#z\n1\n#f\n(#b \n[:f :b :z]))))');
            expect(doc.selection).toEqual(new ModelEditSelection(15));
        });
        describe('Stacked readers', () => {
            const docText = '(c\n#f\n(#b \n[:f :b :z])\n#x\n#y\n1)';
            let doc: mock.MockDocument;

            beforeEach(() => {
                doc = new mock.MockDocument();
                doc.insertString(docText);
            });
            it('dragSexprBackward: (c•#f•(#b •[:f :b :z])•#x•#y•|1) => (c•#x•#y•|1•#f•(#b •[:f :b :z]))', () => {
                doc.selection = new ModelEditSelection(29, 29);
                paredit.dragSexprBackward(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(c\n#x\n#y\n1\n#f\n(#b \n[:f :b :z]))');
                expect(doc.selection).toEqual(new ModelEditSelection(9));
            });
            it('dragSexprForward: (c•#f•|(#b •[:f :b :z])•#x•#y•1) => (c•#x•#y•1•#f•|(#b •[:f :b :z]))', () => {
                doc.selection = new ModelEditSelection(6, 6);
                paredit.dragSexprForward(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(c\n#x\n#y\n1\n#f\n(#b \n[:f :b :z]))');
                expect(doc.selection).toEqual(new ModelEditSelection(14));
            });
        })
        describe('Top Level Readers', () => {
            const docText = '#f\n(#b \n[:f :b :z])\n#x\n#y\n1\n#å#ä#ö';
            let doc: mock.MockDocument;

            beforeEach(() => {
                doc = new mock.MockDocument();
                doc.insertString(docText);
            });
            it('dragSexprBackward: #f•(#b •[:f :b :z])•#x•#y•|1•#å#ä#ö => #x•#y•1•#f•(#b •[:f :b :z])•#å#ä#ö', () => {
                doc.selection = new ModelEditSelection(26, 26);
                paredit.dragSexprBackward(doc);
                expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
            });
            it('dragSexprForward: #f•|(#b •[:f :b :z])•#x•#y•1#å#ä#ö => #x•#y•1•#f•|(#b •[:f :b :z])•#å#ä#ö', () => {
                doc.selection = new ModelEditSelection(3, 3);
                paredit.dragSexprForward(doc);
                expect(doc.model.getText(0, Infinity)).toBe('#x\n#y\n1\n#f\n(#b \n[:f :b :z])\n#å#ä#ö');
                expect(doc.selection).toEqual(new ModelEditSelection(11));
            });
            it('dragSexprForward: #f•(#b •[:f :b :z])•#x•#y•|1•#å#ä#ö => #f•(#b •[:f :b :z])•#x•#y•|1•#å#ä#ö', () => {
                doc.selection = new ModelEditSelection(26, 26);
                paredit.dragSexprForward(doc);
                expect(doc.model.getText(0, Infinity)).toBe('#f\n(#b \n[:f :b :z])\n#x\n#y\n1\n#å#ä#ö');
                expect(doc.selection).toEqual(new ModelEditSelection(26));
            });
        })
    });

    describe('selection', () => {
        describe('selectRangeBackward', () => {
            // TODO: Fix #498
            it('Extends backward selections backwards', () => {
                const a = docFromDot('(def foo [:foo :bar |<|:baz|<|])');
                const selDoc = docFromDot('(def foo [:foo |:bar| :baz])');
                const b = docFromDot('(def foo [:foo |<|:bar :baz|<|])');
                paredit.selectRangeBackward(a, [selDoc.selection.anchor, selDoc.selection.active]);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Contracts forward selection and extends backwards', () => {
                const a = docFromDot('(def foo [:foo :bar |>|:baz|>|])');
                const selDoc = docFromDot('(def foo [:foo |:bar| :baz])');
                const b = docFromDot('(def foo [:foo |<|:bar |<|:baz])');
                paredit.selectRangeBackward(a, [selDoc.selection.anchor, selDoc.selection.active]);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

        });

        describe('selectRangeForward', () => {
            it('(def foo [:foo >:bar> >|:baz>|]) => (def foo [:foo >:bar :baz>])', () => {
                const barSelection = new ModelEditSelection(15, 19),
                    bazRange = [20, 24] as [number, number],
                    barBazSelection = new ModelEditSelection(15, 24);
                doc.selection = barSelection;
                paredit.selectRangeForward(doc, bazRange);
                expect(doc.selection).toEqual(barBazSelection);
            });
            it('(def foo [<:foo :bar< >|:baz>|]) => (def foo [>:foo :bar :baz>])', () => {
                const [fooLeft, barRight] = [10, 19],
                    barFooSelection = new ModelEditSelection(barRight, fooLeft),
                    bazRange = [20, 24] as [number, number],
                    fooBazSelection = new ModelEditSelection(19, 24);
                doc.selection = barFooSelection;
                paredit.selectRangeForward(doc, bazRange);
                expect(doc.selection).toEqual(fooBazSelection);
            });
            it('(def foo [<:foo :bar< <|:baz<|]) => (def foo [>:foo :bar :baz>])', () => {
                const [fooLeft, barRight] = [10, 19],
                    barFooSelection = new ModelEditSelection(barRight, fooLeft),
                    bazRange = [24, 20] as [number, number],
                    fooBazSelection = new ModelEditSelection(19, 24);
                doc.selection = barFooSelection;
                paredit.selectRangeForward(doc, bazRange);
                expect(doc.selection).toEqual(fooBazSelection);
            });
        });
    });

    describe('selection stack', () => {
        const range = [15, 20] as [number, number];
        it('should make grow selection the topmost element on the stack', () => {
            paredit.growSelectionStack(doc, range);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(new ModelEditSelection(range[0], range[1]));
        });
        it('get us back to where we started if we just grow, then shrink', () => {
            const selectionBefore = startSelection.clone();
            paredit.growSelectionStack(doc, range);
            paredit.shrinkSelection(doc);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(selectionBefore);
        });
        it('should not add selections identical to the topmost', () => {
            const selectionBefore = doc.selection.clone();
            paredit.growSelectionStack(doc, range);
            paredit.growSelectionStack(doc, range);
            paredit.shrinkSelection(doc);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(selectionBefore);
        });
        it('should have A topmost after adding A, then B, then shrinking', () => {
            const a = range,
                b: [number, number] = [10, 24];
            paredit.growSelectionStack(doc, a);
            paredit.growSelectionStack(doc, b);
            paredit.shrinkSelection(doc);
            expect(doc.selectionStack[doc.selectionStack.length - 1]).toEqual(new ModelEditSelection(a[0], a[1]));
        });
    });

    describe('dragSexpr', () => {
        describe('forwardAndBackwardSexpr', () => {
            // (comment\n  ['(0 1 2 "t" "f")•   "b"•             {:s "h"}•             :f]•  [:f '(0 "t") "b" :s]•  [:f 0•   "b" :s•   4 :b]•  {:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b})
            let doc: mock.MockDocument;

            beforeEach(() => {
                doc = new mock.MockDocument();
                doc.insertString(docText);
            });

            it('drags forward in regular lists', () => {
                const a = docFromDot(`(c• [:|f '(0 "t")•   "b" :s]•)`);
                const b = docFromDot(`(c• ['(0 "t") :|f•   "b" :s]•)`);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags backward in regular lists', () => {
                const a = docFromDot(`(c• [:f '(0 "t")•   "b"| :s]•)`);
                const b = docFromDot(`(c• [:f "b"|•   '(0 "t") :s]•)`);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('does not drag forward when sexpr is last in regular lists', () => {
                const dotText = `(c• [:f '(0 "t")•   "b" |:s ]•)`;
                const a = docFromDot(dotText);
                const b = docFromDot(dotText);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('does not drag backward when sexpr is last in regular lists', () => {
                const dotText = `(c• [ :|f '(0 "t")•   "b" :s ]•)`;
                const a = docFromDot(dotText);
                const b = docFromDot(dotText);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair forward in maps', () => {
                const a = docFromDot(`(c• {:|e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`);
                const b = docFromDot(`(c• {3 {:w? 'w}•   :|e '(e o ea)•   :t '(t i o im)•   :b 'b}•)`);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair backwards in maps', () => {
                const a = docFromDot(`(c• {:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)|•   :b 'b}•)`);
                const b = docFromDot(`(c• {:e '(e o ea)•   :t '(t i o im)|•   3 {:w? 'w}•   :b 'b}•)`);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair backwards in meta-data maps', () => {
                const a = docFromDot(`(c• ^{:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)|•   :b 'b}•)`);
                const b = docFromDot(`(c• ^{:e '(e o ea)•   :t '(t i o im)|•   3 {:w? 'w}•   :b 'b}•)`);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags single sexpr forward in sets', () => {
                const a = docFromDot(`(c• #{:|e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`);
                const b = docFromDot(`(c• #{'(e o ea) :|e•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair in binding box', () => {
                const b = docFromDot(`(c• [:e '(e o ea)•   3 {:w? 'w}•   :t |'(t i o im)•   :b 'b]•)`);
                const a = docFromDot(`(c• [:e '(e o ea)•   3 {:w? 'w}•   :b 'b•   :t |'(t i o im)]•)`);
                paredit.dragSexprForward(b, ['c']);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
        });

        describe('backwardUp - one line', () => {
            it('(def foo [:><foo :bar :baz]) => (def foo :><foo [:bar :baz])', () => {
                const inKwFoo = 11;
                doc.selection = new ModelEditSelection(inKwFoo);
                paredit.dragSexprBackwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(def foo :foo [:bar :baz])');
                expect(doc.selection).toEqual(new ModelEditSelection(10));
            });
            it('(def foo [:foo ><:bar :baz]) => (def foo ><:bar [:foo :baz])', () => {
                const kwBarLeft = 15;
                doc.selection = new ModelEditSelection(kwBarLeft);
                paredit.dragSexprBackwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(def foo :bar [:foo :baz])');
                expect(doc.selection).toEqual(new ModelEditSelection(9));
            });
            it('(def foo [:foo :bar :baz><]) => (def foo :baz>< [:foo :bar])', () => {
                const kwBazRight = 24;
                doc.selection = new ModelEditSelection(kwBazRight);
                paredit.dragSexprBackwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(def foo :baz [:foo :bar])');
                expect(doc.selection).toEqual(new ModelEditSelection(13));
            });
            it('(d>|e>|f foo [:foo :bar :baz]) => de><f (foo [:foo :bar :baz])', () => {
                const eSel = [2, 3];
                doc.selection = new ModelEditSelection(eSel[0], eSel[1]);
                paredit.dragSexprBackwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('def (foo [:foo :bar :baz])');
                expect(doc.selection).toEqual(new ModelEditSelection(2));
            });
        });
        describe('backwardUp - multi-line', () => {
            const docText = '((fn foo\n  [x]\n  [:foo\n   :bar\n   :baz])\n 1)';
            let doc: mock.MockDocument,
                startSelection = new ModelEditSelection(0, 0);

            beforeEach(() => {
                doc = new mock.MockDocument();
                doc.insertString(docText);
                doc.selection = startSelection.clone();
            });

            it('((fn foo\n  [x]\n  [><:foo\n   :bar\n   :baz])\n 1) => (fn foo\n  [x]\n  ><:foo\n  [:bar\n   :baz])\n(1)', () => {
                const kwFoo = 18;
                doc.selection = new ModelEditSelection(kwFoo);
                paredit.dragSexprBackwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('((fn foo\n  [x]\n  :foo\n  [:bar\n   :baz])\n 1)');
                expect(doc.selection).toEqual(new ModelEditSelection(17));
            });
            it('(><(fn foo\n  [x]\n  [:foo\n   :bar\n   :baz])\n 1) => ><(fn foo\n  [x]\n  [:foo\n   :bar\n   :baz])\n(1)', () => {
                const fnList = 1;
                doc.selection = new ModelEditSelection(fnList);
                paredit.dragSexprBackwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(fn foo\n  [x]\n  [:foo\n   :bar\n   :baz])\n(1)');
                expect(doc.selection).toEqual(new ModelEditSelection(0));
            });
            it('((fn foo\n  [x]\n  [:foo\n   :bar\n   :baz])\n ><1) => ><1\n((fn foo\n  [x]\n  [:foo\n   :bar\n   :baz]))', () => {
                const one = 42;
                doc.selection = new ModelEditSelection(one);
                paredit.dragSexprBackwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('1\n((fn foo\n  [x]\n  [:foo\n   :bar\n   :baz]))');
                expect(doc.selection).toEqual(new ModelEditSelection(0));
            });
        });
        describe('forwardDown - one line', () => {
            it('(def f><oo [:foo :bar :baz]) => (def [f><oo :foo :bar :baz])', () => {
                const inFoo = 6;
                doc.selection = new ModelEditSelection(inFoo);
                paredit.dragSexprForwardDown(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(def [foo :foo :bar :baz])');
                expect(doc.selection).toEqual(new ModelEditSelection(7));
            });
            it('(d>|ef>| foo [:foo :bar :baz]) => (foo [def>< :foo :bar :baz])', () => {
                const eSel = [2, 4];
                doc.selection = new ModelEditSelection(eSel[0], eSel[1]);
                paredit.dragSexprForwardDown(doc);
                expect(doc.model.getText(0, Infinity)).toBe('(foo [def :foo :bar :baz])');
                expect(doc.selection).toEqual(new ModelEditSelection(9));
            });
        });
        describe('forwardUp', () => {
            const docText = '((fn foo [x] [:foo :bar])) :baz';
            let doc: mock.MockDocument,
                startSelection = new ModelEditSelection(0, 0);

            beforeEach(() => {
                doc = new mock.MockDocument();
                doc.insertString(docText);
                doc.selection = startSelection.clone();
            });

            it('((fn foo [x] [:foo :b><ar])) :baz => ((fn foo [x] [:foo] :b><ar)) :baz', () => {
                const inBazKw = 21;
                doc.selection = new ModelEditSelection(inBazKw);
                paredit.dragSexprForwardUp(doc);
                expect(doc.model.getText(0, Infinity)).toBe('((fn foo [x] [:foo] :bar)) :baz');
                expect(doc.selection).toEqual(new ModelEditSelection(22));
            });
        });
        describe('backwardDown', () => {
            const docText = '((fn foo [x] [:foo :bar])) :baz';
            let doc: mock.MockDocument,
                startSelection = new ModelEditSelection(0, 0);

            beforeEach(() => {
                doc = new mock.MockDocument();
                doc.insertString(docText);
                doc.selection = startSelection.clone();
            });

            it('((fn foo [x] [:foo :b><ar])) :baz => ((fn foo [x] [:foo :b><ar])) :baz', () => {
                const inBazKw = 21;
                doc.selection = new ModelEditSelection(inBazKw);
                paredit.dragSexprBackwardDown(doc);
                expect(doc.model.getText(0, Infinity)).toBe(docText);
                expect(doc.selection).toEqual(new ModelEditSelection(21));
            });
            it('((fn foo [x] [:foo :bar])) :b><az => ((fn foo [x] [:foo :bar]) :b><az)', () => {
                const inBazKw = 29;
                doc.selection = new ModelEditSelection(inBazKw);
                paredit.dragSexprBackwardDown(doc);
                expect(doc.model.getText(0, Infinity)).toBe('((fn foo [x] [:foo :bar]) :baz)');
                expect(doc.selection).toEqual(new ModelEditSelection(28));
            });
        });
    });
    describe('edits', () => {
        it('Closes list', () => {
            const doc: mock.MockDocument = new mock.MockDocument(),
                text = '(str "foo")',
                caret = 10;
            doc.insertString(text);
            doc.selection = new ModelEditSelection(caret);
            paredit.close(doc, ')');
            expect(doc.model.getText(0, Infinity)).toBe(text);
            expect(doc.selection).toEqual(new ModelEditSelection(caret + 1));
        });
        it('Closes quote at end of string', () => {
            const doc: mock.MockDocument = new mock.MockDocument(),
                text = '(str "foo")',
                caret = 9;
            doc.insertString(text);
            doc.selection = new ModelEditSelection(caret);
            paredit.stringQuote(doc);
            expect(doc.model.getText(0, Infinity)).toBe(text);
            expect(doc.selection).toEqual(new ModelEditSelection(caret + 1));
        });
        it('slurps form after list', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            const oldText = '(str) "foo"';
            const newText = '(str "foo")';
            const caret = 2;
            doc.insertString(oldText);
            doc.selection = new ModelEditSelection(caret);
            paredit.forwardSlurpSexp(doc);
            expect(doc.model.getText(0, Infinity)).toBe(newText);
            expect(doc.selection).toEqual(new ModelEditSelection(caret));
        });
        it('slurps and adds leading space if form after list lacks it', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            const oldText = '(str)#(foo)';
            const newText = '(str #(foo))';
            const caret = 2;
            doc.insertString(oldText);
            doc.selection = new ModelEditSelection(caret);
            paredit.forwardSlurpSexp(doc);
            expect(doc.model.getText(0, Infinity)).toBe(newText);
            expect(doc.selection).toEqual(new ModelEditSelection(caret));
        });
        it('raises the current form when cursor is preceeding', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            const oldText = '(str #(foo))';
            const newText = '#(foo)';
            const oldCaret = 5;
            const newCaret = 0;
            doc.insertString(oldText);
            doc.selection = new ModelEditSelection(oldCaret);
            paredit.raiseSexp(doc);
            expect(doc.model.getText(0, Infinity)).toBe(newText);
            expect(doc.selection).toEqual(new ModelEditSelection(newCaret));
        });
        it('raises the current form when cursor is trailing', () => {
            const doc: mock.MockDocument = new mock.MockDocument();
            const oldText = '(str #(foo))\n';
            const newText = '#(foo)\n';
            const oldCaret = 11;
            const newCaret = 6;
            doc.insertString(oldText);
            doc.selection = new ModelEditSelection(oldCaret);
            paredit.raiseSexp(doc);
            expect(doc.model.getText(0, Infinity)).toBe(newText);
            expect(doc.selection).toEqual(new ModelEditSelection(newCaret));
        });
    });
});




