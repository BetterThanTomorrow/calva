import * as vscode from 'vscode';
import * as cursorUtil from '../cursor-doc/utilities';
import * as tokenCursor from '../cursor-doc/token-cursor';

export class ResultsInspectorProvider implements vscode.TreeDataProvider<EvaluationResult> {
  private _onDidChangeTreeData: vscode.EventEmitter<EvaluationResult | undefined | null | void> =
    new vscode.EventEmitter<EvaluationResult | undefined>();
  readonly onDidChangeTreeData: vscode.Event<EvaluationResult | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private treeData: EvaluationResult[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: EvaluationResult): vscode.TreeItem {
    return element;
  }

  getChildren(element?: EvaluationResult): vscode.ProviderResult<EvaluationResult[]> {
    if (element) {
      const children = Array.isArray(element.children)
        ? element.children
        : Array.from(element.children.values());
      return children;
    } else {
      return this.treeData;
      // return this.hardcodedResults();
    }
  }

  private createNreplResult(item: any): EvaluationResult {
    let children: EvaluationResult[] | undefined;
    if (Array.isArray(item.value)) {
      children = item.value.map((childItem) => this.createNreplResult(childItem));
    } else if (item.value instanceof Map) {
      children = Array.from(item.value.values()).map((childItem) =>
        this.createNreplResult(childItem)
      );
    } else if (typeof item.value === 'string') {
      return new EvaluationResult(item.originalString, item.value, item.originalString);
    } else if (typeof item.value === 'object') {
      children = Object.entries(item.value).map(([key, value]) =>
        this.createNreplResult({ originalString: key, value })
      );
    } else {
      return new EvaluationResult(
        String(item.originalString),
        String(item.value),
        String(item.originalString)
      );
    }

    return new EvaluationResult(item.originalString, item.value, item.originalString, children);
  }

  public addResult(result: string): void {
    const cursor = tokenCursor.createStringCursor(result);
    const structure = cursorUtil.structureForRightSexp(cursor);
    const newResult = this.createNreplResult({ originalString: result, value: structure });
    this.treeData.push(newResult); // Append new result to the existing tree data
    this.refresh();
  }

  private hardcodedResults(): EvaluationResult[] {
    const cursor = tokenCursor.createStringCursor('[#t {:a 1}]');
    const structure = cursorUtil.structureForRightSexp(cursor);
    return structure.map((item) => this.createNreplResult(item));
  }
}

class EvaluationResult extends vscode.TreeItem {
  children: Map<EvaluationResult, EvaluationResult> | EvaluationResult[] | undefined;
  value: string | Map<EvaluationResult, EvaluationResult> | EvaluationResult[];
  originalString: string;

  constructor(
    label: string,
    value: string | Map<EvaluationResult, EvaluationResult> | EvaluationResult[],
    originalString: string,
    children?: Map<EvaluationResult, EvaluationResult> | EvaluationResult[]
  ) {
    super(
      originalString, // Display the originalString as the label
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.value = value;
    this.originalString = originalString;
    this.children = children;
    this.tooltip = new vscode.MarkdownString('```clojure\n' + originalString + '\n```');
  }
}
