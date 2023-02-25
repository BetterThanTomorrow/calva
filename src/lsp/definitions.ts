// This file contains type definitions related to the language server protocol
import * as vscode_lsp from 'vscode-languageclient/node';
import * as vscode from 'vscode';

export interface Position {
  line: number;
  character: number;
}
interface Range {
  start: Position;
  end: Position;
}

export enum TestTreeKind {
  DEFTEST = 0,
  TESTING = 1,
}

export interface TestTreeNode {
  name: string;
  'name-range': Range;
  range: Range;
  kind: TestTreeKind;
  children: TestTreeNode[];
}

// See https://clojure-lsp.io/capabilities/#test-tree
export interface TestTreeParams {
  uri: string;
  tree: TestTreeNode;
}

// The Clojure LSP client will call this handler function any time a test is
// detected. This allows Calva to populate the Test Explorer from the data provided
// by Clojure LSP. This indirection allows us to write testRunner.ts without
// specific knowledge of LSP, and also write the LSP client without any specific
// knowledge of the testRunner code.
export type TestTreeHandler = (tree: TestTreeParams) => void;

export enum LspStatus {
  Stopped = 'Stopped',
  Starting = 'Starting',
  Running = 'Running',
  Failed = 'Failed',
  Unknown = 'Unknown',
}

export type LspClient = {
  id: string;
  uri: vscode.Uri;
  client: vscode_lsp.LanguageClient;
  status: LspStatus;
};
export type LspClientStore = Map<string, LspClient>;
