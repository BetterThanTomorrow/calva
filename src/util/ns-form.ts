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

export function nsFromCursorDoc(
  cursorDoc: model.EditableDocument,
  p: number = cursorDoc.selections[0].active,
  _maxRecursionDepth: number = 100, // used internally for recursion
  _depth: number = 0 // used internally for recursion
): [string, string] | null {
  if (_depth > _maxRecursionDepth) {
    console.error(`nsFromCursorDoc: recursion depth, ${_maxRecursionDepth} , exceeded`);
    return null;
  }
  const cursor: tokenCursor.LispTokenCursor = cursorDoc.getTokenCursor(p);
  // Special case 1, cursor is inside the ns form
  const topLevelRange = cursor.rangeForDefun(p);
  if (topLevelRange) {
    const topLevelRangeCursor = cursorDoc.getTokenCursor(topLevelRange[0]);
    const ns = nsSymbolOfCurrentForm(topLevelRangeCursor, 'downList');
    if (ns) {
      return [ns, cursorDoc.model.getText(...topLevelRange)];
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
        return [ns, cursorDoc.model.getText(...cursor.rangeForCurrentForm(cursor.offsetEnd))];
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
        return [ns, cursorDoc.model.getText(...cursor.rangeForCurrentForm(cursor.offsetStart))];
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
    return nsFromCursorDoc(cursorDoc, 0, _maxRecursionDepth, _depth + 1);
  }
  // General case, continue look for ns form closest before p
  return nsFromCursorDoc(cursorDoc, cursor.offsetStart, _maxRecursionDepth, _depth + 1);
}

export function nsFromText(text: string, p = text.length): [string, string] | null {
  const stringDoc: model.StringDocument = new model.StringDocument(text);
  return nsFromCursorDoc(stringDoc, p);
}
