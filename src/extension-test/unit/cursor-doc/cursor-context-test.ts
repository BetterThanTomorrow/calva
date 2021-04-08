import * as expect from 'expect';
import * as context from '../../../cursor-doc/cursor-context';
import { docFromTextNotation, textAndSelection } from '../common/text-notation';

describe('Cursor Contexts', () => {
    describe('Predicates', () => {
        describe('isAtLineStartInclWS', () => {
            it('returns true at the start of a line', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz'))).toBe(true);
                expect(context.isAtLineStartInclWS(docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •|gaz'))).toBe(true);
            });
            it('returns true at line start with leading whitespace', () => {
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•   |;; bar•  ;; baz  •gaz'))).toBe(true);
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo• |  ;; bar•  ;; baz  •gaz'))).toBe(true);
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz'))).toBe(true);
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
                expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; baz  •gaz|'))).toBe(false);
            });
        });
    });
});
