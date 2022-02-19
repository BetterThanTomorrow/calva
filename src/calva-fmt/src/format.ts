import * as vscode from 'vscode';
import * as config from './config';
import * as outputWindow from '../../results-output/results-doc';
import {
    getIndent,
    getDocument,
    getDocumentOffset,
    MirroredDocument,
} from '../../doc-mirror/index';
const {
    formatTextAtRange,
    formatTextAtIdx,
    formatTextAtIdxOnType,
    formatText,
    cljify,
    jsify,
} = require('../../../out/cljs-lib/cljs-lib');

export function indentPosition(
    position: vscode.Position,
    document: vscode.TextDocument
) {
    const editor = vscode.window.activeTextEditor;
    const pos = new vscode.Position(position.line, 0);
    const indent = getIndent(
        getDocument(document).model.lineInputModel,
        getDocumentOffset(document, position),
        config.getConfig()
    );
    let delta =
        document.lineAt(position.line).firstNonWhitespaceCharacterIndex -
        indent;
    if (delta > 0) {
        return editor.edit(
            (edits) =>
                edits.delete(
                    new vscode.Range(pos, new vscode.Position(pos.line, delta))
                ),
            { undoStopAfter: false, undoStopBefore: false }
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

export function formatRangeEdits(
    document: vscode.TextDocument,
    range: vscode.Range
): vscode.TextEdit[] {
    const text: string = document.getText(range);
    const mirroredDoc: MirroredDocument = getDocument(document);
    const startIndex = document.offsetAt(range.start);
    const endIndex = document.offsetAt(range.end);
    const cursor = mirroredDoc.getTokenCursor(startIndex);
    if (!cursor.withinString()) {
        const rangeTuple: number[] = [startIndex, endIndex];
        const newText: string = _formatRange(
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

export function formatRange(
    document: vscode.TextDocument,
    range: vscode.Range
) {
    const wsEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    wsEdit.set(document.uri, formatRangeEdits(document, range));
    return vscode.workspace.applyEdit(wsEdit);
}

export function formatPositionInfo(
    editor: vscode.TextEditor,
    onType: boolean = false,
    extraConfig = {}
) {
    const doc: vscode.TextDocument = editor.document;
    const pos: vscode.Position = editor.selection.active;
    const index = doc.offsetAt(pos);
    const mirroredDoc: MirroredDocument = getDocument(doc);
    const cursor = mirroredDoc.getTokenCursor(index);
    const formatDepth = extraConfig['format-depth']
        ? extraConfig['format-depth']
        : 1;
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
    } = _formatIndex(
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

export function formatPosition(
    editor: vscode.TextEditor,
    onType: boolean = false,
    extraConfig = {}
): Thenable<boolean> {
    const doc: vscode.TextDocument = editor.document,
        formattedInfo = formatPositionInfo(editor, onType, extraConfig);
    if (
        formattedInfo &&
        formattedInfo.previousText != formattedInfo.formattedText
    ) {
        return editor
            .edit(
                (textEditorEdit) => {
                    textEditorEdit.replace(
                        formattedInfo.range,
                        formattedInfo.formattedText
                    );
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
            new vscode.Range(
                doc.positionAt(0),
                doc.positionAt(doc.getText().length)
            )
        );
    }
    return new Promise((resolve, _reject) => {
        resolve(true);
    });
}

export function formatPositionCommand(editor: vscode.TextEditor) {
    formatPosition(editor);
}

export function alignPositionCommand(editor: vscode.TextEditor) {
    formatPosition(editor, true, { 'align-associative?': true });
}

export function formatCode(code: string, eol: number) {
    const d = cljify({
        'range-text': code,
        eol: eol == 2 ? '\r\n' : '\n',
        config: config.getConfig(),
    });
    const result = jsify(formatText(d));
    if (!result['error']) {
        return result['range-text'];
    } else {
        console.error('Error in `formatCode`:', result['error']);
        return code;
    }
}

function _formatIndex(
    allText: string,
    range: [number, number],
    index: number,
    eol: string,
    onType: boolean = false,
    extraConfig = {}
): { 'range-text': string; range: number[]; 'new-index': number } {
    const d = {
        'all-text': allText,
        idx: index,
        eol: eol,
        range: range,
        config: { ...config.getConfig(), ...extraConfig },
    };
    const result = jsify(
        onType ? formatTextAtIdxOnType(d) : formatTextAtIdx(d)
    );
    if (!result['error']) {
        return result;
    } else {
        console.error('Error in `_formatIndex`:', result['error']);
        throw result['error'];
    }
}

function _formatRange(
    rangeText: string,
    allText: string,
    range: number[],
    eol: string
): string {
    const d = {
        'range-text': rangeText,
        'all-text': allText,
        range: range,
        eol: eol,
        config: config.getConfig(),
    };
    const cljData = cljify(d);
    const result = jsify(formatTextAtRange(cljData));
    if (!result['error']) {
        return result['range-text'];
    }
}
