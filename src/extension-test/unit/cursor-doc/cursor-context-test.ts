import * as expect from 'expect';
import * as context from '../../../cursor-doc/cursor-context';
import { docFromTextNotation, textAndSelection } from '../common/text-notation';

describe('Cursor Contexts', () => {
    describe('Predicates', () => {
        describe('isAtLineStartInclWS', () => {
            it('returns true at the start of a line', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz'))).toBe(true);
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; baz  •|gaz'))).toBe(true);
            });
            it('returns true at line start with leading whitespace', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•   |;; bar•  ;; baz  •gaz'))).toBe(true);
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo• |  ;; bar•  ;; baz  •gaz'))).toBe(true);
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at end of line with only whitespace', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•    |•  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at start of line with only whitespace', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•|    •  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true in middle of line with only whitespace', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•  |  •  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at empty line', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•|•  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at line start with leading & trailing whitespace', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; bar• | ;; baz  •gaz'))).toBe(true);
            });
            it('returns false within a line (non-whitespace)', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';|; foo•   ;; bar•  ;; baz  •gaz'))).toBe(false);
            });
            it('returns false within a line with leading whitespace', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; |bar•  ;; baz  •gaz'))).toBe(false);
            });
            it('returns false at the end of a line', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo|•   ;; bar•  ;; baz  •gaz'))).toBe(false);
            });
            it('returns false at the end of document', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; baz  •gaz|'))).toBe(false);
            });
        });
        describe('isAtLineEndInclWS', () => {
            it('returns true at the end of a line', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar   •  ;; baz  •gaz|'))).toBe(true);
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo|•   ;; bar   •  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at line end with trailing whitespace', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar|  •  ;; baz  •gaz'))).toBe(true);
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar  |•  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at line end with leading & trailing whitespace', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar | •  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at end of line with only whitespace', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•    |•  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at start of line with only whitespace', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•|    •  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true in middle of line with only whitespace', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•  |  •  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at empty line', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•|•  ;; baz  •gaz'))).toBe(true);
            });
            it('returns true at line start with only leading & trailing whitespace', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar | •  ;; baz  •gaz'))).toBe(true);
            });
            it('returns false within a line (non-whitespace)', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; ba|z  •gaz'))).toBe(false);
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; ba|z  •gaz ;|;'))).toBe(false);
            });
            it('returns false within a line with trailing whitespace', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;|; baz  •gaz'))).toBe(false);
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; b|az  •gaz'))).toBe(false);
            });
            it('returns false at the start of a line', () => {
                expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•|  ;; baz  •gaz'))).toBe(false);
                expect(context.isAtLineEndInclWS(docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz'))).toBe(false);
            });
        });
    });
});
