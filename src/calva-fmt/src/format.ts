import * as vscode from 'vscode';
import * as config from './config';
import * as outputWindow from '../../results-output/results-doc';
import {
  getIndent,
  getDocumentOffset,
  MirroredDocument,
  getDocument,
} from '../../doc-mirror/index';
import {
  formatTextAtRange,
  formatTextAtIdx,
  formatTextAtIdxOnType,
  formatText,
  cljify,
  jsify,
} from '../../../out/cljs-lib/cljs-lib';
import * as util from '../../utilities';
import { isUndefined, cloneDeep } from 'lodash';

export async function indentPosition(position: vscode.Position, document: vscode.TextDocument) {
  const editor = util.getActiveTextEditor();
  const pos = new vscode.Position(position.line, 0);
  const indent = getIndent(
    getDocument(document).model.lineInputModel,
    getDocumentOffset(document, position),
    await config.getConfig()
  );
  let delta = document.lineAt(position.line).firstNonWhitespaceCharacterIndex - indent;
  if (delta > 0) {
    return editor.edit(
      (edits) => edits.delete(new vscode.Range(pos, new vscode.Position(pos.line, delta))),
      {
        undoStopAfter: false,
        undoStopBefore: false,
      }
    );
  } else if (delta < 0) {
    let str = '';
    while (delta++ < 0) {
      str += ' ';
    }
    return editor.edit((edits) => edits.insert(pos, str), {
      undoStopAfter: false,
      undoStopBefore: false,
    });
  }
}

export async function formatRangeEdits(
  document: vscode.TextDocument,
  range: vscode.Range
): Promise<vscode.TextEdit[] | undefined> {
  const text: string = document.getText(range);
  const mirroredDoc: MirroredDocument = getDocument(document);
  const startIndex = document.offsetAt(range.start);
  const endIndex = document.offsetAt(range.end);
  const cursor = mirroredDoc.getTokenCursor(startIndex);
  if (!cursor.withinString()) {
    const rangeTuple: number[] = [startIndex, endIndex];
    const newText: string | undefined = await _formatRange(
      text,
      document.getText(),
      rangeTuple,
      document.eol == 2 ? '\r\n' : '\n'
    );
    if (newText) {
      return [vscode.TextEdit.replace(range, newText)];
    }
  }
}

export async function formatRange(document: vscode.TextDocument, range: vscode.Range) {
  const wsEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
  const edits = await formatRangeEdits(document, range);

  if (isUndefined(edits)) {
    console.error('formatRangeEdits returned undefined!', cloneDeep({ document, range }));
    return false;
  }

  wsEdit.set(document.uri, edits);
  return vscode.workspace.applyEdit(wsEdit);
}

export async function formatPositionInfo(
  editor: vscode.TextEditor,
  onType: boolean = false,
  extraConfig = {}
) {
  const doc: vscode.TextDocument = editor.document;
  const pos: vscode.Position = editor.selection.active;
  const index = doc.offsetAt(pos);
  const mirroredDoc: MirroredDocument = getDocument(doc);
  const cursor = mirroredDoc.getTokenCursor(index);
  const formatDepth = extraConfig['format-depth'] ? extraConfig['format-depth'] : 1;
  const isComment = cursor.getFunctionName() === 'comment';
  const config = { ...extraConfig, 'comment-form?': isComment };
  let formatRange = cursor.rangeForList(formatDepth);
  if (!formatRange) {
    formatRange = cursor.rangeForCurrentForm(index);
    if (!formatRange || !formatRange.includes(index)) {
      return;
    }
  }
  const formatted: {
    'range-text': string;
    range: number[];
    'new-index': number;
  } = await _formatIndex(
    doc.getText(),
    formatRange,
    index,
    doc.eol == 2 ? '\r\n' : '\n',
    onType,
    config
  );
  const range: vscode.Range = new vscode.Range(
    doc.positionAt(formatted.range[0]),
    doc.positionAt(formatted.range[1])
  );
  const newIndex: number = doc.offsetAt(range.start) + formatted['new-index'];
  const previousText: string = doc.getText(range);
  return {
    formattedText: formatted['range-text'],
    range: range,
    previousText: previousText,
    previousIndex: index,
    newIndex: newIndex,
  };
}

export async function formatPosition(
  editor: vscode.TextEditor,
  onType: boolean = false,
  extraConfig = {}
): Promise<boolean> {
  const doc: vscode.TextDocument = editor.document,
    formattedInfo = await formatPositionInfo(editor, onType, extraConfig);
  if (formattedInfo && formattedInfo.previousText != formattedInfo.formattedText) {
    return editor
      .edit(
        (textEditorEdit) => {
          textEditorEdit.replace(formattedInfo.range, formattedInfo.formattedText);
        },
        { undoStopAfter: false, undoStopBefore: false }
      )
      .then((onFulfilled: boolean) => {
        editor.selection = new vscode.Selection(
          doc.positionAt(formattedInfo.newIndex),
          doc.positionAt(formattedInfo.newIndex)
        );
        return onFulfilled;
      });
  }
  if (formattedInfo) {
    return new Promise((resolve, _reject) => {
      if (formattedInfo.newIndex != formattedInfo.previousIndex) {
        editor.selection = new vscode.Selection(
          doc.positionAt(formattedInfo.newIndex),
          doc.positionAt(formattedInfo.newIndex)
        );
      }
      resolve(true);
    });
  }
  if (!onType && !outputWindow.isResultsDoc(doc)) {
    return formatRange(
      doc,
      new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
    );
  }
  return new Promise((resolve, _reject) => {
    resolve(true);
  });
}

export function formatPositionCommand(editor: vscode.TextEditor) {
  void formatPosition(editor);
}

export function alignPositionCommand(editor: vscode.TextEditor) {
  void formatPosition(editor, true, { 'align-associative?': true });
}

export function trimWhiteSpacePositionCommand(editor: vscode.TextEditor) {
  void formatPosition(editor, false, { 'remove-multiple-non-indenting-spaces?': true });
}

export async function formatCode(code: string, eol: number) {
  const d = {
    'range-text': code,
    eol: eol == 2 ? '\r\n' : '\n',
    config: await config.getConfig(),
  };
  const result = jsify(formatText(d));
  if (!result['error']) {
    return result['range-text'];
  } else {
    console.error('Error in `formatCode`:', result['error']);
    return code;
  }
}

async function _formatIndex(
  allText: string,
  range: [number, number],
  index: number,
  eol: string,
  onType: boolean = false,
  extraConfig = {}
): Promise<{ 'range-text': string; range: number[]; 'new-index': number }> {
  const d = {
    'all-text': allText,
    idx: index,
    eol: eol,
    range: range,
    config: { ...(await config.getConfig()), ...extraConfig },
  };
  const result = jsify(onType ? formatTextAtIdxOnType(d) : formatTextAtIdx(d));
  if (!result['error']) {
    return result;
  } else {
    console.error('Error in `_formatIndex`:', result['error']);
    throw result['error'];
  }
}

async function _formatRange(
  rangeText: string,
  allText: string,
  range: number[],
  eol: string
): Promise<string | undefined> {
  const d = {
    'range-text': rangeText,
    'all-text': allText,
    range: range,
    eol: eol,
    config: await config.getConfig(),
  };
  const result = jsify(formatTextAtRange(d));
  if (!result['error']) {
    return result['range-text'];
  }
}
