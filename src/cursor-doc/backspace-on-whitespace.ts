import { FormatterConfig } from '../formatter-config';
import { getIndent } from './indent';
import { EditableDocument } from './model';
import { LispTokenCursor } from './token-cursor';

export function backspaceOnWhitespace(
  doc: EditableDocument,
  cursor: LispTokenCursor,
  config?: FormatterConfig
) {
  const origIndent = getIndent(doc.model, cursor.offsetStart, config);
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
  let indent = destTokenType === 'eol' ? origIndent : 1;
  if (destTokenType === 'open' || onCloseToken) {
    indent = 0;
  }
  return { start, end, indent };
}
