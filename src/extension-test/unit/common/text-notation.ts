import { clone, entries, first, last, orderBy, partialRight, toInteger } from 'lodash';
import * as model from '../../../cursor-doc/model';

/**
 * Text Notation for expressing states of a document, including
 * current text and selection.
 * See this video for an intro: https://www.youtube.com/watch?v=Sy3arG-Degw
 * * Since JavasScript makes it clumsy with multiline strings,
 *   newlines are denoted with a middle dot character: `•`
 * * Selections are denoted like so
 *   * Cursors, (which are actually selections with identical start and end) are denoted with a single `|`, with <= 10 multiple cursors defined by `|1`, `|2`, ... `|9`, etc, or in regex: /\|\d/. 0-indexed, so `|` is 0, `|1` is 1, etc.
 *   * This is however actually an alternative for the following `>\d?` notation, it has the same left->right semantics, but looks more like a cursor/caret lol, and more importantly, drops the 0 for the first cursor.
 *   * Selections with direction left->right are denoted with `>0`, `>1`, `>2`, ... `>9` etc at the range boundaries
 *   * Selections with direction right->left are denoted with `<0`, `<1`, `<2`, ... `<9` etc at the range boundaries
 */
function textNotationToTextAndSelection(content: string): [string, model.ModelEditSelection[]] {
  const cursorSymbolRegExPattern =
    /(?<cursorType>(?:(?<selectionDirection><|>(?=\d{1})))|(?:\|))(?<cursorNumber>\d{1})?/g;
  const text = clone(content).replace(/•/g, '\n').replace(cursorSymbolRegExPattern, '');

  /**
   * 3 capt groups:
   * 0 = total cursor, with number,
   * 1 = just the cursor type, no number,
   * 2 = only for directional selection cursors:
   *     the > or <,
   * 3 = only if there's a number, the number itself (eg multi cursor)
   */
  const matches = Array.from(content.matchAll(cursorSymbolRegExPattern));

  // a map of cursor symbols (eg '>3' - including the cursor number if >1 ) to an an array of matches (for their positions mostly) in content string where that cursor is
  // for now, we hope that there are at most two positions per symbol
  const cursorMatchInstances = matches.reduce((acc, curr, index) => {
    const nextAcc = { ...acc };

    const sumOfPreviousCursorOffsets = Array.from(matches)
      .slice(0, index)
      .reduce((sum, m) => sum + m[0].length, 0);

    curr.index = curr.index - sumOfPreviousCursorOffsets;

    // const cursorMatchStr = curr.groups['cursorType'] ?? curr[0];
    const cursorMatchStr = curr[0];
    const matchesForCursor = nextAcc[cursorMatchStr] ?? [];
    nextAcc[cursorMatchStr] = [...matchesForCursor, curr];
    return nextAcc;
  }, {} as { [key: string]: RegExpMatchArray[] });

  const selections = [].fill(0, matches.length, undefined);

  entries(cursorMatchInstances).forEach(([_, matches]) => {
    const firstMatch = first(matches);
    const secondMatch = last(matches) ?? firstMatch;

    const isReversed =
      (firstMatch.groups['selectionDirection'] ?? firstMatch[2] ?? '') === '<' ? true : false;

    const start = firstMatch.index;
    const end = secondMatch.index === firstMatch.index ? secondMatch.index : secondMatch.index;

    const anchor = isReversed ? end : start;
    const active = isReversed ? start : end;

    const cursorNumber = toInteger(firstMatch.groups['cursorNumber'] ?? firstMatch[3] ?? '0');

    selections[cursorNumber] = new model.ModelEditSelection(anchor, active, start, end, isReversed);
  });

  return [text, selections];
}

/**
 * Utility function to create a doc from text-notated strings
 */
export function docFromTextNotation(s: string): model.StringDocument {
  const [text, selections] = textNotationToTextAndSelection(s);
  const doc = new model.StringDocument(text);
  doc.selections = selections;
  return doc;
}

export function textNotationFromDoc(doc: model.EditableDocument, prettyPrint = false): string {
  const selections = doc.selections ?? [];
  const ranges = selections.map((s) => s.asDirectedRange);

  const text = getText(doc, true);

  return textNotationFromTextAndSelections(text, ranges, prettyPrint);
}

export function textNotationFromTextAndSelections(
  text: string,
  ranges: Array<[number, number]>,
  prettyPrint = false
): string {
  let cursorSymbols: [number, string][] = [];
  ranges.forEach((r, cursorNumber) => {
    const [anchor, active] = r;
    const isReversed = anchor > active;
    const isSelection = anchor - active !== 0;
    const start = Math.min(anchor, active);
    const end = Math.max(anchor, active);

    const cursorType = isReversed ? '<' : '|';
    cursorSymbols.push([start, `${cursorType}${cursorNumber || ''}`]);
    if (isSelection) {
      cursorSymbols.push([end, `${cursorType}${cursorNumber || ''}`]);
    }
  });

  cursorSymbols = orderBy(cursorSymbols, (c) => c[0]);

  // basically split up the text into chunks separated by where they'd have had cursor symbols, and append cursor symbols after each chunk, before joining back together
  // this way we can insert the cursor symbols in the right place without having to worry about the cumulative offsets created by appending the cursor symbols
  const textSegments = cursorSymbols
    .reduce(
      (acc, [offset, symbol], index) => {
        const lastSection = last(acc)[1];
        const sections = acc.slice(0, -1);

        const lastSectionOffset =
          offset - sections.filter((s) => s[0]).reduce((sum, sec) => sum + sec[1].length, 0);
        const newSectionOfText = [true, lastSection.slice(0, lastSectionOffset)];
        const newSectionWithCursor = [false, symbol];
        const restOfText = lastSection.slice(lastSectionOffset);

        return [...sections, newSectionOfText, newSectionWithCursor, [true, restOfText]];
      },
      [
        [true, text] as [
          boolean /* is an actual text segment instead of cursor symbol? */,
          string /* text segment or cursor symbol */
        ],
      ]
    )
    .map((s) => s[1]);

  const textNotation = textSegments.join('');
  return prettyPrint ? textNotation.replace(/•/g, '\n') : textNotation;
}

textNotationFromDoc.pretty = partialRight(textNotationFromDoc, true);
textNotationFromTextAndSelections.pretty = partialRight(textNotationFromTextAndSelections, true);

/**
 * Utility function to get the text from a document.
 * @param doc
 * @returns string
 */
export function getText(doc: model.EditableDocument, replaceNewLine = false): string {
  const text = doc.model.getText(0, Infinity);

  return replaceNewLine ? text.split(doc.model.lineEnding).join('•') : text;
}

/**
 * Utility function to create a comparable structure with the text and
 * selection from a document. Supports multiple cursors
 */
export function textAndSelections(doc: model.EditableDocument): [string, [number, number][]] {
  // return [text(doc), [doc.selection.anchor, doc.selection.active]];
  return [getText(doc), doc.selections.map((s) => s.asDirectedRange)];
}

/**
 * Convenience single (primary) cursor version of `textAndSelections`
 */
export function textAndSelection(doc: model.EditableDocument): [string, [number, number]] {
  const [text, [selection]] = textAndSelections(doc);
  return [text, selection];
}
