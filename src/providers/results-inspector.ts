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
    }
  }

  // public resolveTreeItem(
  //   item: EvaluationResult,
  //   element: EvaluationResult,
  //   token: vscode.CancellationToken
  // ): vscode.ProviderResult<vscode.TreeItem> {
  //   item.command = {
  //     command: 'calva.clearInspectorResults',
  //     arguments: [element],
  //     title: 'Clear Result',
  //   };
  //   return item;
  // }

  public resolveTreeItem(
    item: EvaluationResult,
    element: EvaluationResult,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TreeItem> {
    return item;
  }

  private createNreplResult(item: any, isTopLevel: boolean): EvaluationResult {
    let children: EvaluationResult[] | undefined;
    if (Array.isArray(item.value)) {
      children = item.value.map((childItem) => this.createNreplResult(childItem, false));
    } else if (item.value instanceof Map) {
      children = Array.from(item.value.values()).map((childItem) =>
        this.createNreplResult(childItem, false)
      );
    } else if (typeof item.value === 'string') {
      return new EvaluationResult(item.value, item.originalString, isTopLevel);
    } else if (typeof item.value === 'object') {
      children = Object.entries(item.value).map(([key, value]) =>
        this.createNreplResult({ originalString: key, value }, false)
      );
    } else {
      return new EvaluationResult(String(item.value), String(item.originalString), isTopLevel);
    }

    return new EvaluationResult(item.value, item.originalString, isTopLevel, children);
  }

  public addResult(result: string): void {
    const cursor = tokenCursor.createStringCursor(result);
    const structure = cursorUtil.structureForRightSexp(cursor);
    const newResult = this.createNreplResult({ originalString: result, value: structure }, true);
    this.treeData.unshift(newResult);
    this.refresh();
  }

  public clearResults(resultToClear?: EvaluationResult): void {
    if (resultToClear) {
      const index = this.treeData.indexOf(resultToClear);
      if (index > -1) {
        this.treeData.splice(index, 1);
      }
    } else {
      this.treeData = [];
    }
    this.refresh();
  }
}

class EvaluationResult extends vscode.TreeItem {
  children: Map<EvaluationResult, EvaluationResult> | EvaluationResult[] | undefined;
  value: string | Map<EvaluationResult, EvaluationResult> | EvaluationResult[];
  originalString: string;

  constructor(
    value: string | Map<EvaluationResult, EvaluationResult> | EvaluationResult[],
    originalString: string,
    isTopLevel: boolean,
    children?: Map<EvaluationResult, EvaluationResult> | EvaluationResult[]
  ) {
    super(
      originalString,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.value = value;
    this.originalString = originalString;
    this.children = children;
    this.tooltip = new vscode.MarkdownString('```clojure\n' + originalString + '\n```');
    if (isTopLevel) {
      this.contextValue = 'result';
    }
  }
}
