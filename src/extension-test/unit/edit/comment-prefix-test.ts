import * as expectLib from 'expect';
import * as commentPrefix from '../../../comment-prefix';

function stripLeadingCommentPrefix(lineText: string): string {
  const firstNonWhitespace = lineText.search(/\S|$/);
  const removalEnd = commentPrefix.calculateCommentPrefixRemovalEnd(lineText, firstNonWhitespace);
  if (removalEnd === undefined) {
    return lineText;
  }
  return lineText.slice(0, firstNonWhitespace) + lineText.slice(removalEnd);
}

describe('prefix removal', () => {
  it('strips single semicolon prefix and following space', () => {
    expectLib.expect(stripLeadingCommentPrefix('  ; code')).toBe('  code');
  });

  it('strips double semicolon prefix and following space', () => {
    expectLib.expect(stripLeadingCommentPrefix('  ;; code')).toBe('  code');
  });

  it('strips triple semicolon prefix and following space', () => {
    expectLib.expect(stripLeadingCommentPrefix('  ;;; header')).toBe('  header');
  });

  it('strips semicolon prefix and one separating space before content', () => {
    expectLib.expect(stripLeadingCommentPrefix(';;;   header')).toBe('  header');
  });

  it('preserves indentation spaces after comment prefix', () => {
    expectLib.expect(stripLeadingCommentPrefix(';;       h)')).toBe('      h)');
  });

  it('strips fully blank commented line to empty', () => {
    expectLib.expect(stripLeadingCommentPrefix(';;      ')).toBe('');
  });

  it('keeps non-comment lines unchanged', () => {
    expectLib.expect(stripLeadingCommentPrefix('  code')).toBe('  code');
  });
});
