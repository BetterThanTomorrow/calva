import vscode from 'vscode';
import formatter from '../format';

export class RangeEditProvider implements vscode.DocumentRangeFormattingEditProvider {
  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    _options,
    _token
  ) {
    return formatter.formatRangeEdits(document, range);
  }
}
