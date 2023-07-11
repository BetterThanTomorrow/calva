import * as path from 'path';
import * as tokenCursor from '../cursor-doc/token-cursor';
import * as lexer from '../cursor-doc/clojure-lexer';
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

export function nsFromCursorDoc(cursorDoc: model.EditableDocument): string | null {
  const cursor: tokenCursor.LispTokenCursor = cursorDoc.getTokenCursor(0);
  cursor.forwardWhitespace(true);
  let token: lexer.Token | undefined = undefined,
    foundNsToken: boolean = false,
    foundNsId: boolean = false;
  do {
    cursor.downList();
    if (token && token.offset == cursor.getToken().offset) {
      cursor.next();
    }
    token = cursor.getToken();
    foundNsToken = token.type == 'id' && token.raw == 'ns';
  } while (!foundNsToken && !cursor.atEnd());
  if (foundNsToken) {
    do {
      cursor.next();
      token = cursor.getToken();
      foundNsId = token.type == 'id';
    } while (!foundNsId && !cursor.atEnd());
    if (foundNsId) {
      return token.raw;
    } else {
      console.log('Error getting the ns name from the ns form.');
    }
  } else {
    console.log('No ns form found.');
  }
  return null;
}

export function nsFromText(text: string): string | null {
  const stringDoc: model.StringDocument = new model.StringDocument(text);
  return nsFromCursorDoc(stringDoc);
}
