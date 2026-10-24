import * as cljsLib from '../../out/cljs-lib/cljs-lib.js';
import * as model from './model';
import type * as tokenCursor from './token-cursor';

export type MissingTexts = {
  append: string;
  prepend: string;
};

export function getMissingBrackets(text: string): MissingTexts {
  const doc = new model.StringDocument(text);
  const cursor = doc.getTokenCursor(0);
  const stack: string[] = [];
  const missingOpens = [];
  do {
    const token = cursor.getToken();
    if (token.type === 'open') {
      stack.push(token.raw[token.raw.length - 1]);
    } else if (token.type === 'close') {
      if (stack.length === 0) {
        missingOpens.unshift({ ')': '(', ']': '[', '}': '{', '"': '"' }[token.raw]);
      } else {
        stack.pop();
      }
    }
    cursor.next();
  } while (!cursor.atEnd());
  if (stack.length === 0) {
    return { append: '', prepend: missingOpens.join('') };
  } else {
    stack.reverse();
    const missingCloses = stack.map((bracket) => {
      return { '{': '}', '[': ']', '(': ')', '"': '"' }[bracket];
    });
    return { prepend: missingOpens.join(''), append: missingCloses.join('') };
  }
}

export function isRightSexpStructural(cursor: tokenCursor.LispTokenCursor): boolean {
  cursor.forwardWhitespace();
  if (cursor.getToken().type === 'comment') {
    return false;
  }
  cursor.forwardSexp(true, true, false);
  cursor.backwardSexp(false, false, false);

  const token = cursor.getToken();
  if (token.type === 'open') {
    return !!token.raw.match(/[([{]$/);
  }
  return false;
}

export function textForRightSexp(cursor: tokenCursor.LispTokenCursor): string {
  const probe = cursor.clone();
  const start = cursor.offsetStart;
  probe.forwardSexp();
  const end = probe.offsetStart;
  const text = probe.doc.getText(start, end);
  return text;
}

/**
 * Converts a cursor to a TS representation of the right/next sexp.
 * @param cursor A cursor pointing to the start of the sexp.
 * @returns The structure of the right sexp from the cursor, or the text if it is not structural.
 * For structural sexps, the return value is a Map if the Clojure structure is a map, otherwise
 * an array. In both cases the values in the structure are returned as objects of the shape
 * `{ value: any, originalString: string }`.
 * */
export function structureForRightSexp(
  cursor: tokenCursor.LispTokenCursor
): any | any[] | Map<any, any> {
  const probe = cursor.clone();
  if (!isRightSexpStructural(probe)) {
    return textForRightSexp(probe);
  }
  probe.downList();
  const isMap = probe.getPrevToken().raw === '{';
  const structure = isMap ? new Map() : [];
  while (probe.forwardSexp()) {
    probe.backwardSexp();
    if (isMap) {
      const keyString = textForRightSexp(probe);
      const key = structureForRightSexp(probe);
      probe.forwardSexp();
      probe.forwardWhitespace();
      const valueString = textForRightSexp(probe);
      const value = structureForRightSexp(probe);
      (structure as Map<any, any>).set(
        { value: key, originalString: keyString },
        { value: value, originalString: valueString }
      );
    } else {
      const valueString = textForRightSexp(probe);
      const value = structureForRightSexp(probe);
      (structure as any[]).push({ value: value, originalString: valueString });
    }
    probe.forwardWhitespace();
    probe.forwardSexp();
  }
  return structure;
}

const wordCharacter: RegExp = cljsLib.wordCharacter;

/**
 * Returns the range of the word that contains or touches `offset`, the way VS Code's
 * `getWordRangeAtPosition` finds words in Clojure documents, or `undefined` when there is none.
 */
export function wordRangeAtOffset(
  doc: model.EditableDocument,
  offset: number
): model.ModelEditRange | undefined {
  const line = doc.getTokenCursor(offset).line;
  const lineText = doc.model.getLineText(line);
  const lineStart = doc.model.getOffsetForLine(line);
  let start = offset - lineStart;
  let end = start;
  while (start > 0 && wordCharacter.test(lineText[start - 1])) {
    start--;
  }
  while (end < lineText.length && wordCharacter.test(lineText[end])) {
    end++;
  }
  return start < end ? [lineStart + start, lineStart + end] : undefined;
}

/**
 * Returns the word at `offset` without a leading syntax quote, or an empty string.
 */
export function wordAtOffset(doc: model.EditableDocument, offset: number): string {
  const range = wordRangeAtOffset(doc, offset);
  return range ? doc.model.getText(...range).replace(/^`/, '') : '';
}

export function hasMoreThanSingleSexp(doc: model.EditableDocument): boolean {
  const cursor = doc.getTokenCursor(0);
  cursor.forwardWhitespace(true);
  cursor.forwardSexp(false, false, false);
  cursor.forwardWhitespace(false);
  return !cursor.atEnd();
}

export function lineStartOffsets(lines: string[], lineEndingLength: number): number[] {
  const starts = [0];
  for (let i = 1; i < lines.length; i++) {
    starts.push(starts[i - 1] + lines[i - 1].length + lineEndingLength);
  }
  return starts;
}

export function rowColAt(lineStarts: number[], offset: number): [row: number, col: number] {
  let row = lineStarts.length - 1;
  while (row > 0 && lineStarts[row] > offset) {
    row--;
  }
  return [row, offset - lineStarts[row]];
}
