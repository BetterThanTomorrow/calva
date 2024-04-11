import * as vscode from 'vscode';
import * as cursorUtil from '../cursor-doc/utilities';
import * as tokenCursor from '../cursor-doc/token-cursor';

export class NreplResultProvider implements vscode.TreeDataProvider<NreplResult> {
  private _onDidChangeTreeData: vscode.EventEmitter<NreplResult | undefined> =
    new vscode.EventEmitter<NreplResult | undefined>();
  readonly onDidChangeTreeData: vscode.Event<NreplResult | undefined> =
    this._onDidChangeTreeData.event;

  refresh(item: NreplResult): void {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: NreplResult): vscode.TreeItem {
    return element;
  }

  getChildren(element?: NreplResult): Thenable<NreplResult[]> {
    if (element) {
      // If we have an element, return its children
      const children = Array.isArray(element.children)
        ? element.children
        : Array.from(element.children.values());
      return Promise.resolve(children);
    } else {
      // If we don't have an element, this means we're at the root of the tree
      // Here, we return the top level entries
      return Promise.resolve(this.getNreplResults());
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

  /**
   * Fetch the nREPL results and convert them to NreplResult objects
   */
  private getNreplResults(): NreplResult[] {
    // TODO: Fetch the nREPL results and convert them to NreplResult objects
    const cursor = tokenCursor.createStringCursor('[#t {:a 1}]');
    const structure = cursorUtil.structureForRightSexp(cursor);
    return structure.map((item) => this.createNreplResult(item));
  }

  public convertResultToTreeData(result: string): void {
    const cursor = tokenCursor.createStringCursor(result);
    const structure = cursorUtil.structureForRightSexp(cursor);
    const treeData = structure.map((item) => this.createNreplResult(item));
    this._onDidChangeTreeData.fire(treeData);
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
