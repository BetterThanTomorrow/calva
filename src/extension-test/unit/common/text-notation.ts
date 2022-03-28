import * as model from '../../../cursor-doc/model';
import { clone, entries, cond, toInteger, last, first, cloneDeep } from 'lodash';

/**
 * Text Notation for expressing states of a document, including
 * current text and selection.
 * * Since JavasScript makes it clumsy with multiline strings,
 *   newlines are denoted with a middle dot character: `•`
 * * Selections are denoted like so
 * TODO: make it clearer that single | is just a shorthand for |>|
 *   * Single position selections are denoted with a single `|`, with <= 10 multiple cursors defined by `|1`, `|2`, ... `|9`, etc, or in regex: /\|\d/. 0-indexed, so `|` is 0, `|1` is 1, etc.
 *   * Selections w/o direction are denoted with `|` (plus multi-cursor numbered variations) at the range's boundaries.
 *   * Selections with direction left->right are denoted with `|>|`, `|>|1`, `|>|2`, ... `|>|9` etc at the range boundaries
 *   * Selections with direction right->left are denoted with `|<|`, `|<|1`, `|<|2`, ... `|<|9` etc at the range boundaries
 */
function _textNotationToTextAndSelection(s: string): [string, { anchor: number; active: number }] {
  const text = s.replace(/•/g, '\n').replace(/\|?[<>]?\|/g, '');
  let anchor = undefined;
  let active = undefined;
  anchor = s.indexOf('|>|');
  if (anchor >= 0) {
    active = s.lastIndexOf('|>|') - 3;
  } else {
    anchor = s.lastIndexOf('|<|');
    if (anchor >= 0) {
      anchor -= 3;
      active = s.indexOf('|<|');
    } else {
      anchor = s.indexOf('|');
      if (anchor >= 0) {
        active = s.lastIndexOf('|');
        if (active !== anchor) {
          active -= 1;
        } else {
          active = anchor;
        }
      }
    }
  }
  return [text, { anchor, active }];
}

function textNotationToTextAndSelection(content: string): [string, model.ModelEditSelection[]] {
  const text = clone(content)
    .replace(/•/g, '\n')
    .replace(/\|?[<>]?\|\d?/g, '');

  // 3 capt groups: 0 = total cursor, with number, 1 = just the cursor type, no number, 2 = only for directional selection cursors, the > or <, 3 = only if there's a number, the number itself (eg multi cursor)
  const matches = Array.from(content.matchAll(
    /(?<cursorType>(?:\|(?<selectionDirection><|>)\|)|(?:\|))(?<cursorNumber>\d)?/g
  ));

  // a map of cursor symbols (eg '|>|3' - including the cursor number if >1 ) to an an array of matches (for their positions mostly) in content string where that cursor is
  // for now, we hope that there are at most two positions per symbol
  const cursorMatchInstances = Array.from(matches).reduce((acc, curr, index) => {
    const nextAcc = { ...acc };
    // const currRepositioned = cloneDeep(curr);

    const sumOfPreviousCursorOffsets = Array.from(matches)
      .slice(0, index)
      .reduce((sum, m) => sum + m[0].length, 0);

    curr.index = curr.index - sumOfPreviousCursorOffsets;

    const cursorMatchStr = curr.groups['cursorType'] ?? curr[0];
    const matchesForCursor = nextAcc[cursorMatchStr] ?? [];
    nextAcc[cursorMatchStr] = [...matchesForCursor, curr];
    return nextAcc;
  }, {} as { [key: string]: RegExpMatchArray[] });

  return [
    text,
    entries(cursorMatchInstances).map(([cursorMatchStr, matches]) => {
      const firstMatch = first(matches);
      const secondMatch = last(matches) ?? firstMatch;

      const isReversed =
        (firstMatch.groups['selectionDirection'] ?? firstMatch[2] ?? '') === '<' ? true : false;

      const start = firstMatch.index;
      const end = secondMatch.index === firstMatch.index ? secondMatch.index : secondMatch.index;

      const anchor = isReversed ? end : start;
      const active = isReversed ? start : end;

      // const cursorNumber = toInteger(firstMatch.groups['cursorNumber'] ?? firstMatch[3] ?? '0');

      return new model.ModelEditSelection(anchor, active, start, end, isReversed);
    }),
  ];
}

/**
 * Utility function to create a doc from text-notated strings
 */
export function docFromTextNotation(s: string): model.StringDocument {
  const [text, selections] = textNotationToTextAndSelection(s);
  // const [text, selections] = _textNotationToTextAndSelection(s);
  const doc = new model.StringDocument(text);
  doc.selections = selections;
  // doc.selections = [selections];
  // doc.selections = [new model.ModelEditSelection(selections.anchor, selections.active)];
  return doc;
}

/**
 * Utility function to get the text from a document.
 * @param doc
 * @returns string
 */
export function text(doc: model.StringDocument): string {
  return doc.model.getText(0, Infinity);
}

/**
 * Utility function to create a comparable structure with the text and
 * selection from a document
 */
export function textAndSelection(doc: model.StringDocument): [string, [number, number][]] {
  // return [text(doc), [doc.selection.anchor, doc.selection.active]];
  return [text(doc), doc.selections.map((s) => [s.anchor, s.active])];
}
