/**
 * @module
 * Adapter between a code reformatter and a multi-cursor VS Code document,
 * that finds a set of whitespace edits to transform an original code
 * block to an edited code block - on the understanding that the formatter
 * intends to change only whitespace and that changing more than the minimum
 * may mess up the document's cursors.
 */

/** One step in transforming an unformatted
 * document fragment to a formatted one by adjusting whitespace.
 * start and end are offsets into the original document.
 */
export type WhitespaceChange = {
  start: number;
  end: number;
  text: string;
};

/** Whitespace and substance that immediately follows it.
 * Pre-format and re-formatted text can be expressed
 * as an array of SpacedUnit. The substance members
 * of the pre- and re-formatted arrays can be aligned,
 * then changes in whitespace size can be translated to edits.
 * The 'special' flag forces the spaces to generate a document
 * edit even if the document already has the same spaces
 * (to trigger the side-effect of moving a cursor that may
 * have been within those spaces)
 */
type SpacedUnit = [spaces: string, stuff: string, special: boolean];

/** Array of [spaces, nonspaces] which if concatenated would equal s.
 * In the Clojure custom, recognizes comma and JS regex \s as spaces.
 */
function spacedUnits(s: string): SpacedUnit[] {
  // Array of whitespace, text, whitespace, text, ..., text:
  // Start with array of alternating space & text starting with either:
  const frags = s.match(/[\s,]+|[^\s,]+/g);
  // Null means s was empty
  if (!frags) {
    return [];
  }
  // Ensure 1st item is of whitespace:
  if (frags[0].match(/[^\s,]/)) {
    frags.unshift('');
  }
  // Ensure last item is of non-whitespace stuff:
  if (frags.length % 2) {
    frags.push('');
  }
  // Now frags is in whitespace, text, whitespace, text, ..., text order.
  // Partition items into [space, stuff] pairs:
  const units = [];
  for (let i = 0; i < frags.length; i += 2) {
    units.push([frags[i], frags[i + 1], false]);
  }
  // Pad the end - in case the reformatting adds spaces to the end:
  units.push(['', '', false]);
  return units;
}

/** A single word in string a or b may have been split into
 * multiple words in the other (eg at punctuation).
 * Adjust a and b to the finest granularity of words
 * in either of them.
 * If the strings diverge by text substance, not just whitespace,
 * the final member of each array of SpacedUnits contains
 * the entire irreconcilable remainder of the respective string
 * in the 'space' member, and empty for the text.
 */
function alignSpacedUnits(
  eol: string,
  a: SpacedUnit[],
  b: SpacedUnit[]
): [SpacedUnit[], SpacedUnit[]] {
  const a2: SpacedUnit[] = [],
    b2: SpacedUnit[] = [];
  while (a.length && b.length) {
    // To the degree the next word in a and b is preceded by multi-line whitespace,
    // subdivide it into lines, so that reformatting's changes to each
    // of those lines will be a distinct text edit,
    // in case cursors were located within the changed whitespace -
    // we'd like VS Code to shift the cursors minimally.
    let sawEol = false;
    while (true) {
      const aSpaceFirstLineLength = a[0][0].indexOf(eol);
      const bSpaceFirstLineLength = b[0][0].indexOf(eol);
      if (aSpaceFirstLineLength == -1 || bSpaceFirstLineLength == -1) {
        break;
      } else {
        a2.push([a[0][0].substring(0, aSpaceFirstLineLength), eol, sawEol]);
        b2.push([b[0][0].substring(0, bSpaceFirstLineLength), eol, sawEol]);
        a[0][0] = a[0][0].substring(aSpaceFirstLineLength + eol.length);
        b[0][0] = b[0][0].substring(bSpaceFirstLineLength + eol.length);
        sawEol = true;
      }
    }
    if (a[0][1] == b[0][1]) {
      // same substance in a and b
      a2.push(a[0]);
      b2.push(b[0]);
      a.shift();
      b.shift();
    } else if (a[0][1].length < b[0][1].length) {
      // a's substance is a prefix of b's
      const aWhole = a[0][1];
      const bPart = b[0][1].slice(0, a[0][1].length);
      if (aWhole == bPart) {
        a2.push(a[0]);
        a.shift();
        b2.push([b[0][0], bPart, false]);
        b[0] = ['', b[0][1].slice(aWhole.length), false];
      } else {
        // mismatched text. Stuff entire remainder in the next 'space' item:
        a2.push([a.map((a_item) => a_item[0] + a_item[1]).join(''), '', false]);
        b2.push([b.map((b_item) => b_item[0] + b_item[1]).join(''), '', false]);
        break;
      }
    } else {
      // b's substance is a prefix of a's
      const bWhole = b[0][1];
      const aPart = a[0][1].slice(0, b[0][1].length);
      if (bWhole == aPart) {
        b2.push(b[0]);
        b.shift();
        a2.push([a[0][0], aPart, false]);
        a[0] = ['', a[0][1].slice(bWhole.length), false];
      } else {
        // mismatched text. Stuff entire remainder in the next 'space' item:
        a2.push([a.map((a_item) => a_item[0] + a_item[1]).join(''), '', false]);
        b2.push([b.map((b_item) => b_item[0] + b_item[1]).join(''), '', false]);
        break;
      }
    }
  }
  return [a2, b2];
}

/**
 * Edits to transform previousText to formattedText (which differ
 * only by whitespace).
 * Edits are ordered from end- to start-of-document.
 *
 * @param offset of previousText in the document
 * @param previousText unformatted text
 * @param formattedText formatted version of previousText, which differs only in whitespace
 * @returns Whitespace changes to transform previousText to formattedText
 */
export function whitespaceEdits(
  eol: string,
  offset: number,
  previousText: string,
  formattedText: string
): WhitespaceChange[] {
  const a = spacedUnits(previousText);
  const b = spacedUnits(formattedText);
  // A single word in a or b may have been split into multiple words in the other (eg at punctuation).
  // Adjust a and b to the finest granularity of words in either of them.
  const [a2, b2] = alignSpacedUnits(eol, a, b);
  // The result should be an equal number of words in a and b:
  if (!a2 || !b2 || a2.length != b2.length) {
    return [];
  }
  const ret: WhitespaceChange[] = [];
  let aPos = offset;
  for (let i = 0; i < a2.length; i++) {
    const aSpaces = a2[i][0];
    const bSpaces = b2[i][0];
    // Make an edit if the whitespace changed OR the special flag is set:
    if (aSpaces != bSpaces || b2[i][2]) {
      const start: number = aPos;
      const end: number = aPos + aSpaces.length;
      const text: string = bSpaces;
      ret.unshift({ start, end, text });
    }
    aPos += a2[i][0].length + a2[i][1].length;
  }
  return ret;
}
