import * as vscode from 'vscode';
import * as config from './config';
import * as outputWindow from '../../results-output/results-doc'
import { getIndent, getDocument, getDocumentOffset, MirroredDocument } from "../../doc-mirror/index";
const { formatTextAtRange, formatTextAtIdx, formatTextAtIdxOnType, formatText, cljify, jsify } = require('../../../out/cljs-lib/cljs-lib');
import * as docModel from '../../cursor-doc/model';

export function indentPosition(position: vscode.Position, document: vscode.TextDocument): Thenable<boolean> {
    let editor = vscode.window.activeTextEditor;
    let pos = new vscode.Position(position.line, 0);
    let indent = getIndent(getDocument(document).model.lineInputModel, getDocumentOffset(document, position), config.getConfig());
    let delta = document.lineAt(position.line).firstNonWhitespaceCharacterIndex - indent;
    if (delta > 0) {
        return editor.edit(edits => edits.delete(new vscode.Range(pos, new vscode.Position(pos.line, delta))), { undoStopAfter: false, undoStopBefore: false });
    }
    else if (delta < 0) {
        let str = "";
        while (delta++ < 0)
            str += " ";
        return editor.edit(edits => edits.insert(pos, str), { undoStopAfter: false, undoStopBefore: false });
    }
}

// TODO: Figure if we have use for this
export async function indentPositionEditableDoc(document: docModel.EditableDocument, position = document.selection.active): Promise<boolean> {
    let t1 = new Date().getTime();
    const cursorP = document.getTokenCursor(position);
    let t2 = new Date().getTime(); console.log(t2 - t1, 'getTokenCursor'); t1 = t2;
    const [line, col] = cursorP.rowCol;
    const posStartOfLine = position - col;
    const model = document.model;
    const lineText = model.getLineText(line);
    t2 = new Date().getTime(); console.log(t2 - t1, 'getLineText'); t1 = t2;
    const posStartOfText = lineText.search(/[^\s]/);
    t2 = new Date().getTime(); console.log(t2 - t1, 'lineText.search'); t1 = t2;
    let indent = getIndent(document.model, posStartOfLine, config.getConfig());
    t2 = new Date().getTime(); console.log(t2 - t1, 'getIndent'); t1 = t2;
    let delta = (posStartOfText === -1 ? lineText.length : posStartOfText) - indent;
    if (delta > 0) {
        const thenable = await document.model.edit([
            new docModel.ModelEdit('deleteRange', [posStartOfLine, delta])
        ], {
            undoStopBefore: false
        });
        t2 = new Date().getTime(); console.log(t2 - t1, 'deleteRange'); t1 = t2;
        return thenable;
    }
    else if (delta < 0) {
        let str = "";
        while (delta++ < 0) {
            str += " ";
        }
        const thenable = await document.model.edit([
            new docModel.ModelEdit('insertString', [posStartOfLine, str])
        ], {
            undoStopBefore: false
        });
        t2 = new Date().getTime(); console.log(t2 - t1, 'insertString'); t1 = t2;
        return thenable;
    }
}

export function indexForFormatForward(document: docModel.EditableDocument, p = document.selection.active): number {
    const cursor = document.getTokenCursor(p);
    const currentLine = cursor.rowCol[0];
    do {
        const token = cursor.getToken();
        if (token.type === 'open') {
            cursor.downList();
            cursor.forwardList();
            if (cursor.rowCol[0] === currentLine) {
                cursor.upList();
            } else {
                return cursor.offsetStart;
            }
        }
        if (token.type === 'eol') {
            break;
        }
    } while (cursor.next());

    return p;
}


export async function formatForward(document: docModel.EditableDocument, p = document.selection.active, onType = true) {
    console.count(`formatForward, p: ${p}`);
    const index = indexForFormatForward(document, p);
    console.count(`formatForward, indexForFormatForward: ${index}`);
    if (index !== p) {
        await formatPositionEditableDoc(document, onType, {
            index: index,
            adjustSelection: false
        });
    }
}

export function formatRangeEdits(document: vscode.TextDocument, range: vscode.Range): vscode.TextEdit[] {
    const text: string = document.getText(range);
    const mirroredDoc: MirroredDocument = getDocument(document);
    const startIndex = document.offsetAt(range.start);
    const endIndex = document.offsetAt(range.end);
    const cursor = mirroredDoc.getTokenCursor(startIndex);
    if (!cursor.withinString()) {
        const rangeTuple: number[] = [startIndex, endIndex];
        const newText: string = _formatRange(text, document.getText(), rangeTuple, document.eol == 2 ? "\r\n" : "\n")['range-text'];
        if (newText) {
            return [vscode.TextEdit.replace(range, newText)];
        }
    }
}

export function formatRange(document: vscode.TextDocument, range: vscode.Range) {
    let wsEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    wsEdit.set(document.uri, formatRangeEdits(document, range));
    return vscode.workspace.applyEdit(wsEdit);
}

export function formatRangeInfoEditableDoc(document: docModel.EditableDocument, formatRange: [number, number], onType: boolean = false, extraConfig = {}) {
    const index = extraConfig['index'] || document.selection.active;
    const cursor = document.getTokenCursor(index);
    const isComment = cursor.getFunctionName() === 'comment';
    const config = { ...extraConfig, "comment-form?": isComment };
    let text = document.model.getText(0, Infinity);
    // TODO: Find a more efficient way to do this
    if (document.model.lineEndingLength === 2) {
        text = text.replace(/\n/g, '\r\n');
    }
    const formatted: {
        "range-text": string,
        "range": [number, number],
        "new-index": number
    } = _formatIndex(text, formatRange, index, document.model.lineEndingLength == 2 ? "\r\n" : "\n", onType, config);
    const newIndex: number = formatted.range[0] + formatted["new-index"];
    let previousText: string = document.model.getText(...formatted.range);
    if (document.model.lineEndingLength === 2) {
        previousText = previousText.replace(/\n/g, '\r\n');
    }
    return {
        formattedText: formatted["range-text"],
        range: formatted.range,
        previousText: previousText,
        previousIndex: index,
        newIndex: newIndex
    }
}

export function formatPositionInfoEditableDoc(document: docModel.EditableDocument, onType: boolean = false, extraConfig = {}) {
    const index = extraConfig['index'] || document.selection.active;
    const cursor = document.getTokenCursor(index);
    const formatDepth = extraConfig["format-depth"] ? extraConfig["format-depth"] : 1;
    let formatRange = cursor.rangeForList(formatDepth);
    if (!formatRange) {
        formatRange = cursor.rangeForCurrentForm(index);
        if (!formatRange || !formatRange.includes(index)) {
            return;
        }
    }
    return formatRangeInfoEditableDoc(document, formatRange, onType, extraConfig);
}

export function formatRangeEditableDoc(document: docModel.EditableDocument, range: [number, number], onType: boolean = false, extraConfig = {}): Thenable<boolean> {
    console.count(`formatRangeEditableDoc: ${range}`);
    const config = {
        ...extraConfig,
        performFormatAsYouType: false
    }
    const formattedInfo = formatRangeInfoEditableDoc(document, range, onType, config);
    return performFormatEditableDoc(document, formattedInfo, onType, config);
}

export function formatPositionEditableDoc(document: docModel.EditableDocument, onType: boolean = false, extraConfig = {}): Thenable<boolean> {
    console.count(`formatPositionEditableDoc`);
    const formattedInfo = formatPositionInfoEditableDoc(document, onType, { performFormatAsYouType: true, ...extraConfig });
    console.count(`formatPositionEditableDoc, formattedInfo: ${formattedInfo}`);
    return performFormatEditableDoc(document, formattedInfo, onType, extraConfig);
}

function performFormatEditableDoc(document: docModel.EditableDocument, formattedInfo, onType: boolean, extraConfig = {}): Thenable<boolean> {
    const adjustSelection = extraConfig['adjustSelection'] === undefined || extraConfig['adjustSelection'];
    console.log(`performFormatEditableDoc, adjustSelection: ${adjustSelection}`);
    if (formattedInfo) {
        const newSelectionConfig = adjustSelection ? { selection: new docModel.ModelEditSelection(formattedInfo.newIndex) } : {};
        console.log(`performFormatEditableDoc, formattedInfo.previousText != formattedInfo.formattedText: ${formattedInfo.previousText != formattedInfo.formattedText}`);
        if (formattedInfo.previousText != formattedInfo.formattedText) {
            return document.model.edit([
                new docModel.ModelEdit('changeRange', [formattedInfo.range[0], formattedInfo.range[1], formattedInfo.formattedText.replace(/\r\n/g, '\n')])
            ], {
                undoStopBefore: !onType,
                skipFormat: true,
                rangeFormatted: true,
                ...extraConfig,
                ...newSelectionConfig
            });
        } else if (adjustSelection && formattedInfo.newIndex != formattedInfo.previousIndex) {
            document.selection = new docModel.ModelEditSelection(formattedInfo.newIndex);
        }
    }
    return new Promise((resolve, _reject) => {
        resolve(formattedInfo !== undefined);
    });
}

export async function formatPosition(editor: vscode.TextEditor, onType: boolean = false, extraConfig = {}): Promise<boolean> {
    const doc: vscode.TextDocument = editor.document;
    return formatPositionEditableDoc(getDocument(doc), onType, extraConfig).then(isFullfilled => {
        if (!isFullfilled && !onType && !outputWindow.isResultsDoc(doc)) {
            // TODO: Make cursor-doc version of formatRange
            return formatRange(doc, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)));
        }
        return new Promise((resolve, _reject) => {
            resolve(true);
        });
    });
}

export function formatPositionCommand(editor: vscode.TextEditor) {
    formatPosition(editor);
}

export function alignPositionCommand(editor: vscode.TextEditor) {
    formatPosition(editor, true, { "align-associative?": true });
}

export function formatCode(code: string, eol: number) {
    const d = cljify({
        "range-text": code,
        "eol": eol == 2 ? "\r\n" : "\n",
        "config": config.getConfig()
    });
    const result = jsify(formatText(d));
    if (!result["error"]) {
        return result["range-text"];
    }
    else {
        console.error("Error in `formatCode`:", result["error"]);
        return code;
    }
}

function _formatIndex(allText: string, range: [number, number], index: number, eol: string, onType: boolean = false, extraConfig = {}): { "range-text": string, "range": [number, number], "new-index": number } {
    const d = cljify({
        "all-text": allText,
        "idx": index,
        "eol": eol,
        "range": range,
        "config": { ...config.getConfig(), ...extraConfig }
    }),
        result = jsify(onType ? formatTextAtIdxOnType(d) : formatTextAtIdx(d));
    if (!result["error"]) {
        return result;
    }
    else {
        console.error("Error in `_formatIndex`:", result["error"]);
        throw result["error"];
    }
}


function _formatRange(rangeText: string, allText: string, range: number[], eol: string): { "range-text": string, "range": [number, number], "new-index": number } {
    const d = {
        "range-text": rangeText,
        "all-text": allText,
        "range": range,
        "eol": eol,
        "config": config.getConfig()
    };
    const cljData = cljify(d);
    const result = jsify(formatTextAtRange(cljData));
    if (!result["error"]) {
        return result;
    }
}
