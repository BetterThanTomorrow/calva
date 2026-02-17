/** Matches one or more leading semicolons (`;`, `;;`, `;;;`, etc.) */
export const commentPrefixPattern = /^;+/;

export function calculateCommentPrefixRemovalEnd(
  lineText: string,
  firstNonWhitespace: number
): number | undefined {
  const remainder = lineText.slice(firstNonWhitespace);
  const match = remainder.match(commentPrefixPattern);
  if (!match) {
    return undefined;
  }

  let removalEnd = firstNonWhitespace + match[0].length;
  while (removalEnd < lineText.length && lineText[removalEnd] === ' ') {
    removalEnd++;
  }

  return removalEnd;
}
