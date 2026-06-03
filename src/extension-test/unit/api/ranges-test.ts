import * as expectLib from 'expect';
import { resolveDocAndPos } from '../../../util/resolve-doc-and-pos';
import type { DocLike, EditorLike } from '../../../util/resolve-doc-and-pos';

function makeEditor(languageId: string, activePos: unknown): EditorLike & { edit: () => void } {
  return {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    edit: () => {},
    document: { languageId },
    selections: [{ active: activePos }],
  };
}

function makeDoc(languageId: string): DocLike {
  return { languageId };
}

describe('ranges', () => {
  describe('resolveDocAndPos', () => {
    it('TextEditor input passes through doc and selection position', () => {
      const pos = { line: 1, character: 5 };
      const editor = makeEditor('clojure', pos);
      const result = resolveDocAndPos(editor, undefined, undefined);
      expectLib.expect(result).toBeDefined();
      expectLib.expect(result.doc).toBe(editor.document);
      expectLib.expect(result.pos).toBe(pos);
    });

    it('TextEditor with explicit position uses the explicit position', () => {
      const editorPos = { line: 0, character: 0 };
      const explicitPos = { line: 3, character: 7 };
      const editor = makeEditor('clojure', editorPos);
      const result = resolveDocAndPos(editor, explicitPos, undefined);
      expectLib.expect(result).toBeDefined();
      expectLib.expect(result.pos).toBe(explicitPos);
    });

    it('TextDocument + Position input passes through directly', () => {
      const doc = makeDoc('clojure');
      const pos = { line: 2, character: 3 };
      const result = resolveDocAndPos(doc, pos, undefined);
      expectLib.expect(result).toBeDefined();
      expectLib.expect(result.doc).toBe(doc);
      expectLib.expect(result.pos).toBe(pos);
    });

    it('TextDocument without position returns undefined', () => {
      const doc = makeDoc('clojure');
      const result = resolveDocAndPos(doc, undefined, undefined);
      expectLib.expect(result).toBeUndefined();
    });

    it('No arguments, no active editor returns undefined', () => {
      const result = resolveDocAndPos(undefined, undefined, undefined);
      expectLib.expect(result).toBeUndefined();
    });

    it('No arguments with active editor uses editor doc and position', () => {
      const pos = { line: 4, character: 2 };
      const editor = makeEditor('clojure', pos);
      const result = resolveDocAndPos(undefined, undefined, editor);
      expectLib.expect(result).toBeDefined();
      expectLib.expect(result.doc).toBe(editor.document);
      expectLib.expect(result.pos).toBe(pos);
    });

    it('Non-clojure languageId returns undefined for TextEditor', () => {
      const editor = makeEditor('javascript', { line: 0, character: 0 });
      const result = resolveDocAndPos(editor, undefined, undefined);
      expectLib.expect(result).toBeUndefined();
    });

    it('Non-clojure languageId returns undefined for TextDocument + Position', () => {
      const doc = makeDoc('python');
      const result = resolveDocAndPos(doc, { line: 0, character: 0 }, undefined);
      expectLib.expect(result).toBeUndefined();
    });

    it('Non-clojure languageId returns undefined for active editor fallback', () => {
      const editor = makeEditor('typescript', { line: 0, character: 0 });
      const result = resolveDocAndPos(undefined, undefined, editor);
      expectLib.expect(result).toBeUndefined();
    });
  });
});
