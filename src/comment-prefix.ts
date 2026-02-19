/** Matches one or more leading semicolons (`;`, `;;`, `;;;`, etc.) */
const commentPrefixPattern = /^;+/;

/**
 * Returns the first position from `candidatePositions` where a comment prefix
 * (one or more semicolons) starts, or `undefined` if none match.
 */
export function findCommentPrefixStart(
  lineText: string,
  candidatePositions: number[]
): number | undefined {
  for (const pos of candidatePositions) {
    if (commentPrefixPattern.test(lineText.slice(pos))) {
      return pos;
    }
  }
  return undefined;
}

/**
 * Calculates the end index for removing a comment prefix (semicolons + trailing space)
 * from a line of text. Returns the index up to which characters should be removed,
 * accounting for the semicolon(s) and a single trailing space (or all trailing spaces
 * if the line is otherwise empty after the prefix).
 *
 * @param lineText - The full text of the line
 * @param removalStart - The index at which the comment prefix starts
 * @returns The end index for removal, or `undefined` if no comment prefix is found
 */
export function calculateCommentPrefixRemovalEnd(
  lineText: string,
  removalStart: number
): number | undefined {
  const remainder = lineText.slice(removalStart);
  const match = remainder.match(commentPrefixPattern);
  if (!match) {
    return undefined;
  }

  let removalEnd = removalStart + match[0].length;
  if (removalEnd < lineText.length && lineText[removalEnd] === ' ') {
    let spaceRunEnd = removalEnd;
    // If the line is otherwise empty after the comment prefix, remove all trailing spaces as well
    while (spaceRunEnd < lineText.length && lineText[spaceRunEnd] === ' ') {
      spaceRunEnd++;
    }

    // If we reached the end of the line, remove all spaces.
    //  Otherwise, just remove one space after the comment prefix.
    if (spaceRunEnd === lineText.length) {
      removalEnd = spaceRunEnd;
    } else {
      removalEnd++;
    }
  }

  return removalEnd;
}
