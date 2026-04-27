import * as expectLib from 'expect';
import * as context from '../../../cursor-doc/cursor-context';
import * as textNotation from '../common/text-notation';

describe('Cursor Contexts', () => {
  describe('cursorInString', () => {
    it('is true in string', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('foo•   "bar•  |baz"•gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInString')).toBe(true);
    });
    it('is false outside after string', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('foo•   "bar•  baz"|•gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInString')).toBe(false);
    });
    it('is true in regexp', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('foo•   #"bar•  ba|z"•gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInString')).toBe(true);
    });
    it('is false in regexp open token', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('foo•   #|"bat bar•  baz"•gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInString')).toBe(false);
    });
  });
  describe('cursorInComment', () => {
    it('is true in comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; f|oo•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is true adjacent before comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is true in whitespace between SOL and comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is true adjacent after comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo |•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is false in symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •g|az   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
    it('is false adjacent after symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz|   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
    it('is false in whitespace after symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz |  ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
    it('is true after symbol adjacent before comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   |;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(true);
    });
    it('is false in leading ws on line after comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('(+• ;foo• | 2)')
      );
      expectLib.expect(contexts.includes('calva:cursorInComment')).toBe(false);
    });
  });
  describe('cursorBeforeComment', () => {
    it('is false in comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; fo|o•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is true adjacent before comment starting a line', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is true adjacent before comment with space before', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(' |;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is false before comment with space between', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('| ;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is false adjacent before comment on line with leading witespace and preceding comment line', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(' ;; foo• |;; bar')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is true after symbol in whitespace between SOL and comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(' foo•|   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(true);
    });
    it('is false at SOL on a comment line with more comment lines following', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •|   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false at empty line squeezed in along comments lines', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   •|•   •   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false after comment lines before symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  |•gaz   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false in symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •g|az   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false adjacent after symbol after comment lines', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz|   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false in whitespace after symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz |  ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is true adjacent before comment after symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   |;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
    it('is false at EOT after comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   ;;  |')
      );
      expectLib.expect(contexts.includes('calva:cursorBeforeComment')).toBe(false);
    });
  });
  describe('cursorAfterComment', () => {
    it('is false in comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; fo|o•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false adjacent before comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false in whitespace between SOL and comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false at EOL on a comment line with more comment lines following', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo |•   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false at empty line squeezed in along comments lines', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   •|•   •   ;; bar•  ;; baz  •gaz')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is true after comment lines before symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  |•gaz   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(true);
    });
    it('is false in symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •g|az   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false adjacent after symbol after comment lines', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz|   ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is false in whitespace after symbol', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz |  ;;  ')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(false);
    });
    it('is true at EOT after comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; foo •   ;; bar•  ;; baz  •gaz   ;;  |')
      );
      expectLib.expect(contexts.includes('calva:cursorAfterComment')).toBe(true);
    });
  });
  describe('isAtLineStartInclWS', () => {
    it('returns true at the start of a line', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
          )
        )
        .toBe(true);
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar•  ;; baz  •|gaz')
          )
        )
        .toBe(true);
    });
    it('returns true at line start with leading whitespace', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•   |;; bar•  ;; baz  •gaz')
          )
        )
        .toBe(true);
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo• |  ;; bar•  ;; baz  •gaz')
          )
        )
        .toBe(true);
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•|   ;; bar•  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns true at end of line with only whitespace', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•    |•  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns true at start of line with only whitespace', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•|    •  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns true in middle of line with only whitespace', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•  |  •  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns true at empty line', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(textNotation.docFromTextNotation(';; foo•|•  ;; baz  •gaz'))
        )
        .toBe(true);
    });
    it('returns true at line start with leading & trailing whitespace', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar• | ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns false within a line (non-whitespace)', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';|; foo•   ;; bar•  ;; baz  •gaz')
          )
        )
        .toBe(false);
    });
    it('returns false within a line with leading whitespace', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; |bar•  ;; baz  •gaz')
          )
        )
        .toBe(false);
    });
    it('returns false at the end of a line', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo|•   ;; bar•  ;; baz  •gaz')
          )
        )
        .toBe(false);
    });
    it('returns false at the end of document', () => {
      expectLib
        .expect(
          context.isAtLineStartInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar•  ;; baz  •gaz|')
          )
        )
        .toBe(false);
    });
  });
  describe('isAtLineEndInclWS', () => {
    it('returns true at the end of a line', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar   •  ;; baz  •gaz|')
          )
        )
        .toBe(true);
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo|•   ;; bar   •  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns true at line end with trailing whitespace', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar|  •  ;; baz  •gaz')
          )
        )
        .toBe(true);
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar  |•  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns true at line end with leading & trailing whitespace', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar | •  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns true at end of line with only whitespace', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(textNotation.docFromTextNotation(';; foo•    |•  ;; baz  •gaz'))
        )
        .toBe(true);
    });
    it('returns true at start of line with only whitespace', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(textNotation.docFromTextNotation(';; foo•|    •  ;; baz  •gaz'))
        )
        .toBe(true);
    });
    it('returns true in middle of line with only whitespace', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(textNotation.docFromTextNotation(';; foo•  |  •  ;; baz  •gaz'))
        )
        .toBe(true);
    });
    it('returns true at empty line', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(textNotation.docFromTextNotation(';; foo•|•  ;; baz  •gaz'))
        )
        .toBe(true);
    });
    it('returns true at line start with only leading & trailing whitespace', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar | •  ;; baz  •gaz')
          )
        )
        .toBe(true);
    });
    it('returns false within a line (non-whitespace)', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar•  ;; ba|z  •gaz')
          )
        )
        .toBe(false);
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar•  ;; ba|z  •gaz ;|;')
          )
        )
        .toBe(false);
    });
    it('returns false within a line with trailing whitespace', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar•  ;|; baz  •gaz')
          )
        )
        .toBe(false);
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar•  ;; b|az  •gaz')
          )
        )
        .toBe(false);
    });
    it('returns false at the start of a line', () => {
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation(';; foo•   ;; bar•|  ;; baz  •gaz')
          )
        )
        .toBe(false);
      expectLib
        .expect(
          context.isAtLineEndInclWS(
            textNotation.docFromTextNotation('|;; foo•   ;; bar•  ;; baz  •gaz')
          )
        )
        .toBe(false);
    });
  });
  describe('cursorInWhitespaceAfterComment', () => {
    it('is false in whitespace directly after comment; the parser considers this part of a comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; comment line | ')
      );
      expectLib.expect(contexts.includes('calva:cursorInWhitespaceAfterComment')).toBe(false);
    });
    it('is true after newline after comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; comment line•| ')
      );
      expectLib.expect(contexts.includes('calva:cursorInWhitespaceAfterComment')).toBe(true);
    });
    it('is true in whitespace after newlines after comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(':foo ;; comment line•• •  | ')
      );
      expectLib.expect(contexts.includes('calva:cursorInWhitespaceAfterComment')).toBe(true);
    });
    it('is false after a symbol', () => {
      const contexts = context.determineContexts(textNotation.docFromTextNotation(':foo | '));
      expectLib.expect(contexts.includes('calva:cursorInWhitespaceAfterComment')).toBe(false);
    });
    it('is false after symbol, newlines, and whitespace', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation('{:foo :bar}•• •  | ')
      );
      expectLib.expect(contexts.includes('calva:cursorInWhitespaceAfterComment')).toBe(false);
    });
    it('is false inside a comment', () => {
      const contexts = context.determineContexts(
        textNotation.docFromTextNotation(';; comment| line')
      );
      expectLib.expect(contexts.includes('calva:cursorInWhitespaceAfterComment')).toBe(false);
    });
    it('is false at the beginning of a document', () => {
      const contexts = context.determineContexts(textNotation.docFromTextNotation('| '));
      expectLib.expect(contexts.includes('calva:cursorInWhitespaceAfterComment')).toBe(false);
    });
  });
});
