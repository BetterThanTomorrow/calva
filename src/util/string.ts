/**
 * Prepends a `:` to a string, so it can be used as an EDN keyword.
 * (Or at least made to look like one).
 * @param  {string} s the string to be keywordized
 * @return {string} keywordized string
 */
export function keywordize(s: string): string {
    return s.replace(/^[\s,:]*/, ":");
}

/**
 * Remove the leading `:` from strings (EDN keywords)'
 * NB: Does not check if the leading character is really a `:`.
 * @param  {string} kw
 * @return {string} kw without the first character
 */
export function unKeywordize(kw: string): string {
    return kw.replace(/^[\s,:]*/, "").replace(/[\s,:]*$/, "")
}
