import * as vscode from 'vscode';
import * as select from '../select';
import * as docMirror from '../doc-mirror/index';
import * as cursorTextGetter from './cursor-get-text';
import type * as model from '../cursor-doc/model';
import * as pareditExtension from '../paredit/extension';

export type SelectionAndText = [vscode.Selection | undefined, string];

/**
 * What `textGetter` picks from `doc`'s mirror: at `pos` for the getters that take a position, else at
 * the mirror's selection.
 */
function selectionAndText(
  doc: vscode.TextDocument,
  textGetter: (doc: model.EditableDocument, active?: number) => cursorTextGetter.RangeAndText,
  pos?: vscode.Position
): SelectionAndText {
  if (doc) {
    const mirrorDoc = docMirror.getDocument(doc);
    const [range, text] = textGetter(mirrorDoc, pos ? doc.offsetAt(pos) : undefined);
    return [range && select.selectionFromOffsetRange(doc, range), text];
  }
  return [undefined, ''];
}

export function currentTopLevelFormText(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.currentTopLevelForm, pos);
}

export function currentFormText(doc: vscode.TextDocument, pos: vscode.Position): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.currentForm, pos);
}

export function currentPairText(doc: vscode.TextDocument, pos: vscode.Position): SelectionAndText {
  return selectionAndText(
    doc,
    (mirrorDoc, active) =>
      cursorTextGetter.currentPair(mirrorDoc, pareditExtension.getPareditConfig(), active),
    pos
  );
}

export function currentFileText(doc: vscode.TextDocument): SelectionAndText {
  const text = doc.getText();
  if (text) {
    return [select.selectionFromOffsetRange(doc, [0, text.length - 1]), text];
  } else {
    return [undefined, ''];
  }
}

export function currentEnclosingFormText(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.currentEnclosingForm, pos);
}

export function currentFunction(doc: vscode.TextDocument, pos?: vscode.Position): SelectionAndText {
  return selectionAndText(
    doc,
    (mirrorDoc, active) => cursorTextGetter.currentFunction(mirrorDoc, false, active),
    pos
  );
}

export function currentTopLevelFunction(
  doc: vscode.TextDocument,
  pos?: vscode.Position
): SelectionAndText {
  return selectionAndText(
    doc,
    (mirrorDoc, active) => cursorTextGetter.currentFunction(mirrorDoc, true, active),
    pos
  );
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

export function selectionAddingBrackets(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.selectionAddingBrackets, pos);
}

export function startOFileToCursor(
  doc: vscode.TextDocument,
  pos: vscode.Position
): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.startOfFileToCursor, pos);
}

export function toStartOfList(doc: vscode.TextDocument): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.head);
}

export function toEndOfList(doc: vscode.TextDocument): SelectionAndText {
  return selectionAndText(doc, cursorTextGetter.tail);
}

export function currentClojureContext(
  document: vscode.TextDocument,
  pos: vscode.Position,
  prefix = ''
) {
  const result = {};
  result[prefix + 'currentForm'] = currentFormText(document, pos);
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
