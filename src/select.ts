import * as vscode from 'vscode';
import * as util from './utilities';
import * as docMirror from './doc-mirror/index';

export function selectionFromOffsetRange(
  doc: vscode.TextDocument,
  range: [number, number]
): vscode.Selection {
  return new vscode.Selection(doc.positionAt(range[0]), doc.positionAt(range[1]));
}

export function getFormSelection(
  doc: vscode.TextDocument,
  pos: vscode.Position,
  topLevel: boolean
): vscode.Selection | undefined {
  const idx = doc.offsetAt(pos);
  const cursor = docMirror.getDocument(doc).getTokenCursor(idx);
  const range = topLevel ? cursor.rangeForDefun(idx) : cursor.rangeForCurrentForm(idx);
  if (range) {
    return selectionFromOffsetRange(doc, range);
  }
}

export function getEnclosingFormSelection(
  doc: vscode.TextDocument,
  pos: vscode.Position
): vscode.Selection | undefined {
  const idx = doc.offsetAt(pos);
  const cursor = docMirror.getDocument(doc).getTokenCursor(idx);
  if (cursor.backwardList()) {
    cursor.backwardUpList();
    const start = cursor.offsetStart;
    if (cursor.forwardSexp()) {
      const end = cursor.offsetStart;
      return selectionFromOffsetRange(doc, [start, end]);
    }
  }
}

function selectForm(
  document = {},
  selectionFn: (
    doc: vscode.TextDocument,
    pos: vscode.Position,
    topLevel: boolean
  ) => vscode.Selection | undefined,
  toplevel: boolean
) {
  const editor = util.getActiveTextEditor(),
    doc = util.getDocument(document),
    selection = editor.selection;

  if (selection.isEmpty) {
    const codeSelection = selectionFn(doc, selection.active, toplevel);
    if (codeSelection) {
      editor.selection = codeSelection;
    }
  }
}

export function selectCurrentForm(document = {}) {
  selectForm(document, getFormSelection, false);
}
