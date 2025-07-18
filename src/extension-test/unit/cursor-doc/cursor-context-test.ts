import * as expect from 'expect';
import * as context from '../../../cursor-doc/cursor-context';
import { docFromTextNotation, textAndSelection } from '../common/text-notation';

describe('Cursor Contexts', () => {
  describe('cursorInString', () => {
    it('is true in string', () => {
      const contexts = context.determineContexts(docFromTextNotation('foo•   "bar•  |baz"•gaz'));
      expect(contexts.includes('calva:cursorInString')).toBe(true);
    });
    it('is false outside after string', () => {
      const contexts = context.determineContexts(docFromTextNotation('foo•   "bar•  baz"|•gaz'));
      expect(contexts.includes('calva:cursorInString')).toBe(false);
    });
    it('is true in regexp', () => {
      const contexts = context.determineContexts(docFromTextNotation('foo•   #"bar•  ba|z"•gaz'));
      expect(contexts.includes('calva:cursorInString')).toBe(true);
    });
    it('is false in regexp open token', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('foo•   #|"bat bar•  baz"•gaz')
      );
      expect(contexts.includes('calva:cursorInString')).toBe(false);
    });
  });
  describe('cursorInComment', () => {
    it('is true in comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; f|oo•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is true adjacent before comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is true in whitespace between SOL and comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is true adjacent after comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo |•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is false in symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •g|az   ;;  ')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
    it('is false adjacent after symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz|   ;;  ')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
    it('is false in whitespace after symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz |  ;;  ')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
    it('is true after symbol adjacent before comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   |;;  ')
      );
      expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is false in leading ws on line after comment', () => {
      const contexts = context.determineContexts(docFromTextNotation('(+• ;foo• | 2)'));
      expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
  });
  describe('cursorSeesCommentPrev', () => {
    it('sees a comment upstream', () => {
      const contexts = context.determineContexts(docFromTextNotation(';; my comment |'));
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
    it('sees an sexp upstream', () => {
      const contexts = context.determineContexts(docFromTextNotation('(+ 1 1)|'));
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(false);
    });
    it('sees an sexp upstream and a comment downstream, cursor on the comment offset', () => {
      const contexts = context.determineContexts(docFromTextNotation('(+ 1 1) |; my comment'));
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(false);
    });
    it('sees a comment followed by an sexp upstream', () => {
      const contexts = context.determineContexts(docFromTextNotation('(+ 1 1)  ;| my comment \n'));
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
    it('inside an sexp, no comment seen', () => {
      const contexts = context.determineContexts(docFromTextNotation('(+ 1 1|)  ; my comment \n'));
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(false);
    });
    it('beginning of document is treated as comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('\n  | (+ 1 1)  ; my comment \n')
      );
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
    it('sees a comment prev when cursor is after a comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('(do-something) ; a comment|')
      );
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
    it('sees a comment upstream when cursor is on an empty line', () => {
      const contexts = context.determineContexts(docFromTextNotation(';; a comment\n|\n(def a 1)'));
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
    it('does not see a comment upstream when cursor is on an empty line with code after', () => {
      const contexts = context.determineContexts(docFromTextNotation('(def a 1)\n|\n(def b 2)'));
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(false);
    });
    it('should see a comment upstream when there are multiple breaks', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('{}\n    ;; More comments go |here\n\n#{}\n')
      );
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
    it('should see a comment upstream when the previous token is a close', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('{}\n    {};; More comments go |here\n\n#{}\n')
      );
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
    it('should see a comment upstream when the previous token is an sexp', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('{}\n    {};|; More comments go here\n\n#{}\n')
      );
      expect(contexts.includes('calva:cursorSeesCommentPrev')).toBe(true);
    });
  });
  describe('cursorSeesCommentNext', () => {
    it('sees a comment downstream', () => {
      const contexts = context.determineContexts(docFromTextNotation('| ;; my comment'));
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(true);
    });
    it('sees an sexp downstream', () => {
      const contexts = context.determineContexts(docFromTextNotation('| (+ 1 1)'));
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(false);
    });
    it('sees an sexp followed by a comment downstream', () => {
      const contexts = context.determineContexts(docFromTextNotation('| (+ 1 1) ; my comment'));
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(false);
    });
    it('sees a comment followed by an sexp downstream', () => {
      const contexts = context.determineContexts(docFromTextNotation('| ; my comment \n (+ 1 1) '));
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(true);
    });
    it('sees a comment downstream with sexp upstream', () => {
      const contexts = context.determineContexts(docFromTextNotation('(+ 1 1) | ; my comment \n'));
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(true);
    });
    it('end of document is treated as comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(' (+ 1 1)  ; my comment \n|\n')
      );
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(true);
    });
    it('sees a comment downstream when cursor is on an empty line', () => {
      const contexts = context.determineContexts(docFromTextNotation('(def a 1)\n|\n;; a comment'));
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(true);
    });
    it('does not see a comment downstream when cursor is on an empty line with code after', () => {
      const contexts = context.determineContexts(docFromTextNotation('(def a 1)\n|\n(def b 2)'));
      expect(contexts.includes('calva:cursorSeesCommentNext')).toBe(false);
    });
  });
  describe('cursorBeforeComment', () => {
    it('is false in comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; fo|o•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is true adjacent before comment starting a line', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is true adjacent before comment with space before', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(' |;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is false before comment with space between', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('| ;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is false adjacent before comment on line with leading witespace and preceding comment line', () => {
      const contexts = context.determineContexts(docFromTextNotation(' ;; foo• |;; bar'));
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is true after symbol in whitespace between SOL and comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(' foo•|   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is false at SOL on a comment line with more comment lines following', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •|   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false at empty line squeezed in along comments lines', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   •|•   •   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false after comment lines before symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  |•gaz   ;;  ')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false in symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •g|az   ;;  ')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false adjacent after symbol after comment lines', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz|   ;;  ')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false in whitespace after symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz |  ;;  ')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is true adjacent before comment after symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   |;;  ')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false at EOT after comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   ;;  |')
      );
      expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
  });
  describe('cursorAfterComment', () => {
    it('is false in comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; fo|o•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false adjacent before comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false in whitespace between SOL and comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false at EOL on a comment line with more comment lines following', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo |•   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false at empty line squeezed in along comments lines', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   •|•   •   ;; bar•  ;; baz  •gaz')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is true after comment lines before symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  |•gaz   ;;  ')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(true);
    });
    it('is false in symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •g|az   ;;  ')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false adjacent after symbol after comment lines', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz|   ;;  ')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false in whitespace after symbol', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz |  ;;  ')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is true at EOT after comment', () => {
      const contexts = context.determineContexts(
        docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   ;;  |')
      );
      expect(contexts.includes('calva:cursorAfterComment')).toBe(true);
    });
  });
  describe('isAtLineStartInclWS', () => {
    it('returns true at the start of a line', () => {
      expect(
        context.isAtLineStartInclWS(docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz'))
      ).toBe(true);
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; baz  •|gaz'))
      ).toBe(true);
    });
    it('returns true at line start with leading whitespace', () => {
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo•   |;; bar•  ;; baz  •gaz'))
      ).toBe(true);
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo• |  ;; bar•  ;; baz  •gaz'))
      ).toBe(true);
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz'))
      ).toBe(true);
    });
    it('returns true at end of line with only whitespace', () => {
      expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•    |•  ;; baz  •gaz'))).toBe(
        true
      );
    });
    it('returns true at start of line with only whitespace', () => {
      expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•|    •  ;; baz  •gaz'))).toBe(
        true
      );
    });
    it('returns true in middle of line with only whitespace', () => {
      expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•  |  •  ;; baz  •gaz'))).toBe(
        true
      );
    });
    it('returns true at empty line', () => {
      expect(context.isAtLineStartInclWS(docFromTextNotation(';; foo•|•  ;; baz  •gaz'))).toBe(
        true
      );
    });
    it('returns true at line start with leading & trailing whitespace', () => {
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; bar• | ;; baz  •gaz'))
      ).toBe(true);
    });
    it('returns false within a line (non-whitespace)', () => {
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';|; foo•   ;; bar•  ;; baz  •gaz'))
      ).toBe(false);
    });
    it('returns false within a line with leading whitespace', () => {
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; |bar•  ;; baz  •gaz'))
      ).toBe(false);
    });
    it('returns false at the end of a line', () => {
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo|•   ;; bar•  ;; baz  •gaz'))
      ).toBe(false);
    });
    it('returns false at the end of document', () => {
      expect(
        context.isAtLineStartInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; baz  •gaz|'))
      ).toBe(false);
    });
  });
  describe('isAtLineEndInclWS', () => {
    it('returns true at the end of a line', () => {
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar   •  ;; baz  •gaz|'))
      ).toBe(true);
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo|•   ;; bar   •  ;; baz  •gaz'))
      ).toBe(true);
    });
    it('returns true at line end with trailing whitespace', () => {
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar|  •  ;; baz  •gaz'))
      ).toBe(true);
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar  |•  ;; baz  •gaz'))
      ).toBe(true);
    });
    it('returns true at line end with leading & trailing whitespace', () => {
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar | •  ;; baz  •gaz'))
      ).toBe(true);
    });
    it('returns true at end of line with only whitespace', () => {
      expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•    |•  ;; baz  •gaz'))).toBe(
        true
      );
    });
    it('returns true at start of line with only whitespace', () => {
      expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•|    •  ;; baz  •gaz'))).toBe(
        true
      );
    });
    it('returns true in middle of line with only whitespace', () => {
      expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•  |  •  ;; baz  •gaz'))).toBe(
        true
      );
    });
    it('returns true at empty line', () => {
      expect(context.isAtLineEndInclWS(docFromTextNotation(';; foo•|•  ;; baz  •gaz'))).toBe(true);
    });
    it('returns true at line start with only leading & trailing whitespace', () => {
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar | •  ;; baz  •gaz'))
      ).toBe(true);
    });
    it('returns false within a line (non-whitespace)', () => {
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; ba|z  •gaz'))
      ).toBe(false);
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; ba|z  •gaz ;|;'))
      ).toBe(false);
    });
    it('returns false within a line with trailing whitespace', () => {
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;|; baz  •gaz'))
      ).toBe(false);
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•  ;; b|az  •gaz'))
      ).toBe(false);
    });
    it('returns false at the start of a line', () => {
      expect(
        context.isAtLineEndInclWS(docFromTextNotation(';; foo•   ;; bar•|  ;; baz  •gaz'))
      ).toBe(false);
      expect(
        context.isAtLineEndInclWS(docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz'))
      ).toBe(false);
    });
  });
});
