import * as vscode from 'vscode';
import * as select from '../select';
import * as paredit from '../cursor-doc/paredit';
import * as docMirror from '../doc-mirror/index';
import * as cursorTextGetter from './cursor-get-text';
import { EditableDocument } from '../cursor-doc/model';

export type SelectionAndText = [vscode.Selection | undefined, string];

function _currentFormText(
  doc: vscode.TextDocument,
  topLevel: boolean,
  pos: vscode.Position
): SelectionAndText {
  if (doc) {
    const codeSelection = select.getFormSelection(doc, pos, topLevel);
    return [codeSelection, doc.getText(codeSelection)];
  }
  return [undefined, ''];
}

export function currentTopLevelFormText(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return _currentFormText(doc, true, pos);
}

export function currentFormText(doc: vscode.TextDocument, pos: vscode.Position): SelectionAndText {
  return _currentFormText(doc, false, pos);
}

export function currentEnclosingFormText(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  if (doc) {
    const codeSelection = select.getEnclosingFormSelection(doc, pos);
    return [codeSelection, doc.getText(codeSelection)];
  }
  return [undefined, ''];
}

export function _currentFunction(doc: vscode.TextDocument, topLevel = false): SelectionAndText {
  if (doc) {
    const cursorDoc = docMirror.getDocument(doc);
    const tokenCursor = cursorDoc.getTokenCursor();
    if (topLevel) {
      tokenCursor.set(
        cursorDoc.getTokenCursor(tokenCursor.rangeForDefun(cursorDoc.selection.active)[1] - 1)
      );
    }
    const [start, end] = tokenCursor.getFunctionSexpRange();
    if (start && end) {
      const startPos = doc.positionAt(start);
      const endPos = doc.positionAt(end);
      const selection = new vscode.Selection(startPos, endPos);
      return [selection, doc.getText(selection)];
    }
  }
  return [undefined, ''];
}

export function currentFunction(doc: vscode.TextDocument): SelectionAndText {
  return _currentFunction(doc, false);
}

export function currentTopLevelFunction(doc: vscode.TextDocument): SelectionAndText {
  return _currentFunction(doc, true);
}

function selectionAndText(
  doc: vscode.TextDocument,
  textGetter: (doc: EditableDocument, active: number) => cursorTextGetter.RangeAndText,
  pos: vscode.Position
): SelectionAndText {
  if (doc) {
    const mirrorDoc = docMirror.getDocument(doc);
    const [range, text] = textGetter(mirrorDoc, doc.offsetAt(pos));
    if (range) {
      return [select.selectionFromOffsetRange(doc, range), text];
    }
  }
  return [undefined, ''];
}

export function currentEnclosingFormToCursor(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.currentEnclosingFormToCursor, pos);
}

export function currentTopLevelDefined(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.currentTopLevelDefined, pos);
}

export function currentTopLevelFormToCursor(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.currentTopLevelFormToCursor, pos);
}

export function startOFileToCursor(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.startOfFileToCursor, pos);
}

function fromFn(
  doc: vscode.TextDocument,
  cursorDocFn: (doc: EditableDocument, offset?: number) => [number, number]
): SelectionAndText {
  if (doc) {
    const cursorDoc = docMirror.getDocument(doc);
    const range = cursorDocFn(cursorDoc);
    const selection = select.selectionFromOffsetRange(doc, range);
    const text = doc.getText(selection);
    return [selection, text];
  }
  return [undefined, ''];
}

export function toStartOfList(doc: vscode.TextDocument): SelectionAndText {
  return fromFn(doc, paredit.rangeToBackwardList);
}

export function toEndOfList(doc: vscode.TextDocument): SelectionAndText {
  return fromFn(doc, paredit.rangeToForwardList);
}

export function currentContext(document: vscode.TextDocument, pos: vscode.Position, prefix = '') {
  const result = {};
  result[prefix + 'currentForm'] = currentFormText(document, pos)[1];
  result[prefix + 'enclosingForm'] = currentEnclosingFormText(document, pos)[1];
  result[prefix + 'topLevelForm'] = currentTopLevelFormText(document, pos)[1];
  result[prefix + 'currentFn'] = currentFunction(document)[1];
  result[prefix + 'topLevelDefinedForm'] = currentTopLevelDefined(document, pos)[1];
  result[prefix + 'head'] = toStartOfList(document)[1];
  result[prefix + 'tail'] = toEndOfList(document)[1];

  return result;
}
