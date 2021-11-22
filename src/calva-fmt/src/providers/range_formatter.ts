import * as vscode from 'vscode';
import * as formatter from '../format';


export class RangeEditProvider implements vscode.DocumentRangeFormattingEditProvider {
    provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, _options, _token) {
        console.count(`provideDocumentRangeFormattingEdits: ${_options}`);
        return formatter.formatRangeEdits(document, range);
    }
}
