import * as vscode from 'vscode';
import * as cursorUtil from '../cursor-doc/utilities';
import * as tokenCursor from '../cursor-doc/token-cursor';
// import { performance } from 'perf_hooks';

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
        if (key.value instanceof Map || Array.isArray(key.value)) {
          const keyItem = this.createResultItem(key, false);
          const valueItem = this.createResultItem(value, false, 'value');
          return new EvaluationResult(
            new Map([[keyItem, valueItem]]),
            `${keyItem.originalString} ${valueItem.originalString}`,
            `${keyItem.label} ${valueItem.originalString}`,
            false,
            [this.createResultItem(key, false, 'key'), valueItem]
          );
        } else {
          const keyItem = this.createResultItem(key, false);
          const valueItem = this.createResultItem(value, false);
          return new EvaluationResult(
            valueItem.value,
            valueItem.originalString,
            `${keyItem.label} ${valueItem.originalString}`,
            false,
            new Map([[keyItem, valueItem]])
          );
        }
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
    const startTime = performance.now();

    const cursorStartTime = performance.now();
    const cursor = tokenCursor.createStringCursor(result);
    const cursorEndTime = performance.now();

    const structureStartTime = performance.now();
    const structure = cursorUtil.structureForRightSexp(cursor);
    const structureEndTime = performance.now();

    const itemsStartTime = performance.now();
    const items = this.createResultItem({ originalString: result, value: structure }, true);
    const itemsEndTime = performance.now();

    this.treeData.unshift(items);
    this.refresh();

    const endTime = performance.now();

    console.log(
      `Total (ms)=${endTime - startTime}, createStringCursor=${
        cursorEndTime - cursorStartTime
      }, structureForRightSexp=${structureEndTime - structureStartTime}, createResultItem=${
        itemsEndTime - itemsStartTime
      }`
    );
    console.log(
      'Size of treeData (estimate):',
      JSON.stringify(this.treeData).length / 1024 / 1024 / 1024,
      'GB'
    );
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

export const copyItemValue = async (item: EvaluationResult) => {
  await vscode.env.clipboard.writeText(item.originalString);
};

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
    this.label = label.replace(/[\n\r]/g, ' ');
    this.children = children;
    this.tooltip = new vscode.MarkdownString('```clojure\n' + originalString + '\n```');
    if (isTopLevel) {
      this.contextValue = 'result';
    }
    this.resourceUri = vscode.Uri.parse(
      'calva-results-inspector://result/' + originalString + '.edn'
    );

    const isStructuralKey =
      value instanceof Map &&
      Array.from(value.entries()).every(
        ([key, val]) => key instanceof EvaluationResult && val instanceof EvaluationResult
      );
    const [iconSelectorString, iconSelectorValue] = isStructuralKey
      ? [Array.from(value.values())[0].originalString, Array.from(value.values())[0].value]
      : [originalString, value];
    this.iconPath = getIconPath(iconSelectorString, iconSelectorValue);
  }
}

function icon(name: string) {
  const path = (name, theme) => {
    return vscode.Uri.joinPath(
      vscode.Uri.file(__filename),
      '..',
      '..',
      '..',
      'assets',
      'images',
      'icons',
      `${name}-${theme}.svg`
    );
  };
  return {
    light: path(name, 'light'),
    dark: path(name, 'dark'),
  };
}

function getIconPath(
  originalString: string,
  value: string | EvaluationResult | EvaluationResult[] | Map<EvaluationResult, EvaluationResult>
) {
  return originalString.startsWith('{')
    ? icon('map')
    : originalString.startsWith('[')
    ? icon('vector')
    : originalString.startsWith('(')
    ? icon('list')
    : originalString.startsWith('#{')
    ? icon('set')
    : value === 'nil'
    ? new vscode.ThemeIcon('blank')
    : value === 'true'
    ? icon('bool')
    : value === 'false'
    ? icon('bool')
    : originalString.startsWith('#"')
    ? icon('regex')
    : originalString.startsWith("#'")
    ? icon('var')
    : originalString.startsWith('#')
    ? icon('tag')
    : originalString.startsWith('"')
    ? icon('string')
    : originalString.startsWith(':')
    ? icon('kw')
    : Number.parseFloat(originalString) // works for ratios too b/c javascript
    ? icon('numeric')
    : icon('symbol');
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
