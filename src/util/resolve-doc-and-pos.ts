/**
 * Pure resolution logic for editor-or-document + position.
 * No vscode dependency — testable in unit tests.
 */

export interface DocLike {
  readonly languageId: string;
}

export interface EditorLike {
  readonly document: DocLike;
  readonly selections: ReadonlyArray<{ readonly active: unknown }>;
}

/**
 * Resolves an editor-or-document input into a {doc, pos} pair.
 * Returns undefined when:
 * - No input and no active editor
 * - TextDocument without position
 * - languageId is not 'clojure'
 */
export function resolveDocAndPos(
  editorOrDoc: EditorLike | DocLike | undefined,
  position: unknown,
  activeEditor: EditorLike | undefined
): { doc: DocLike; pos: unknown } | undefined {
  let doc: DocLike;
  let pos: unknown;

  if (!editorOrDoc) {
    if (!activeEditor) {
      return undefined;
    }
    doc = activeEditor.document;
    pos = activeEditor.selections[0].active;
  } else if ('edit' in editorOrDoc) {
    const editor = editorOrDoc as EditorLike;
    doc = editor.document;
    pos = position !== undefined ? position : editor.selections[0].active;
  } else {
    if (position === undefined) {
      return undefined;
    }
    doc = editorOrDoc as DocLike;
    pos = position;
  }

  if (doc.languageId !== 'clojure') {
    return undefined;
  }

  return { doc, pos };
}
