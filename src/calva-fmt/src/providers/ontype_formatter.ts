import * as vscode from 'vscode';
import * as formatter from '../format';
import * as util from '../../../utilities';
import * as formatterConfig from '../../../formatter-config';
import * as whenContexts from '../../../when-contexts';

// TODO: Make this provider return a proper edit instead of performing it.
// Errors like that of https://github.com/BetterThanTomorrow/calva/issues/2071
// probably happens because of this.

function isNewLineInComment(ch: string): boolean {
  return (
    ch === '\n' &&
    whenContexts.lastContexts.includes('calva:cursorInComment') &&
    !(
      whenContexts.lastContexts.includes('calva:cursorBeforeComment') ||
      whenContexts.lastContexts.includes('calva:cursorAfterComment')
    )
  );
}

export class FormatOnTypeEditProvider implements vscode.OnTypeFormattingEditProvider {
  async provideOnTypeFormattingEdits(
    document: vscode.TextDocument,
    _position: vscode.Position,
    ch: string,
    _options
  ): Promise<vscode.TextEdit[] | undefined> {
    if (isNewLineInComment(ch) || [')', ']', '}'].includes(ch)) {
      return undefined;
    }
    const editor = util.getActiveTextEditor();
    const pos = editor.selections[0].active;
    if (formatterConfig.formatOnTypeEnabled()) {
      if (vscode.workspace.getConfiguration('calva.fmt').get('newIndentEngine')) {
        await formatter.indentPosition(pos, document);
      } else {
        try {
          await formatter.formatPosition(editor, true);
        } catch (e) {
          await formatter.indentPosition(pos, document);
        }
      }
    }
    return undefined;
  }
}
