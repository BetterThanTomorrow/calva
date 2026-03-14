/**
 * Prepends a `:` to a string, so it can be used as an EDN keyword.
 * (Or at least made to look like one).
 * @param  {string} s the string to be keywordized
 * @return {string} keywordized string
 */
function keywordize(s: string): string {
  return s.replace(/^[\s,:]*/, ':');
}

/**
 * Remove the leading `:` from strings (EDN keywords)'
 * NB: Does not check if the leading character is really a `:`.
 * @param  {string} kw
 * @return {string} kw without the first character
 */
function unKeywordize(kw: string): string {
  return kw.replace(/^[\s,:]*/, '').replace(/[\s,:]*$/, '');
}

function getIndexAfterLastNonWhitespace(text: string): number {
  const textTrimmed = text.trim();
  const lastNonWhitespaceOrEolChar = textTrimmed[textTrimmed.length - 1];
  return text.lastIndexOf(lastNonWhitespaceOrEolChar) + 1;
}

function getTextAfterLastOccurrenceOfSubstring(
  text: string,
  substring: string
): string | undefined {
  const indexOfLastPrompt = text.lastIndexOf(substring);
  if (indexOfLastPrompt === -1) {
    return text;
  }
  const indexOfEndOfPrompt = indexOfLastPrompt + substring.length;
  return text.substring(indexOfEndOfPrompt);
}

export function escapeStringRegexp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isNonEmptyString(value: any): value is string {
  return typeof value == 'string' && value.length > 0;
}

/**
 * Build a regex pattern that matches a var name exactly, accounting for
 * the namespace-qualified format returned by orchard (e.g. "my.ns/a-test").
 * The pattern anchors at "/" and end-of-string so that "a-test" does not
 * match "b-a-test" or "a-test-b".
 */
export function testNameSearchPattern(testName: string): string {
  return `/${escapeStringRegexp(testName)}$`;
}

export {
  keywordize,
  unKeywordize,
  getIndexAfterLastNonWhitespace,
  getTextAfterLastOccurrenceOfSubstring,
};
