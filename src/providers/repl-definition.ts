import type * as model from '../cursor-doc/model';
import type { NReplSession } from '../nrepl';
import * as cursorDocUtil from '../cursor-doc/utilities';

export type ReplDefinition = { file: string; line: number; column?: number };

/** Returns the zero-based line and character of `definition`, whose line and column the REPL reports one-based. */
export function definitionPosition({ line, column }: ReplDefinition) {
  return { line: Math.max(0, line - 1), character: Math.max(0, (column ?? 1) - 1) };
}

/**
 * Asks `session` for info on the word at `offset` in `doc`, in namespace `ns`. Returns the
 * file, line and column the REPL reports for it, or `undefined` when it reports no file.
 */
export async function replDefinition(
  session: Pick<NReplSession, 'supports' | 'info'> | undefined,
  ns: string,
  doc: model.EditableDocument,
  offset: number
): Promise<ReplDefinition | undefined> {
  if (session?.supports('info')) {
    const info = await session.info(ns, cursorDocUtil.wordAtOffset(doc, offset), {
      downloadSourcesJar: true,
    });
    if (info.file && info.file.length > 0) {
      return { file: info.file, line: info.line, column: info.column };
    }
  }
}
