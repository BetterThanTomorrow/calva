import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-protocol';
import type * as model from '../cursor-doc/model';
import type { NReplSession } from '../nrepl';
import * as cursorDocUtil from '../cursor-doc/utilities';

const kinds = {
  nil: CompletionItemKind.Value,
  macro: CompletionItemKind.Value,
  class: CompletionItemKind.Class,
  keyword: CompletionItemKind.Keyword,
  namespace: CompletionItemKind.Module,
  function: CompletionItemKind.Function,
  'special-form': CompletionItemKind.Keyword,
  var: CompletionItemKind.Variable,
  local: CompletionItemKind.Variable,
  method: CompletionItemKind.Method,
};

/**
 * Returns the top level form around `offset` with the word at `offset` replaced by
 * `__prefix__`, the context nREPL's `complete` takes, or `undefined` when the form is not
 * a list.
 */
function completionContext(doc: model.EditableDocument, offset: number): string | undefined {
  const toplevelRange = doc.getTokenCursor(offset).rangeForDefun(offset);
  if (!toplevelRange) {
    throw new Error('Expected a topLevelSelection!');
  }
  const wordRange = cursorDocUtil.wordRangeAtOffset(doc, offset);
  if (!wordRange) {
    throw new Error('Expected a wordRange!');
  }
  const [toplevelStart, toplevelEnd] = toplevelRange;
  const [wordStart, wordEnd] = wordRange;
  const toplevel = doc.model.getText(toplevelStart, toplevelEnd),
    contextStart = toplevel.substring(0, wordStart - toplevelStart),
    contextEnd = toplevel.substring(wordEnd - toplevelStart),
    replContext = `${contextStart}__prefix__${contextEnd}`,
    toplevelIsValidForm =
      doc.getTokenCursor(toplevelStart + 1).withinValidList() && replContext != '__prefix__';
  return toplevelIsValidForm ? replContext : undefined;
}

/**
 * Asks `session` to complete the word at `offset` in `doc`, in namespace `ns`, with the
 * top level form around it as context. Returns the candidates as completion items marked
 * as coming from the REPL.
 */
export async function replCompletions(
  session: Pick<NReplSession, 'complete'>,
  ns: string,
  doc: model.EditableDocument,
  offset: number
): Promise<CompletionItem[]> {
  const context = completionContext(doc, offset);
  const res = await session.complete(ns, cursorDocUtil.wordAtOffset(doc, offset), context);
  return (res.completions || []).map((item) => ({
    label: item.candidate,
    kind: kinds[item.type] || CompletionItemKind.Text,
    data: { ...item, ns: item.ns || ns, provider: 'repl' },
  }));
}
