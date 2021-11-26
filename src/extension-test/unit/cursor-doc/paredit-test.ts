import * as expect from 'expect';
import * as paredit from '../../../cursor-doc/paredit';
import * as mock from '../common/mock';
import { docFromTextNotation, textAndSelection, text } from '../common/text-notation';
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
            it('Finds the list in front', () => {
                const a = docFromTextNotation('|(def foo [vec])');
                const b = docFromTextNotation('|(def foo [vec])|');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Finds the symbol in front', () => {
                const a = docFromTextNotation('(|def foo [vec])');
                const b = docFromTextNotation('(|def| foo [vec])');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Finds the rest of the symbol', () => {
                const a = docFromTextNotation('(d|ef foo [vec])');
                const b = docFromTextNotation('(d|ef| foo [vec])');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Finds the rest of the keyword', () => {
                const a = docFromTextNotation('(def foo [:foo :bar :ba|z])');
                const b = docFromTextNotation('(def foo [:foo :bar :ba|z|])');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Includes space between the cursor and the symbol', () => {
                const a = docFromTextNotation('(def| foo [vec])');
                const b = docFromTextNotation('(def| foo| [vec])');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Finds the vector in front', () => {
                const a = docFromTextNotation('(def foo |[vec])');
                const b = docFromTextNotation('(def foo |[vec]|)');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Finds the keyword in front', () => {
                const a = docFromTextNotation('(def foo [:foo :bar |:baz])');
                const b = docFromTextNotation('(def foo [:foo :bar |:baz|])');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Returns empty range when no forward sexp', () => {
                const a = docFromTextNotation('(def foo [:foo :bar :baz|])');
                const b = docFromTextNotation('(def foo [:foo :bar :baz|])');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Finds next symbol, including leading space', () => {
                const a = docFromTextNotation('(|>|def|>| foo [vec])');
                const b = docFromTextNotation('(def|>| foo|>| [vec])');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Finds following vector including leading space', () => {
                const a = docFromTextNotation('(|>|def foo|>| [vec])');
                const b = docFromTextNotation('(def foo|>| [vec]|>|)');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
            it('Reverses direction of selection and finds next sexp', () => {
                const a = docFromTextNotation('(|<|def foo|<| [vec])');
                const b = docFromTextNotation('(def foo|>| [vec]|>|)');
                expect(paredit.forwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
        });

        describe('rangeToSexprBackward', () => {
            it('Finds previous form, including space, and reverses direction', () => {
                // TODO: Should we really be reversing the direction here?
                const a = docFromTextNotation('(def |<|foo [vec]|<|)');
                const b = docFromTextNotation('(|>|def |>|foo [vec])');
                expect(paredit.backwardSexpRange(a)).toEqual(textAndSelection(b)[1]);
            });
        })

        describe('forwardHybridSexpRange', () => {
            it('Finds end of string', () => {
                const a = docFromTextNotation('"This |needs to find the end of the string."');
                const b = docFromTextNotation('"This |needs to find the end of the string.|"');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds newline in multi line string', () => {
                const a = docFromTextNotation('"This |needs to find the end\n of the string."');
                const b = docFromTextNotation('"This |needs to find the end|\n of the string."');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds newline in multi line string (Windows)', () => {
                const a = docFromTextNotation('"This |needs to find the end\r\n of the string."');
                const b = docFromTextNotation('"This |needs to find the end|\r\n of the string."');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of comment', () => {
                const a = docFromTextNotation('(a |;; foo\n e)');
                const b = docFromTextNotation('(a |;; foo|\n e)');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of comment (Windows)', () => {
                const a = docFromTextNotation('(a |;; foo\r\n e)');
                const b = docFromTextNotation('(a |;; foo|\r\n e)');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Maintains balanced delimiters 1', () => {
                const a = docFromTextNotation('(a| b (c\n d) e)');
                const b = docFromTextNotation('(a| b (c\n d)| e)');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Maintains balanced delimiters 1 (Windows)', () => {
                const a = docFromTextNotation('(a| b (c\r\n d) e)');
                const b = docFromTextNotation('(a| b (c\r\n d)| e)');
                const [start, end] = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                // off by 1 because \r\n is treated as 1 char?
                expect(actual).toEqual([start, end - 1]);
            });

            it('Maintains balanced delimiters 2', () => {
                const a = docFromTextNotation('(aa| (c (e\nf)) g)');
                const b = docFromTextNotation('(aa| (c (e\nf))|g)');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Maintains balanced delimiters 2 (Windows)', () => {
                const a = docFromTextNotation('(aa| (c (e\r\nf)) g)');
                const b = docFromTextNotation('(aa| (c (e\r\nf))|g)');
                const [start, end] = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                // off by 1 because \r\n is treated as 1 char?
                expect(actual).toEqual([start, end - 1]);
            });

            it('Maintains balanced delimiters 3', () => {
                const a = docFromTextNotation('(aa| (  c (e\nf)) g)');
                const b = docFromTextNotation('(aa| (  c (e\nf))|g)');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Advances past newline when invoked on newline', () => {
                const a = docFromTextNotation('(a|\n e) g)');
                const b = docFromTextNotation('(a|\n| e)');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of vectors', () => {
                const a = docFromTextNotation('[a [b |c d e f] g h]');
                const b = docFromTextNotation('[a [b |c d e f|] g h]');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of lists', () => {
                const a = docFromTextNotation('(foo |bar)\n');
                const b = docFromTextNotation('(foo |bar|)\n');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })


            it('Finds end of maps', () => {
                const a = docFromTextNotation('{:a 1 |:b 2 :c 3}');
                const b = docFromTextNotation('{:a 1 |:b 2 :c 3|}');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of line in multiline maps', () => {
                const a = docFromTextNotation('{:a 1 |:b 2\n:c 3}');
                const b = docFromTextNotation('{:a 1 |:b 2|:c 3}');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of expr in multiline maps', () => {
                const a = docFromTextNotation('{:a 1 |:b (+\n 0\n 2\n) :c 3}');
                const b = docFromTextNotation('{:a 1 |:b (+\n 0\n 2\n)| :c 3}');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of line in bindings', () => {
                const a = docFromTextNotation('(let [|a (+ 1 2)\n b (+ 2 3)] (+ a b))');
                const b = docFromTextNotation('(let [|a (+ 1 2)|\n b (+ 2 3)] (+ a b))');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds end of expr in multiline bindings', () => {
                const a = docFromTextNotation('(let [|a (+\n 1 \n 2)\n b (+ 2 3)] (+ a b))');
                const b = docFromTextNotation('(let [|a (+\n 1 \n 2)|\n b (+ 2 3)] (+ a b))');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            });

            it('Finds range in line of tokens', () => {
                const a = docFromTextNotation(' | 2 "hello" :hello/world\nbye');
                const b = docFromTextNotation(' | 2 "hello" :hello/world|\nbye');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })

            it('Finds range in token with form over multiple lines', () => {
                const a = docFromTextNotation(' | 2 [\n 1 \n]');
                const b = docFromTextNotation(' | 2 [\n 1 \n]|');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })

            it('Deals with comments start of line', () => {
                const a = docFromTextNotation('|;;  hi\n');
                const b = docFromTextNotation('|;;  hi|\n');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })

            it('Deals with comments middle of line', () => {
                const a = docFromTextNotation(';; |hi\n');
                const b = docFromTextNotation(';; |hi|\n');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })

            it('Deals with empty lines', () => {
                const a = docFromTextNotation('|\n');
                const b = docFromTextNotation('|\n|');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })

            it('Deals with comments with empty line', () => {
                const a = docFromTextNotation(';; |\n');
                const b = docFromTextNotation(';; |\n|');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })

            it('Does not advance when on closing token type ', () => {
                const a = docFromTextNotation('(a e|)\n');
                const b = docFromTextNotation('(a e||)\n');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })

            it('Finds the full form after an ignore marker', () => {
                // https://github.com/BetterThanTomorrow/calva/pull/1293#issuecomment-927123696
                const a = docFromTextNotation('(comment•  #_|[a b (c d•              e•              f) g]•  :a•)');
                const b = docFromTextNotation('(comment•  #_|[a b (c d•              e•              f) g]|• :a•)');
                const expected = textAndSelection(b)[1];
                const actual = paredit.forwardHybridSexpRange(a);
                expect(actual).toEqual(expected);
            })
        })

        describe('moveToRangeRight', () => {
            it('Places cursor at the right end of the selection', () => {
                const a = docFromTextNotation('(def |>|foo|>| [vec])');
                const b = docFromTextNotation('(def foo| [vec])');
                paredit.moveToRangeRight(a, textAndSelection(a)[1]);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Places cursor at the right end of the selection 2', () => {
                const a = docFromTextNotation('(|>|def foo|>| [vec])');
                const b = docFromTextNotation('(def foo| [vec])');
                paredit.moveToRangeRight(a, textAndSelection(a)[1]);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Move to right of given range, regardless of previous selection', () => {
                const a = docFromTextNotation('(|<|def|<| foo [vec])');
                const b = docFromTextNotation('(def foo |>|[vec]|>|)');
                const c = docFromTextNotation('(def foo [vec]|)');
                paredit.moveToRangeRight(a, textAndSelection(b)[1]);
                expect(textAndSelection(a)).toEqual(textAndSelection(c));
            });
        })

        describe('moveToRangeLeft', () => {
            it('Places cursor at the left end of the selection', () => {
                const a = docFromTextNotation('(def |>|foo|>| [vec])');
                const b = docFromTextNotation('(def |foo [vec])');
                paredit.moveToRangeLeft(a, textAndSelection(a)[1]);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Places cursor at the left end of the selection 2', () => {
                const a = docFromTextNotation('(|>|def foo|>| [vec])');
                const b = docFromTextNotation('(|def foo [vec])');
                paredit.moveToRangeLeft(a, textAndSelection(a)[1]);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Move to left of given range, regardless of previous selection', () => {
                const a = docFromTextNotation('(|<|def|<| foo [vec])');
                const b = docFromTextNotation('(def foo |>|[vec]|>|)');
                const c = docFromTextNotation('(def foo |[vec])');
                paredit.moveToRangeLeft(a, textAndSelection(b)[1]);
                expect(textAndSelection(a)).toEqual(textAndSelection(c));
            });
        });
    });

    describe('Reader tags', () => {
        it('rangeToForwardDownList', () => {
            const a = docFromTextNotation('(a(b(|c•#f•(#b •[:f :b :z])•#z•1)))');
            const b = docFromTextNotation('(a(b(|c•#f•(|#b •[:f :b :z])•#z•1)))');
            expect(paredit.rangeToForwardDownList(a)).toEqual(textAndSelection(b)[1]);
        });
        it('rangeToBackwardUpList', () => {
            const a = docFromTextNotation('(a(b(c•#f•(|#b •[:f :b :z])•#z•1)))');
            const b = docFromTextNotation('(a(b(c•|#f•(|#b •[:f :b :z])•#z•1)))');
            expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1]);
        });
        it('rangeToBackwardUpList 2', () => {
            // TODO: This is wrong! But real Paredit behaves as it should...
            const a = docFromTextNotation('(a(b(c•#f•(#b •|[:f :b :z])•#z•1)))');
            const b = docFromTextNotation('(a(b|(c•#f•(#b •|[:f :b :z])•#z•1)))');
            expect(paredit.rangeToBackwardUpList(a)).toEqual(textAndSelection(b)[1]);
        });
        it('dragSexprBackward', () => {
            const a = docFromTextNotation('(a(b(c•#f•|(#b •[:f :b :z])•#z•1)))');
            const b = docFromTextNotation('(a(b(#f•|(#b •[:f :b :z])•c•#z•1)))');
            paredit.dragSexprBackward(a)
            expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        it('dragSexprForward', () => {
            const a = docFromTextNotation('(a(b(c•#f•|(#b •[:f :b :z])•#z•1)))');
            const b = docFromTextNotation('(a(b(c•#z•1•#f•|(#b •[:f :b :z]))))');
            paredit.dragSexprForward(a)
            expect(textAndSelection(a)).toEqual(textAndSelection(b));
        });
        describe('Stacked readers', () => {
            const docText = '(c\n#f\n(#b \n[:f :b :z])\n#x\n#y\n1)';
            let doc: mock.MockDocument;

            beforeEach(() => {
                doc = new mock.MockDocument();
                doc.insertString(docText);
            });
            it('dragSexprBackward', () => {
                const a = docFromTextNotation('(c•#f•(#b •[:f :b :z])•#x•#y•|1)');
                const b = docFromTextNotation('(c•#x•#y•|1•#f•(#b •[:f :b :z]))');
                paredit.dragSexprBackward(a)
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('dragSexprForward', () => {
                const a = docFromTextNotation('(c•#f•|(#b •[:f :b :z])•#x•#y•1)');
                const b = docFromTextNotation('(c•#x•#y•1•#f•|(#b •[:f :b :z]))');
                paredit.dragSexprForward(a)
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
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
                const a = docFromTextNotation('(def foo [:foo :bar |<|:baz|<|])');
                const selDoc = docFromTextNotation('(def foo [:foo |:bar| :baz])');
                const b = docFromTextNotation('(def foo [:foo |<|:bar :baz|<|])');
                paredit.selectRangeBackward(a, [selDoc.selection.anchor, selDoc.selection.active]);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Contracts forward selection and extends backwards', () => {
                const a = docFromTextNotation('(def foo [:foo :bar |>|:baz|>|])');
                const selDoc = docFromTextNotation('(def foo [:foo |:bar| :baz])');
                const b = docFromTextNotation('(def foo [:foo |<|:bar |<|:baz])');
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
                const a = docFromTextNotation(`(c• [:|f '(0 "t")•   "b" :s]•)`);
                const b = docFromTextNotation(`(c• ['(0 "t") :|f•   "b" :s]•)`);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags backward in regular lists', () => {
                const a = docFromTextNotation(`(c• [:f '(0 "t")•   "b"| :s]•)`);
                const b = docFromTextNotation(`(c• [:f "b"|•   '(0 "t") :s]•)`);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('does not drag forward when sexpr is last in regular lists', () => {
                const dotText = `(c• [:f '(0 "t")•   "b" |:s ]•)`;
                const a = docFromTextNotation(dotText);
                const b = docFromTextNotation(dotText);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('does not drag backward when sexpr is last in regular lists', () => {
                const dotText = `(c• [ :|f '(0 "t")•   "b" :s ]•)`;
                const a = docFromTextNotation(dotText);
                const b = docFromTextNotation(dotText);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair forward in maps', () => {
                const a = docFromTextNotation(`(c• {:|e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`);
                const b = docFromTextNotation(`(c• {3 {:w? 'w}•   :|e '(e o ea)•   :t '(t i o im)•   :b 'b}•)`);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair backwards in maps', () => {
                const a = docFromTextNotation(`(c• {:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)|•   :b 'b}•)`);
                const b = docFromTextNotation(`(c• {:e '(e o ea)•   :t '(t i o im)|•   3 {:w? 'w}•   :b 'b}•)`);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair backwards in meta-data maps', () => {
                const a = docFromTextNotation(`(c• ^{:e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)|•   :b 'b}•)`);
                const b = docFromTextNotation(`(c• ^{:e '(e o ea)•   :t '(t i o im)|•   3 {:w? 'w}•   :b 'b}•)`);
                paredit.dragSexprBackward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags single sexpr forward in sets', () => {
                const a = docFromTextNotation(`(c• #{:|e '(e o ea)•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`);
                const b = docFromTextNotation(`(c• #{'(e o ea) :|e•   3 {:w? 'w}•   :t '(t i o im)•   :b 'b}•)`);
                paredit.dragSexprForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });

            it('drags pair in binding box', () => {
                const b = docFromTextNotation(`(c• [:e '(e o ea)•   3 {:w? 'w}•   :t |'(t i o im)•   :b 'b]•)`);
                const a = docFromTextNotation(`(c• [:e '(e o ea)•   3 {:w? 'w}•   :b 'b•   :t |'(t i o im)]•)`);
                paredit.dragSexprForward(b, ['c']);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
        });

        describe('backwardUp - one line', () => {
            it('Drags up from start of vector', () => {
                const b = docFromTextNotation(`(def foo [:|foo :bar :baz])`);
                const a = docFromTextNotation(`(def foo :|foo [:bar :baz])`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up from middle of vector', () => {
                const b = docFromTextNotation(`(def foo [:foo |:bar :baz])`);
                const a = docFromTextNotation(`(def foo |:bar [:foo :baz])`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up from end of vector', () => {
                const b = docFromTextNotation(`(def foo [:foo :bar :baz|])`);
                const a = docFromTextNotation(`(def foo :baz| [:foo :bar])`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up from start of list', () => {
                const b = docFromTextNotation(`(d|e|f foo [:foo :bar :baz])`);
                const a = docFromTextNotation(`de|f (foo [:foo :bar :baz])`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up without killing preceding line commments', () => {
                const b = docFromTextNotation(`(;;foo•de|f foo [:foo :bar :baz])`);
                const a = docFromTextNotation(`de|f•(;;foo• foo [:foo :bar :baz])`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up without killing preceding line commments or trailing parens', () => {
                const b = docFromTextNotation(`(def ;; foo•  |:foo)`);
                const a = docFromTextNotation(`|:foo•(def ;; foo•)`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
        });
        describe('backwardUp - multi-line', () => {
            it('Drags up from indented vector', () => {
                const b = docFromTextNotation(`((fn foo•  [x]•  [|:foo•   :bar•   :baz])• 1)`);
                const a = docFromTextNotation(`((fn foo•  [x]•  |:foo•  [:bar•   :baz])• 1)`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up from indented list', () => {
                const b = docFromTextNotation(`(|(fn foo•  [x]•  [:foo•   :bar•   :baz])• 1)`);
                const a = docFromTextNotation(`|(fn foo•  [x]•  [:foo•   :bar•   :baz])•(1)`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up from end of indented list', () => {
                const b = docFromTextNotation(`((fn foo•  [x]•  [:foo•   :bar•   :baz])• |1)`);
                const a = docFromTextNotation(`|1•((fn foo•  [x]•  [:foo•   :bar•   :baz]))`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags up from indented vector w/o killing preceding comment', () => {
                const b = docFromTextNotation(`((fn foo•  [x]•  [:foo•   ;; foo•   :b|ar•   :baz])• 1)`);
                const a = docFromTextNotation(`((fn foo•  [x]•  :b|ar•  [:foo•   ;; foo••   :baz])• 1)`);
                paredit.dragSexprBackwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
        });
        describe('forwardDown - one line', () => {
            it('Drags down into vector', () => {
                const b = docFromTextNotation(`(def f|oo [:foo :bar :baz])`);
                const a = docFromTextNotation(`(def [f|oo :foo :bar :baz])`);
                paredit.dragSexprForwardDown(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags down into vector past sexpression on the same level', () => {
                const b = docFromTextNotation(`(d|ef| foo [:foo :bar :baz])`);
                const a = docFromTextNotation(`(foo [def| :foo :bar :baz])`);
                paredit.dragSexprForwardDown(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags down into vector w/o killing line comments on the way', () => {
                const b = docFromTextNotation(`(d|ef ;; foo• [:foo :bar :baz])`);
                const a = docFromTextNotation(`(;; foo• [d|ef :foo :bar :baz])`);
                paredit.dragSexprForwardDown(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
        });
        describe('forwardUp', () => {
            it('Drags forward out of vector', () => {
                const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
                const a = docFromTextNotation(`((fn foo [x] [:foo] :b|ar)) :baz`);
                paredit.dragSexprForwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags forward out of vector w/o killing line comments on the way', () => {
                const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar ;; bar•])) :baz`);
                const a = docFromTextNotation(`((fn foo [x] [:foo ;; bar•] :b|ar)) :baz`);
                paredit.dragSexprForwardUp(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
        });
        describe('backwardDown', () => {
            it('Drags backward down into list', () => {
                const b = docFromTextNotation(`((fn foo [x] [:foo :bar])) :b|az`);
                const a = docFromTextNotation(`((fn foo [x] [:foo :bar]) :b|az)`);
                paredit.dragSexprBackwardDown(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it('Drags backward down into list w/o killing line comments on the way', () => {
                const b = docFromTextNotation(`((fn foo [x] [:foo :bar])) ;; baz•:b|az`);
                const a = docFromTextNotation(`((fn foo [x] [:foo :bar]) :b|az) ;; baz`);
                paredit.dragSexprBackwardDown(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
            it("Does not drag when can't drag down", () => {
                const b = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
                const a = docFromTextNotation(`((fn foo [x] [:foo :b|ar])) :baz`);
                paredit.dragSexprBackwardDown(b);
                expect(textAndSelection(b)).toStrictEqual(textAndSelection(a));
            });
        });
    });
    describe('edits', () => {
        describe('Close lists', () => {
            it('Advances cursor if at end of list of the same type', () => {
                const a = docFromTextNotation('(str "foo"|)');
                const b = docFromTextNotation('(str "foo")|');
                paredit.close(a, ')');
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Does not enter new closing parens in balanced doc', () => {
                const a = docFromTextNotation('(str |"foo")');
                const b = docFromTextNotation('(str |"foo")');
                paredit.close(a, ')');
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            xit('Enter new closing parens in unbalanced doc', () => {
                // TODO: Reinstall this test once the corresponding cursor test works
                //       (The extension actually behaves correctly.)
                const a = docFromTextNotation('(str |"foo"');
                const b = docFromTextNotation('(str )|"foo"');
                paredit.close(a, ')');
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Enter new closing parens in string', () => {
                const a = docFromTextNotation('(str "|foo"');
                const b = docFromTextNotation('(str ")|foo"');
                paredit.close(a, ')');
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
        });
        describe('String quoting', () => {
            it('Closes quote at end of string', () => {
                const a = docFromTextNotation('(str "foo|")');
                const b = docFromTextNotation('(str "foo"|)');
                paredit.stringQuote(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
        });
        describe('Slurping', () => {
            it('slurps form after list', () => {
                const a = docFromTextNotation('(str|) "foo"');
                const b = docFromTextNotation('(str| "foo")');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps, in multiline document', () => {
                const a = docFromTextNotation('(foo• (str| ) "foo")');
                const b = docFromTextNotation('(foo• (str| "foo"))');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps and adds leading space', () => {
                const a = docFromTextNotation('(s|tr)#(foo)');
                const b = docFromTextNotation('(s|tr #(foo))');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps without adding a space', () => {
                const a = docFromTextNotation('(s|tr )#(foo)');
                const b = docFromTextNotation('(s|tr #(foo))');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps, trimming inside whitespace', () => {
                const a = docFromTextNotation('(str|   )"foo"');
                const b = docFromTextNotation('(str| "foo")');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps, trimming outside whitespace', () => {
                const a = docFromTextNotation('(str|)   "foo"');
                const b = docFromTextNotation('(str| "foo")');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps, trimming inside and outside whitespace', () => {
                const a = docFromTextNotation('(str|   )   "foo"');
                const b = docFromTextNotation('(str| "foo")');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps form after empty list', () => {
                const a = docFromTextNotation('(|) "foo"');
                const b = docFromTextNotation('(| "foo")');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('leaves newlines when slurp', () => {
                const a = docFromTextNotation('(fo|o•)  bar');
                const b = docFromTextNotation('(fo|o•  bar)');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('slurps properly when closing paren is on new line', () => {
                // https://github.com/BetterThanTomorrow/calva/issues/1171
                const a = docFromTextNotation('(def foo•  (str|•   )•  42)');
                const b = docFromTextNotation('(def foo•  (str|•   •  42))');
                paredit.forwardSlurpSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
        });

        describe('Raise', () => {
            it('raises the current form when cursor is preceeding', () => {
                const a = docFromTextNotation('(comment•  (str |#(foo)))');
                const b = docFromTextNotation('(comment•  |#(foo))');
                paredit.raiseSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('raises the current form when cursor is trailing', () => {
                const a = docFromTextNotation('(comment•  (str #(foo)|))');
                const b = docFromTextNotation('(comment•  #(foo)|)');
                paredit.raiseSexp(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
        });
        describe('Kill character backwards (backspace)', () => {
            it('Leaves closing paren of empty list alone', () => {
                const a = docFromTextNotation('{::foo ()|• ::bar :foo}');
                const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes closing paren if unbalance', () => {
                const a = docFromTextNotation('{::foo )|• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Leaves opening paren of non-empty list alone', () => {
                const a = docFromTextNotation('{::foo (|a)• ::bar :foo}');
                const b = docFromTextNotation('{::foo |(a)• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Leaves opening quote of non-empty string alone', () => {
                const a = docFromTextNotation('{::foo "|a"• ::bar :foo}');
                const b = docFromTextNotation('{::foo |"a"• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Leaves closing quote of non-empty string alone', () => {
                const a = docFromTextNotation('{::foo "a"|• ::bar :foo}');
                const b = docFromTextNotation('{::foo "a|"• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes contents in strings', () => {
                const a = docFromTextNotation('{::foo "a|"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes contents in strings 2', () => {
                const a = docFromTextNotation('{::foo "a|a"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes contents in strings 3', () => {
                const a = docFromTextNotation('{::foo "aa|"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "a|"• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes quoted quote', () => {
                const a = docFromTextNotation('{::foo \\"|• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes quoted quote in string', () => {
                const a = docFromTextNotation('{::foo "\\"|"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes contents in list', () => {
                const a = docFromTextNotation('{::foo (a|)• ::bar :foo}');
                const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes empty list function', () => {
                const a = docFromTextNotation('{::foo (|)• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes empty set', () => {
                const a = docFromTextNotation('#{|}');
                const b = docFromTextNotation('|');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes empty literal function with trailing newline', () => {
                // https://github.com/BetterThanTomorrow/calva/issues/1079
                const a = docFromTextNotation('{::foo #(|)• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes open paren prefix characters', () => {
                // https://github.com/BetterThanTomorrow/calva/issues/1122
                const a = docFromTextNotation('#|(foo)');
                const b = docFromTextNotation('|(foo)');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes open map curly prefix/ns characters', () => {
                const a = docFromTextNotation('#:same|{:thing :here}');
                const b = docFromTextNotation('#:sam|{:thing :here}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes open set hash characters', () => {
                // https://github.com/BetterThanTomorrow/calva/issues/1122
                const a = docFromTextNotation('#|{:thing :here}');
                const b = docFromTextNotation('|{:thing :here}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Moves cursor past entire open paren, including prefix characters', () => {
                const a = docFromTextNotation('#(|foo)');
                const b = docFromTextNotation('|#(foo)');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Moves cursor only past the open curly for namespaced maps', () => {
                // Could be argued it should move past the entire reader tag, but anyway
                const a = docFromTextNotation('#:same{|:thing :here}');
                const b = docFromTextNotation('#:same|{:thing :here}');
                paredit.backspace(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
        });

        describe('Kill character forwards (delete)', () => {
            it('Leaves closing paren of empty list alone', () => {
                const a = docFromTextNotation('{::foo |()• ::bar :foo}');
                const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes closing paren if unbalance', () => {
                const a = docFromTextNotation('{::foo |)• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Leaves opening paren of non-empty list alone', () => {
                const a = docFromTextNotation('{::foo |(a)• ::bar :foo}');
                const b = docFromTextNotation('{::foo (|a)• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Leaves opening quote of non-empty string alone', () => {
                const a = docFromTextNotation('{::foo |"a"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Leaves closing quote of non-empty string alone', () => {
                const a = docFromTextNotation('{::foo "a|"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "a"|• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes contents in strings', () => {
                const a = docFromTextNotation('{::foo "|a"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes contents in strings 2', () => {
                const a = docFromTextNotation('{::foo "|aa"• ::bar :foo}');
                const b = docFromTextNotation('{::foo "|a"• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes quoted quote', () => {
                const a = docFromTextNotation('{::foo |\\"• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes quoted quote in string', () => {
                const a = docFromTextNotation('{::foo "|\\""• ::bar :foo}');
                const b = docFromTextNotation('{::foo "|"• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes contents in list', () => {
                const a = docFromTextNotation('{::foo (|a)• ::bar :foo}');
                const b = docFromTextNotation('{::foo (|)• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes empty list function', () => {
                const a = docFromTextNotation('{::foo (|)• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes empty set', () => {
                const a = docFromTextNotation('#{|}');
                const b = docFromTextNotation('|');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Deletes empty literal function with trailing newline', () => {
                // https://github.com/BetterThanTomorrow/calva/issues/1079
                const a = docFromTextNotation('{::foo #(|)• ::bar :foo}');
                const b = docFromTextNotation('{::foo |• ::bar :foo}');
                paredit.deleteForward(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
        });
        describe('addRichComment', () => {
            it('Adds Rich Comment after Top Level form', () => {
                const a = docFromTextNotation('(fo|o)••(bar)');
                const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
                paredit.addRichComment(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Inserts Rich Comment between Top Levels', () => {
                const a = docFromTextNotation('(foo)•|•(bar)');
                const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
                paredit.addRichComment(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Inserts Rich Comment between Top Levels, before Top Level form', () => {
                const a = docFromTextNotation('(foo)••|(bar)');
                const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
                paredit.addRichComment(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Inserts Rich Comment between Top Levels, after Top Level form', () => {
                const a = docFromTextNotation('(foo)|••(bar)');
                const b = docFromTextNotation('(foo)••(comment•  |•  )••(bar)');
                paredit.addRichComment(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Inserts Rich Comment between Top Levels, in comment', () => {
                const a = docFromTextNotation('(foo)•;foo| bar•(bar)');
                const b = docFromTextNotation('(foo)•;foo bar••(comment•  |•  )••(bar)');
                paredit.addRichComment(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Moves to Rich Comment below, if any', () => {
                const a = docFromTextNotation('(foo|)••(comment••bar••baz)');
                const b = docFromTextNotation('(foo)••(comment••|bar••baz)');
                paredit.addRichComment(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
            it('Moves to Rich Comment below, if any, looking behind line comments', () => {
                const a = docFromTextNotation('(foo|)••;;line comment••(comment••bar••baz)');
                const b = docFromTextNotation('(foo)••;;line comment••(comment••|bar••baz)');
                paredit.addRichComment(a);
                expect(textAndSelection(a)).toEqual(textAndSelection(b));
            });
        });

        describe('splice sexp', () => {
            it('splice empty', () => {
                const a = docFromTextNotation('|');
                paredit.spliceSexp(a);
                expect(text(a)).toEqual('');
            });

            it('splice list', () => {
                const a = docFromTextNotation('(a| b c)');
                paredit.spliceSexp(a);
                expect(text(a)).toEqual('a b c');
            });

            it('splice vector', () => {
                const a = docFromTextNotation('[a| b c]');
                paredit.spliceSexp(a);
                expect(text(a)).toEqual('a b c');
            });

            it('splice map', () => {
                const a = docFromTextNotation('{a| b}');
                paredit.spliceSexp(a);
                expect(text(a)).toEqual('a b');
            });


            it('splice nested', () => {
                const a = docFromTextNotation('[1 {ab| cd} 2]');
                paredit.spliceSexp(a);
                expect(text(a)).toEqual('[1 ab cd 2]');
            });

            // TODO: enable after fixing spliceSexp
            it('splice set', () => {
                const a = docFromTextNotation('#{a| b}');
                paredit.spliceSexp(a);
                expect(text(a)).toEqual('a b');
            });

            // NB: enabling this breaks bunch of other tests.
            //     Not sure why, but it can be run successfully by itself.
            xit('splice string', () => {
                const a = docFromTextNotation('"h|ello"');
                paredit.spliceSexp(a);
                expect(text(a)).toEqual('hello');
            });
        });
    });
});
