import * as expect from 'expect';
import { calculateCommentPrefixRemovalEnd } from '../../../comment-prefix';

function stripLeadingCommentPrefix(lineText: string): string {
  const firstNonWhitespace = lineText.search(/\S|$/);
  const removalEnd = calculateCommentPrefixRemovalEnd(lineText, firstNonWhitespace);
  if (removalEnd === undefined) {
    return lineText;
  }
  return lineText.slice(0, firstNonWhitespace) + lineText.slice(removalEnd);
}

describe('prefix removal', () => {
  it('strips single semicolon prefix and following space', () => {
    expect(stripLeadingCommentPrefix('  ; code')).toBe('  code');
  });

  it('strips double semicolon prefix and following space', () => {
    expect(stripLeadingCommentPrefix('  ;; code')).toBe('  code');
  });

  it('strips triple semicolon prefix and following space', () => {
    expect(stripLeadingCommentPrefix('  ;;; header')).toBe('  header');
  });

  it('strips semicolon prefix and all immediate following spaces', () => {
    expect(stripLeadingCommentPrefix(';;;   header')).toBe('header');
  });

  it('keeps non-comment lines unchanged', () => {
    expect(stripLeadingCommentPrefix('  code')).toBe('  code');
  });
});
