import * as vscode from 'vscode';
import * as config from '../../formatter-config';
import * as outputWindow from '../../results-output/results-doc';
import { getIndent, getDocumentOffset, getDocument } from '../../doc-mirror/index';
import { formatTextAtRange, formatText, jsify } from '../../../out/cljs-lib/cljs-lib';
import * as util from '../../utilities';
import * as cursorDocUtils from '../../cursor-doc/utilities';
import { isUndefined, cloneDeep } from 'lodash';
import { LispTokenCursor } from '../../cursor-doc/token-cursor';
import { formatIndex } from './format-index';
import * as state from '../../state';

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
    await config.getConfig(document)
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
  originalRange: vscode.Range
): Promise<vscode.TextEdit[] | undefined> {
  const mirrorDoc = getDocument(document);
  const startIndex = document.offsetAt(originalRange.start);
  const cursor = mirrorDoc.getTokenCursor(startIndex);
  if (!cursor.withinString() && !cursor.withinComment()) {
    const eol = _convertEolNumToStringNotation(document.eol);
    const originalText = document.getText(originalRange);
    const leadingWs = originalText.match(/^\s*/)[0];
    const trailingWs = originalText.match(/\s*$/)[0];
    const missingTexts = cursorDocUtils.getMissingBrackets(originalText);
    const healedText = `${missingTexts.prepend}${originalText.trim()}${missingTexts.append}`;
    const formattedHealedText = await formatCode(healedText, document.eol);
    const leadingEolPos = leadingWs.lastIndexOf(eol);
    const startIndent =
      leadingEolPos === -1
        ? originalRange.start.character
        : leadingWs.length - leadingEolPos - eol.length;
    const formattedText = formattedHealedText
      .substring(
        missingTexts.prepend.length,
        missingTexts.prepend.length + formattedHealedText.length - missingTexts.append.length
      )
      .split(eol)
      .map((line: string, i: number) => (i === 0 ? line : `${' '.repeat(startIndent)}${line}`))
      .join(eol);
    const newText = `${formattedText.startsWith(leadingWs) ? '' : leadingWs}${formattedText}${
      formattedText.endsWith(trailingWs) ? '' : trailingWs
    }`;
    return [vscode.TextEdit.replace(originalRange, newText)];
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
  } = formatIndex(
    doc.getText(),
    formatRange,
    index,
    _convertEolNumToStringNotation(doc.eol),
    onType,
    {
      ...(await config.getConfig()),
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
  const rangeForTopLevelForm = cursor.rangeForDefun(index, false);
  const topLevelStartCursor = cursor.doc.getTokenCursor(rangeForTopLevelForm[0]);
  const rangeForList = cursor.rangeForList(formatDepth);
  if (rangeForList) {
    if (rangeForList[0] === rangeForTopLevelForm[0]) {
      if (topLevelStartCursor.rowCol[1] !== 0) {
        const STOP_INFORMING = 'calvaFormat:stopInformingAboutTopLevelAlignment';
        if (!state.extensionContext.globalState.get(STOP_INFORMING)) {
          void vscode.window
            .showInformationMessage(
              'You are formatting a top level form that is not aligned with the left margin. Calva will not align it for you, because it promises to only format the content of the form. Please align the opening bracket of the form with the left margin and format again. You can also format the whole document by placing the cursor outside of the form and format.',
              'OK',
              "Don't show again"
            )
            .then((selection) => {
              if (selection === "Don't show again") {
                void state.extensionContext.globalState.update(STOP_INFORMING, true);
              }
            });
        }
      }
    }
    return rangeForList;
  }

  const rangeForCurrentForm = cursor.rangeForCurrentForm(index);
  if (!isUndefined(rangeForCurrentForm)) {
    if (rangeForCurrentForm[0] === rangeForTopLevelForm[0]) {
      if (topLevelStartCursor.rowCol[1] !== 0) {
        return;
      }
    }
    if (rangeForCurrentForm.includes(index)) {
      return rangeForCurrentForm;
    }
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
