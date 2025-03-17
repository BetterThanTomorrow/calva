/**
 * @module
 * Facilitator of code formatting by
 * converting original text to 'healed' formattable text,
 * and converting formatted 'healed' text to
 * an 'unhealed' formatted string fit for use as a substitute for the original
 */

import * as cursorDocUtils from '../../cursor-doc/utilities';

/**
 * 'Healed' text suitable for code-formatting
 * and details with which a formatted version of it
 * can be translated back to unhealed replacment text
 */
type BandageContext = {
  healedText: string;
  details: {
    originalIndent: number;
    originalText: string;
    eol: string;
    missingTexts: cursorDocUtils.MissingTexts;
  };
};

/**
 * Formattable text (fixed up to compensate for apparently missing list openers or closers)
 * and context with which to unbandage a formatted version of the same and recover the exact text
 * to substitute back into the document.
 * @param originalText Text to be reformatted
 * @param originalIndent Character offset where the first line of originalText begins
 * @param eol Newline characters that should be used in the code
 * @returns healedText - patched-up forms to be given to a code formatter, and other context the unbandage function needs
 */
export function bandage(originalText: string, originalIndent: number, eol: string): BandageContext {
  const missingTexts = cursorDocUtils.getMissingBrackets(originalText);
  const healedText = `${missingTexts.prepend}${originalText.trim()}${missingTexts.append}`;
  return {
    healedText,
    details: { eol, originalText, originalIndent, missingTexts },
  };
}

/**
 * Formatted substitute text derived from formattedHealedText by removing bandages and reimposing an indentation.
 * @param context Context from bandage
 * @param formattedHealedText Formatted version of the healedText
 * @returns
 */
export function unbandage(context: BandageContext, formattedHealedText: string) {
  const d = context.details;
  const leadingWs = d.originalText.match(/^\s*/)[0];
  const trailingWs = d.originalText.match(/\s*$/)[0];
  const leadingEolPos = leadingWs.lastIndexOf(d.eol);
  const startIndent =
    leadingEolPos === -1 ? d.originalIndent : leadingWs.length - leadingEolPos - d.eol.length;
  const formattedText = formattedHealedText
    .substring(
      d.missingTexts.prepend.length,
      d.missingTexts.prepend.length + formattedHealedText.length - d.missingTexts.append.length
    )
    .split(d.eol)
    .map((line: string, i: number) => (i === 0 ? line : `${' '.repeat(startIndent)}${line}`))
    .join(d.eol);
  const newText = `${formattedText.startsWith(leadingWs) ? '' : leadingWs}${formattedText}${
    formattedText.endsWith(trailingWs) ? '' : trailingWs
  }`;
  return newText;
}
