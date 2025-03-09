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
 */
type SpacedUnit = [spaces: string, stuff: string];

/** Array of [spaces, nonspaces] which if concatenated would equal s.
 * In the Clojure custom, recognizes comma and JS regex \s as spaces.
 */
function spacedUnits(s: string): SpacedUnit[] {
  const frags = s.match(/[\s,]+|[^\s,]+/g);
  // Ensure 1st item is of whitespace:
  if (frags[0].match(/[^\s,]/)) {
    frags.unshift('');
  }
  // Ensure last item is of non-whitespace stuff:
  if (frags.length % 2) {
    frags.push('');
  }
  // Partition items into [space, stuff] pairs:
  const units = [];
  for (let i = 0; i < frags.length; i += 2) {
    units.push([frags[i], frags[i + 1]]);
  }
  // Pad the end - in case the reformatting adds spaces to the end:
  units.push(['', '']);
  return units;
}

/** A single word in string a or b may have been split into
 * multiple words in the other (eg at punctuation).
 * Adjust a and b to the finest granularity of words
 * in either of them.
 */
function alignSpacedUnits(
  eol: string,
  a: SpacedUnit[],
  b: SpacedUnit[]
): [SpacedUnit[], SpacedUnit[]] {
  const a2 = [],
    b2 = [];
  while (a.length && b.length) {
    // will consume a and b, eroding them with shift
    // To the degree the next word in a and b is preceded by multi-line whitespace,
    // subdivide it into lines, so that reformatting's changes to each
    // of those lines will be a distinct text edit,
    // in case cursors were located within the changed whitespace -
    // we'd like VS Code to shift the cursors minimally.
    while (true) {
      const aSpaceFirstLineLength = a[0][0].indexOf(eol);
      const bSpaceFirstLineLength = b[0][0].indexOf(eol);
      if (aSpaceFirstLineLength == -1 || bSpaceFirstLineLength == -1) {
        break;
      } else {
        a2.push([a[0][0].substring(0, aSpaceFirstLineLength), eol]);
        b2.push([b[0][0].substring(0, bSpaceFirstLineLength), eol]);
        a[0][0] = a[0][0].substring(aSpaceFirstLineLength + eol.length);
        b[0][0] = b[0][0].substring(bSpaceFirstLineLength + eol.length);
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
        b2.push([b[0][0], bPart]);
        b[0] = ['', b[0][1].slice(aWhole.length)];
      } else {
        console.error('alignSpacedUnits: a/b mismatch wherein a is shorter');
        return [undefined, undefined];
      }
    } else {
      // b's substance is a prefix of a's
      const bWhole = b[0][1];
      const aPart = a[0][1].slice(0, b[0][1].length);
      if (bWhole == aPart) {
        b2.push(b[0]);
        b.shift();
        a2.push([a[0][0], aPart]);
        a[0] = ['', a[0][1].slice(bWhole.length)];
      } else {
        console.error('alignSpacedUnits: a/b mismatch wherein b is shorter');
        return [undefined, undefined];
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
  if (a2.length != b2.length) {
    console.error('Uneven words in a and b', 'a2', a2, 'b2', b2);
    return [];
  }
  const ret: WhitespaceChange[] = [];
  let aPos = offset;
  for (let i = 0; i < a2.length; i++) {
    const aSpaces = a2[i][0];
    const bSpaces = b2[i][0];
    if (aSpaces != bSpaces) {
      const start: number = aPos;
      const end: number = aPos + aSpaces.length;
      const text: string = bSpaces;
      ret.unshift({ start, end, text });
    }
    aPos += a2[i][0].length + a2[i][1].length;
  }
  return ret;
}
