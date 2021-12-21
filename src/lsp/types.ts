import * as vscode from 'vscode';

export enum TestTreeKind {
    DEFTEST = 0,
    TESTING = 1
}

export interface TestTreeNode {
    name: string,
    'name-range': vscode.Range
    range: vscode.Range,
    kind: TestTreeKind
    children: TestTreeNode[]
}

export interface TestTreeParams {
    uri: string
    tree: TestTreeNode
}

export type TestTreeHandler = (tree: TestTreeParams) => void;
