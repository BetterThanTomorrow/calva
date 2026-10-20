import { expect } from 'expect';
import * as path from 'node:path';
import { isClojureDocument, isClojureWorkspaceFolder } from '../../../lsp/auto-start';

const p = (...segments: string[]) => path.resolve(path.sep, ...segments);

const document = (languageId: string, scheme: string, fsPath: string) => ({
  languageId,
  uri: { scheme, fsPath },
});

describe('lsp auto-start', () => {
  describe('isClojureDocument', () => {
    it('accepts a Clojure file on disk', () => {
      expect(isClojureDocument(document('clojure', 'file', p('ws', 'src', 'app.clj')))).toBe(true);
    });

    it('rejects a document of another language', () => {
      expect(isClojureDocument(document('rust', 'file', p('ws', 'src', 'main.rs')))).toBe(false);
    });

    it('rejects an untitled Clojure document, which clojure-lsp does not support', () => {
      expect(isClojureDocument(document('clojure', 'untitled', 'Untitled-1'))).toBe(false);
    });
  });

  describe('isClojureWorkspaceFolder', () => {
    it('is false when the folder holds neither a project root nor an open Clojure file', () => {
      expect(
        isClojureWorkspaceFolder({
          folder_path: p('ws'),
          project_root_paths: [],
          open_clojure_document_paths: [],
        })
      ).toBe(false);
    });

    it('is true when the folder itself is a project root', () => {
      expect(
        isClojureWorkspaceFolder({
          folder_path: p('ws'),
          project_root_paths: [p('ws')],
          open_clojure_document_paths: [],
        })
      ).toBe(true);
    });

    it('is true when a project root is nested in the folder', () => {
      expect(
        isClojureWorkspaceFolder({
          folder_path: p('ws'),
          project_root_paths: [p('ws', 'services', 'api')],
          open_clojure_document_paths: [],
        })
      ).toBe(true);
    });

    it('is true when a Clojure file is open in the folder, even without a project root', () => {
      expect(
        isClojureWorkspaceFolder({
          folder_path: p('ws'),
          project_root_paths: [],
          open_clojure_document_paths: [p('ws', 'scripts', 'build.clj')],
        })
      ).toBe(true);
    });

    it('is false when the only project root belongs to another workspace folder', () => {
      expect(
        isClojureWorkspaceFolder({
          folder_path: p('rust-ws'),
          project_root_paths: [p('clojure-ws')],
          open_clojure_document_paths: [],
        })
      ).toBe(false);
    });

    it('is false when the only open Clojure file lives outside the folder', () => {
      expect(
        isClojureWorkspaceFolder({
          folder_path: p('rust-ws'),
          project_root_paths: [],
          open_clojure_document_paths: [p('clojure-ws', 'src', 'app.clj')],
        })
      ).toBe(false);
    });

    it('is false for a sibling folder sharing a name prefix', () => {
      expect(
        isClojureWorkspaceFolder({
          folder_path: p('ws'),
          project_root_paths: [p('ws-clojure')],
          open_clojure_document_paths: [],
        })
      ).toBe(false);
    });
  });
});
