import * as path from 'path';
import * as tokenCursor from '../cursor-doc/token-cursor';
import * as getText from '../util/cursor-get-text';
import * as model from '../cursor-doc/model';

export function isPrefix(parentPath: string, filePath: string): boolean {
  const relative = path.relative(parentPath, filePath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function pathToNs(filePath: string): string {
  const extName: string = path.extname(filePath);
  return filePath
    .substring(0, filePath.length - extName.length)
    .replace(/[/\\]/g, '.')
    .replace(/_/g, '-');
}

export function resolveNsName(sourcePaths: string[], filePath: string): string {
  if (sourcePaths) {
    for (const sourcePath of sourcePaths) {
      if (isPrefix(sourcePath, filePath)) {
        const relative = path.relative(sourcePath, filePath);
        return pathToNs(relative);
      }
    }
  }
  return pathToNs(path.basename(filePath));
}

/** Returns [ns, range] if the range does not start with a #_ ignore token, else null. */
function nsRangeIfNotIgnored(
  cursorDoc: model.EditableDocument,
  ns: string,
  range: [number, number]
): [string, [number, number]] | null {
  if (cursorDoc.getTokenCursor(range[0]).getToken().type === 'ignore') {
    return null;
  }
  return [ns, range];
}

function nsSymbolOfCurrentForm(
  cursor: tokenCursor.LispTokenCursor,
  downList: 'downList' | 'backwardDownList'
): string | null {
  const nsCheckCursor = cursor.clone();
  nsCheckCursor[downList]();
  nsCheckCursor.backwardList();
  nsCheckCursor.forwardWhitespace(true);
  const formToken = nsCheckCursor.getToken();
  if (formToken.type === 'id' && ['ns', 'in-ns'].includes(formToken.raw)) {
    while (nsCheckCursor.forwardSexp(true, false, true)) {
      nsCheckCursor.forwardWhitespace(true);
      const nsToken = nsCheckCursor.getToken();
      if (nsToken.type === 'id') {
        return formToken.raw === 'ns' ? nsToken.raw : nsToken.raw.substring(1);
      }
    }
  }
}

/** [Namespace name, [start, end offset of range of the ns form]] or null */
export function nsRangeFromCursorDoc(
  cursorDoc: model.EditableDocument,
  p: number = cursorDoc.selections[0].active,
  _maxRecursionDepth: number = 100, // used internally for recursion
  _depth: number = 0 // used internally for recursion
): [string, [number, number]] | null {
  if (_depth > _maxRecursionDepth) {
    console.error(`nsRangeFromCursorDoc: recursion depth, ${_maxRecursionDepth} , exceeded`);
    return null;
  }
  const cursor: tokenCursor.LispTokenCursor = cursorDoc.getTokenCursor(p);
  // Special case 1, cursor is inside the ns form
  const topLevelRange = cursor.rangeForDefun(p);
  if (topLevelRange) {
    const topLevelRangeCursor = cursorDoc.getTokenCursor(topLevelRange[0]);
    // A top-level #_ discards the following form, so it's not a valid ns declaration
    if (topLevelRangeCursor.getToken().type !== 'ignore') {
      const ns = nsSymbolOfCurrentForm(topLevelRangeCursor, 'downList');
      if (ns) {
        return [ns, topLevelRange];
      }
    }
  }
  // Special case 2, find ns form from start of document
  const startOfDocumentCursor = cursor.clone();
  startOfDocumentCursor.backwardWhitespace(true);
  if (startOfDocumentCursor.atStart()) {
    cursor.forwardWhitespace(true);
    while (cursor.forwardSexp(true, true, true)) {
      const ns = nsSymbolOfCurrentForm(cursor, 'backwardDownList');
      if (ns) {
        const result = nsRangeIfNotIgnored(
          cursorDoc,
          ns,
          cursor.rangeForCurrentForm(cursor.offsetEnd)
        );
        if (result) {
          return result;
        }
      }
    }
    return null;
  }
  // General case, find ns form closest before p
  cursor.backwardWhitespace(true);
  if (cursor.atTopLevel(true)) {
    while (cursor.backwardSexp()) {
      const ns = nsSymbolOfCurrentForm(cursor, 'downList');
      if (ns) {
        const result = nsRangeIfNotIgnored(
          cursorDoc,
          ns,
          cursor.rangeForCurrentForm(cursor.offsetStart)
        );
        if (result) {
          return result;
        }
      }
    }
  }
  cursor.backwardList();
  cursor.backwardUpList();
  cursor.backwardWhitespace(true);
  if (cursor.atStart()) {
    return null;
  }
  // Special case 3, the structure of the document is unbalanced
  // We try to find the ns from the start of the document
  if (!cursor.docIsBalanced()) {
    return nsRangeFromCursorDoc(cursorDoc, 0, _maxRecursionDepth, _depth + 1);
  }
  // General case, continue look for ns form closest before p
  return nsRangeFromCursorDoc(cursorDoc, cursor.offsetStart, _maxRecursionDepth, _depth + 1);
}

/** [Namespace name, text of the ns form] or null */
export function nsFromCursorDoc(
  cursorDoc: model.EditableDocument,
  p: number = cursorDoc.selections[0].active
): [string, string] | null {
  const a = nsRangeFromCursorDoc(cursorDoc, p);
  if (a === null) {
    return null;
  } else {
    const [nsName, nsRange] = a;
    return [nsName, cursorDoc.model.getText(...nsRange)];
  }
}

/** [Namespace name, [start, end offset of range of the ns form]] or null */
export function nsRangeFromText(text: string, p = text.length): [string, [number, number]] | null {
  const stringDoc: model.StringDocument = new model.StringDocument(text);
  return nsRangeFromCursorDoc(stringDoc, p);
}

/** [Namespace name, text of the ns form] or null */
export function nsFromText(text: string, p = text.length): [string, string] | null {
  const stringDoc: model.StringDocument = new model.StringDocument(text);
  return nsFromCursorDoc(stringDoc, p);
}
