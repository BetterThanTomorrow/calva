import vscode from 'vscode';
import { getEnclosingFormSelection, getFormSelection, selectionFromOffsetRange } from '../select';
import {
  bindingForms,
  currentSexpsRange,
  isInPairsList,
  rangeToBackwardList,
  rangeToForwardList,
} from '../cursor-doc/paredit';
import { getDocument } from '../doc-mirror/index';
import {
  RangeAndText,
  currentEnclosingFormToCursor as _currentEnclosingFormToCursor,
  currentTopLevelDefined as _currentTopLevelDefined,
  currentTopLevelFormToCursor as _currentTopLevelFormToCursor,
  selectionAddingBrackets as _selectionAddingBrackets,
  startOfFileToCursor as _startOfFileToCursor,
} from './cursor-get-text';
import { EditableDocument } from '../cursor-doc/model';

export type SelectionAndText = [vscode.Selection | undefined, string];

function _currentFormText(
  doc: vscode.TextDocument,
  topLevel: boolean,
  pos: vscode.Position
): SelectionAndText {
  if (doc) {
    const codeSelection = getFormSelection(doc, pos, topLevel);
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

export function currentPairText(doc: vscode.TextDocument, pos: vscode.Position): SelectionAndText {
  const cursorDoc = getDocument(doc);
  const cursorPos = doc.offsetAt(pos);
  const cursor = cursorDoc.getTokenCursor(cursorPos);
  if (isInPairsList(cursor, bindingForms)) {
    const range = currentSexpsRange(cursorDoc, cursor, cursorPos, true);
    const selection = selectionFromOffsetRange(doc, range);
    return [selection, doc.getText(selection)];
  } else {
    return [undefined, ''];
  }
}

export function currentFileText(doc: vscode.TextDocument): SelectionAndText {
  const text = doc.getText();
  if (text) {
    return [selectionFromOffsetRange(doc, [0, text.length - 1]), text];
  } else {
    return [undefined, ''];
  }
}

export function currentEnclosingFormText(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  if (doc) {
    const codeSelection = getEnclosingFormSelection(doc, pos);
    return [codeSelection, doc.getText(codeSelection)];
  }
  return [undefined, ''];
}

export function _currentFunction(doc: vscode.TextDocument, topLevel = false): SelectionAndText {
  if (doc) {
    const cursorDoc = getDocument(doc);
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
  textGetter: (doc: EditableDocument, active: number) => RangeAndText,
  pos: vscode.Position
): SelectionAndText {
  if (doc) {
    const mirrorDoc = getDocument(doc);
    const [range, text] = textGetter(mirrorDoc, doc.offsetAt(pos));
    if (range) {
      return [selectionFromOffsetRange(doc, range), text];
    }
  }
  return [undefined, ''];
}

export function currentEnclosingFormToCursor(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, _currentEnclosingFormToCursor, pos);
}

export function currentTopLevelDefined(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, _currentTopLevelDefined, pos);
}

export function currentTopLevelFormToCursor(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, _currentTopLevelFormToCursor, pos);
}

export function selectionAddingBrackets(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, _selectionAddingBrackets, pos);
}

export function startOFileToCursor(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, _startOfFileToCursor, pos);
}

function fromFn(
  doc: vscode.TextDocument,
  cursorDocFn: (doc: EditableDocument, offset?: number) => [number, number]
): SelectionAndText {
  if (doc) {
    const cursorDoc = getDocument(doc);
    const range = cursorDocFn(cursorDoc);
    const selection = selectionFromOffsetRange(doc, range);
    const text = doc.getText(selection);
    return [selection, text];
  }
  return [undefined, ''];
}

export function toStartOfList(doc: vscode.TextDocument): SelectionAndText {
  return fromFn(doc, rangeToBackwardList);
}

export function toEndOfList(doc: vscode.TextDocument): SelectionAndText {
  return fromFn(doc, rangeToForwardList);
}

export function currentContext(document: vscode.TextDocument, pos: vscode.Position, prefix = '') {
  const result = {};
  result[prefix + 'currentForm'] = currentFormText(document, pos);
  result[prefix + 'currentFileText'] = currentFileText(document);
  result[prefix + 'currentPair'] = currentPairText(document, pos);
  result[prefix + 'enclosingForm'] = currentEnclosingFormText(document, pos);
  result[prefix + 'topLevelForm'] = currentTopLevelFormText(document, pos);
  result[prefix + 'currentFn'] = currentFunction(document);
  result[prefix + 'topLevelDefinedForm'] = currentTopLevelDefined(document, pos);
  result[prefix + 'topLevelFn'] = currentTopLevelFunction(document);
  result[prefix + 'head'] = toStartOfList(document);
  result[prefix + 'tail'] = toEndOfList(document);

  return result;
}
