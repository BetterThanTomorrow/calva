import * as vscode from 'vscode';
import * as cursorUtil from '../cursor-doc/utilities';
import * as tokenCursor from '../cursor-doc/token-cursor';

export class NreplResultProvider implements vscode.TreeDataProvider<NreplResult> {
  private _onDidChangeTreeData: vscode.EventEmitter<NreplResult | undefined | null | void> =
    new vscode.EventEmitter<NreplResult | undefined>();
  readonly onDidChangeTreeData: vscode.Event<NreplResult | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private treeData: NreplResult[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: NreplResult): vscode.TreeItem {
    return element;
  }

  getChildren(element?: NreplResult): vscode.ProviderResult<NreplResult[]> {
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

  private createNreplResult(item: any): NreplResult {
    let children: NreplResult[] | undefined;

    if (Array.isArray(item.value)) {
      children = item.value.map((childItem) => this.createNreplResult(childItem));
    } else if (item.value instanceof Map) {
      children = Array.from(item.value.values()).map((childItem) =>
        this.createNreplResult(childItem)
      );
    }

    return new NreplResult(item.originalString, item.value, item.originalString, children);
  }

  public addResult(result: string): void {
    const cursor = tokenCursor.createStringCursor(result);
    const structure = cursorUtil.structureForRightSexp(cursor);
    this.treeData = structure.map((item) => this.createNreplResult(item));
    this.refresh();
  }

  private hardcodedResults(): NreplResult[] {
    const cursor = tokenCursor.createStringCursor('[#t {:a 1}]');
    const structure = cursorUtil.structureForRightSexp(cursor);
    return structure.map((item) => this.createNreplResult(item));
  }
}

class NreplResult extends vscode.TreeItem {
  children: Map<NreplResult, NreplResult> | NreplResult[] | undefined;
  value: string | Map<NreplResult, NreplResult> | NreplResult[];
  originalString: string;

  constructor(
    label: string,
    value: string | Map<NreplResult, NreplResult> | NreplResult[],
    originalString: string,
    children?: Map<NreplResult, NreplResult> | NreplResult[]
  ) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.value = value;
    this.originalString = originalString;
    this.children = children;
  }
}
