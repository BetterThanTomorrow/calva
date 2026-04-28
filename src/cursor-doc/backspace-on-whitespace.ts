import type * as formatterConfig from '../formatter-config';
import * as indent from './indent';
import type * as model from './model';
import type * as tokenCursor from './token-cursor';

export function backspaceOnWhitespace(
  doc: model.EditableDocument,
  cursor: tokenCursor.LispTokenCursor,
  config?: formatterConfig.FormatterConfig
) {
  const origIndent = indent.getIndent(doc.model, cursor.offsetStart, config);
  const onCloseToken = cursor.getToken().type === 'close';
  let start = doc.selections[0].anchor;
  let token = cursor.getToken();
  if (token.type === 'ws') {
    start = cursor.offsetEnd;
  }
  cursor.previous();
  const prevToken = cursor.getToken();
  if (prevToken.type === 'ws' && start === cursor.offsetEnd) {
    token = prevToken;
  }

  let end = start;
  if (token.type === 'ws') {
    end = cursor.offsetStart;
    cursor.previous();
    if (cursor.getToken().type === 'eol') {
      end = cursor.offsetStart;
      cursor.previous();
      if (cursor.getToken().type === 'ws') {
        end = cursor.offsetStart;
        cursor.previous();
      }
    }
  }

  const destTokenType = cursor.getToken().type;
  let targetIndent = destTokenType === 'eol' ? origIndent : 1;
  if (destTokenType === 'open' || onCloseToken) {
    targetIndent = 0;
  }
  return { start, end, indent: targetIndent };
}
