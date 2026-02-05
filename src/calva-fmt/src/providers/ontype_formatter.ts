import * as vscode from 'vscode';
import * as formatter from '../format';
import * as util from '../../../utilities';
import * as formatterConfig from '../../../formatter-config';
import * as whenContexts from '../../../when-contexts';

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
    position: vscode.Position,
    ch: string,
    _options
  ): Promise<vscode.TextEdit[] | undefined> {
    if (isNewLineInComment(ch) || [')', ']', '}'].includes(ch)) {
      return undefined;
    }

    if (formatterConfig.formatOnTypeEnabled()) {
      if (vscode.workspace.getConfiguration('calva.fmt').get('newIndentEngine')) {
        // Use calculateIndentEdit function that returns TextEdit[]
        // WIth this VS Code handles cursor positioning
        return formatter.calculateIndentEdit(position, document);
      } else {
        // Fall back to legacy behavior for old indent engine
        // This still has the cursor jumping issue but maintains compatibility
        const editor = util.getActiveTextEditor();
        const pos = editor.selections[0].active;
        try {
          await formatter.formatPosition(editor, true);
        } catch (e) {
          await formatter.indentPosition(pos, document);
        }
        return undefined;
      }
    }

    return undefined;
  }
}
