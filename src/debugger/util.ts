import { LispTokenCursor } from '../cursor-doc/token-cursor';
import { assertIsDefined } from '../utilities';

function moveCursorPastStringInList(tokenCursor: LispTokenCursor, s: string): void {
  const range = tokenCursor.rangeForList(1);
  assertIsDefined(range, 'Expected range to be found!');
  const [listOffsetStart, listOffsetEnd] = range;
  const text = tokenCursor.doc.getText(listOffsetStart, listOffsetEnd - 1);

  const stringIndexInList = text.indexOf(s);
  if (stringIndexInList !== -1) {
    const coorOffset = listOffsetStart + stringIndexInList;
    while (tokenCursor.offsetStart !== coorOffset) {
      tokenCursor.forwardSexp();
      tokenCursor.forwardWhitespace();
    }
    tokenCursor.forwardSexp();
  } else {
    throw 'Cannot find string in list';
  }
}

function moveTokenCursorToBreakpoint(
  tokenCursor: LispTokenCursor,
  debugResponse: any
): LispTokenCursor {
  const errorMessage = 'Error finding position of breakpoint';
  const range = tokenCursor.rangeForDefun(tokenCursor.offsetStart);
  assertIsDefined(range, 'Expected range to be found!');
  const [_, defunEnd] = range;
  let inSyntaxQuote = false;

  const coor = [...debugResponse.coor]; // Copy the array so we do not modify the one stored in state

  for (let i = 0; i < coor.length; i++) {
    while (!tokenCursor.downListSkippingMeta()) {
      tokenCursor.next();
    }
    const previousToken = tokenCursor.getPrevToken();

    // Check if we just entered a syntax quote, since we have to account for how syntax quoted forms are read
    // `(. .) is read as (seq (concat (list .) (list .))).
    if (/.*`(\[|\{|\()$/.test(previousToken.raw)) {
      inSyntaxQuote = true;
    }

    if (inSyntaxQuote) {
      i++; // Ignore this coor and move to the next

      // A syntax quote is ending - this happens if ~ or ~@ precedes a form
      if (previousToken.raw.match(/~@?/)) {
        inSyntaxQuote = false;
      }
    }

    if (inSyntaxQuote) {
      if (!previousToken.raw.endsWith('(')) {
        // Non-list seqs like `[] and `{} are read with an extra (apply vector ...) or (apply hash-map ...)
        // Ignore this coor too
        i++;
      }
      // Now we're inside the `concat` form, but we need to ignore the actual `concat` symbol
      coor[i]--;
    }

    // #() expands to (fn* ([] ...)) and this is what coor is calculated with, so ignore this coor and move to the next
    if (previousToken.raw.endsWith('#(')) {
      i++;
    }

    // If coor is a string it represents a map key
    if (typeof coor[i] === 'string') {
      moveCursorPastStringInList(tokenCursor, coor[i]);
    } else {
      for (let k = 0; k < coor[i]; k++) {
        if (!tokenCursor.forwardSexp(true, true, true)) {
          throw errorMessage;
        }
      }
    }
  }

  // Move past the target sexp
  if (!tokenCursor.forwardSexp(true, true, true)) {
    throw errorMessage;
  }

  // Make sure we're still inside the original instrumented form, otherwise something went wrong
  if (tokenCursor.offsetStart > defunEnd) {
    throw errorMessage;
  }

  return tokenCursor;
}

export { moveTokenCursorToBreakpoint };
