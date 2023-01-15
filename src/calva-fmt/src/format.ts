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
import { LispTokenCursor } from '../../cursor-doc/token-cursor';

const FormatDepthDefaults = {
  deftype: 2,
  defprotocol: 2,
};

export async function indentPosition(position: vscode.Position, document: vscode.TextDocument) {
  const editor = util.getActiveTextEditor();
  const pos = new vscode.Position(position.line, 0);
  const indent = getIndent(
    getDocument(document).model.lineInputModel,
    getDocumentOffset(document, position),
    await config.getConfig()
  );
  const newPosition = new vscode.Position(position.line, indent);
  const delta = document.lineAt(position.line).firstNonWhitespaceCharacterIndex - indent;
  if (delta > 0) {
    return editor
      .edit((edits) => edits.delete(new vscode.Range(pos, new vscode.Position(pos.line, delta))), {
        undoStopAfter: false,
        undoStopBefore: false,
      })
      .then((onFulfilled) => {
        editor.selection = new vscode.Selection(newPosition, newPosition);
        return onFulfilled;
      });
  } else if (delta < 0) {
    const str = ' '.repeat(-delta);
    return editor
      .edit((edits) => edits.insert(pos, str), {
        undoStopAfter: false,
        undoStopBefore: false,
      })
      .then((onFulfilled) => {
        editor.selection = new vscode.Selection(newPosition, newPosition);
        return onFulfilled;
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
      _convertEolNumToStringNotation(document.eol)
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
  const index = doc.offsetAt(editor.selection.active);
  const cursor = getDocument(doc).getTokenCursor(index);

  const formatRange = _calculateFormatRange(extraConfig, cursor, index);
  if (!formatRange) {
    return;
  }

  const formatted: {
    'range-text': string;
    range: number[];
    'new-index': number;
  } = await _formatIndex(
    doc.getText(),
    formatRange,
    index,
    _convertEolNumToStringNotation(doc.eol),
    onType,
    {
      ...extraConfig,
      'comment-form?': cursor.getFunctionName() === 'comment',
    }
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

function _calculateFormatRange(
  config: { 'format-depth'?: number },
  cursor: LispTokenCursor,
  index: number
) {
  const formatDepth = config?.['format-depth'] ?? _formatDepth(cursor);

  const rangeForList = cursor.rangeForList(formatDepth);
  if (rangeForList) {
    return rangeForList;
  }

  const rangeForCurrentForm = cursor.rangeForCurrentForm(index);
  if (rangeForCurrentForm?.includes(index)) {
    return rangeForCurrentForm;
  }
}

function _formatDepth(cursor: LispTokenCursor) {
  const cursorClone = cursor.clone();
  cursorClone.backwardFunction(1);
  return FormatDepthDefaults?.[cursorClone.getFunctionName()] ?? 1;
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
    eol: _convertEolNumToStringNotation(eol),
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

function _convertEolNumToStringNotation(eol: vscode.EndOfLine) {
  return eol == 2 ? '\r\n' : '\n';
}
