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

  public resolveTreeItem(
    item: EvaluationResult,
    element: EvaluationResult,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TreeItem> {
    return item;
  }

  private createResultItem(
    item: any,
    isTopLevel: boolean,
    keyOrIndex?: string | number
  ): EvaluationResult {
    let children: EvaluationResult[] | undefined;
    if (Array.isArray(item.value)) {
      children = item.value.map((childItem, index) =>
        this.createResultItem(childItem, false, index.toString())
      );
    } else if (item.value instanceof Map) {
      children = Array.from(item.value.entries()).map(([key, value]) => {
        const keyItem = this.createResultItem(key, false);
        const valueItem = this.createResultItem(value, false);
        return new EvaluationResult(
          valueItem.value,
          valueItem.originalString,
          `${keyItem.label} ${valueItem.originalString}`,
          false,
          new Map([[keyItem, valueItem]])
        );
      });
    }

    return new EvaluationResult(
      item.value,
      item.originalString,
      `${keyOrIndex !== undefined ? keyOrIndex + ' ' : ''}${item.originalString}`,
      isTopLevel,
      children
    );
  }

  public addResult(result: string): void {
    const cursor = tokenCursor.createStringCursor(result);
    const structure = cursorUtil.structureForRightSexp(cursor);
    const items = this.createResultItem({ originalString: result, value: structure }, true);
    this.treeData.unshift(items);
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
  label: string;

  constructor(
    value: string | Map<EvaluationResult, EvaluationResult> | EvaluationResult[],
    originalString: string,
    label: string,
    isTopLevel: boolean,
    children?: Map<EvaluationResult, EvaluationResult> | EvaluationResult[]
  ) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.value = value;
    this.originalString = originalString;
    this.label = label;
    this.children = children;
    this.tooltip = new vscode.MarkdownString('```clojure\n' + originalString + '\n```');
    if (isTopLevel) {
      this.contextValue = 'result';
    }
    this.resourceUri = vscode.Uri.parse(
      'calva-results-inspector://result/' + originalString + '.edn'
    );
    // TODO: Do these checks using ClojureScript instead
    this.iconPath = new vscode.ThemeIcon(
      value instanceof Map
        ? 'symbol-namespace'
        : Array.isArray(value)
        ? 'symbol-array'
        : value === 'nil'
        ? 'blank'
        : value.startsWith('#"')
        ? 'regex'
        : originalString.startsWith('#')
        ? 'symbol-string'
        : value.endsWith('"')
        ? 'quote'
        : value.startsWith(':')
        ? 'symbol-keyword'
        : Number.parseFloat(value)
        ? 'symbol-numeric'
        : 'symbol-key'
    );
  }
}

export class ResultDecorationProvider implements vscode.FileDecorationProvider {
  onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[]>;

  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme === 'calva-results-inspector') {
      return new vscode.FileDecoration(
        undefined,
        'foo tooltip',
        new vscode.ThemeColor('terminal.ansiBrightBlue')
      );
    }
  }
}
