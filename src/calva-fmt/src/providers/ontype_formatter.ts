import * as vscode from 'vscode';
import * as formatter from '../format';
import * as docMirror from '../../../doc-mirror/index';
import { EditableDocument } from '../../../cursor-doc/model';
import * as paredit from '../../../cursor-doc/paredit';
import { getConfig } from '../../../config';
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
    position: vscode.Position,
    ch: string,
    _options
  ): Promise<vscode.TextEdit[] | undefined> {
    if (isNewLineInComment(ch)) {
      return undefined;
    }
    let keyMap = vscode.workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
    keyMap = String(keyMap).trim().toLowerCase();
    if ([')', ']', '}'].includes(ch)) {
      if (keyMap === 'strict' && getConfig().strictPreventUnmatchedClosingBracket) {
        const mDoc: EditableDocument = docMirror.getDocument(document);
        const tokenCursor = mDoc.getTokenCursor();
        if (tokenCursor.withinComment()) {
          return undefined;
        }
        // TODO: We should make a function in/for the MirrorDoc that can return
        // edits instead of performing them. It is not awesome to perform edits
        // here, since we are expected to return them.
        await paredit.backspace(mDoc);
        await paredit.close(mDoc, ch);
      } else {
        return undefined;
      }
    }
    const editor = util.getActiveTextEditor();
    if (ch === ';') {
      const mDoc: EditableDocument = docMirror.getDocument(document);
      const leftCursor = mDoc.getTokenCursor(document.offsetAt(position) - 2);
      const rightCursor = mDoc.getTokenCursor(document.offsetAt(position));
      if (
        leftCursor.withinComment() ||
        leftCursor.withinString() ||
        rightCursor.isOnlyWhitespaceRightOfCursor()
      ) {
        return undefined;
      }
      if (rightCursor.getToken().raw.match(/^;\s+$|^;.*;/)) {
        return undefined;
      }

      await editor.edit(
        (editBuilder) => {
          editBuilder.insert(position, '\n');
        },
        { undoStopBefore: false, undoStopAfter: false }
      );

      editor.selections = [new vscode.Selection(position, position)];

      if (formatterConfig.formatOnTypeEnabled()) {
        await vscode.commands.executeCommand('calva-fmt.formatCurrentForm');
      }
      return;
    }

    const pos = editor.selections[0].active;
    if (formatterConfig.formatOnTypeEnabled()) {
      if (vscode.workspace.getConfiguration('calva.fmt').get('newIndentEngine')) {
        await formatter.indentPosition(position, document);
      } else {
        try {
          await formatter.formatPosition(editor, true);
        } catch (e) {
          await formatter.indentPosition(position, document);
        }
      }
    }

    return undefined;
  }
}
