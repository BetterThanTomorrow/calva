import * as vscode from 'vscode';
import * as cursorUtil from '../cursor-doc/utilities';
import * as tokenCursor from '../cursor-doc/token-cursor';
import * as state from '../state';
import * as printer from '../printer';
import * as select from '../select';
import * as config from '../config';

export class InspectorDataProvider implements vscode.TreeDataProvider<InspectorItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<InspectorItem | undefined | null | void> =
    new vscode.EventEmitter<InspectorItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<InspectorItem | undefined | null | void> =
    this._onDidChangeTreeData.event;
  public treeView: vscode.TreeView<InspectorItem>;
  public treeData: InspectorItem[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: InspectorItem): vscode.TreeItem {
    return element;
  }

  getParent(element: InspectorItem): vscode.ProviderResult<InspectorItem> {
    return element ? element.parent : null;
  }

  getChildren(element?: InspectorItem): vscode.ProviderResult<InspectorItem[]> {
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
    item: InspectorItem,
    element: InspectorItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TreeItem> {
    return item;
  }

  public createInspectorItem(
    item: any,
    level: number,
    parent: InspectorItem | null,
    keyOrIndex?: string | number
  ): InspectorItem {
    let children: InspectorItem[] | undefined;
    if (Array.isArray(item.value)) {
      children = item.value.map((childItem, index) =>
        this.createInspectorItem(childItem, level + 1, parent, index.toString())
      );
    } else if (item.value instanceof Map) {
      children = Array.from((item.value as Map<any, any>).entries()).map(([key, value]) => {
        const keyItem = this.createInspectorItem(key, level + 2, parent);
        const valueItem = this.createInspectorItem(value, level + 2, parent, 'v:');
        return new InspectorItem(
          new Map([[keyItem, valueItem]]),
          `${keyItem.originalString} ${valueItem.originalString}`,
          `${keyItem.label} ${valueItem.originalString}`,
          level + 1,
          parent,
          [this.createInspectorItem(key, level + 2, parent, 'k:'), valueItem]
        );
      });
    }

    return new InspectorItem(
      item.value,
      item.originalString,
      `${keyOrIndex !== undefined ? keyOrIndex + ' ' : ''}${item.originalString}`,
      level,
      parent,
      children
    );
  }

  public addItem(text: string, reveal = false): void {
    const newItem = new InspectorItem(text, text, text, null, null);
    this.treeData.unshift(newItem);
    this.refresh();
    if (reveal) {
      void this.treeView.reveal(newItem, { select: true, focus: true });
    }
  }

  public clearInspector(itemToClear?: InspectorItem): void {
    if (itemToClear) {
      const index = this.treeData.indexOf(itemToClear);
      if (index > -1) {
        this.treeData.splice(index, 1);
      }
    } else {
      this.treeData = [];
    }
    this.refresh();
  }
}

export const copyItemValue = async (item: InspectorItem) => {
  await vscode.env.clipboard.writeText(item.originalString);
};

export async function pasteFromClipboard() {
  const clipboardContent = await vscode.env.clipboard.readText();
  this.addItem(clipboardContent, true);
}

export function addToInspector(arg: string) {
  const selection = vscode.window.activeTextEditor?.selection;
  const document = vscode.window.activeTextEditor?.document;
  const text = arg || selection ? document?.getText(selection) : '';
  if (text && text !== '') {
    this.addItem(text, true);
    return;
  }
  if (document && selection) {
    const currentFormSelection = select.getFormSelection(document, selection.active, false);
    this.addItem(document.getText(currentFormSelection), true);
  }
}

export function createTreeStructure(item: InspectorItem) {
  void vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Creating tree structure...',
      cancellable: false,
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async (progress) => {
      const index = this.treeData.indexOf(item);
      if (index > -1) {
        progress.report({ increment: 0 });
        const originalString = this.treeData[index].originalString;
        const startTime = performance.now();

        const prettyPrintStartTime = performance.now();
        const printerOptions = printer.prettyPrintingOptions();
        const firstLineLength = originalString.split('\n')[0].length;
        const needPrettyPrint = firstLineLength > 10000;
        const prettyString = needPrettyPrint
          ? printer.prettyPrint(originalString, printerOptions)?.value || originalString
          : originalString;
        const prettyPrintEndTime = performance.now();
        progress.report({ increment: 85 });

        const cursorStartTime = performance.now();
        const cursor = tokenCursor.createStringCursor(prettyString);
        const cursorEndTime = performance.now();
        progress.report({ increment: 90 });

        const structureStartTime = performance.now();
        const structure = cursorUtil.structureForRightSexp(cursor);
        const structureEndTime = performance.now();
        progress.report({ increment: 95 });

        const itemStartTime = performance.now();
        const item = this.createInspectorItem(
          { originalString: originalString, value: structure },
          0
        );
        const itemEndTime = performance.now();
        progress.report({ increment: 99 });

        const endTime = performance.now();

        console.log(
          `Total (ms)=${endTime - startTime}, prettyPrinting=${
            prettyPrintEndTime - prettyPrintStartTime
          }, createStringCursor=${cursorEndTime - cursorStartTime}, structureForRightSexp=${
            structureEndTime - structureStartTime
          }, createInspectorItem=${itemEndTime - itemStartTime}`
        );
        console.log(
          'Size of treeData (estimate):',
          JSON.stringify(this.treeData).length / 1024 / 1024 / 1024,
          'GB'
        );

        this.treeData[index] = item;
        this.refresh();
        // TODO: Remove this workaround when vscode.TreeItemCollapsibleState.Expanded works
        this.treeView.reveal(item, { select: true, focus: true, expand: true });
        progress.report({ increment: 100 });
      }
    }
  );
}

class InspectorItem extends vscode.TreeItem {
  children: Map<InspectorItem, InspectorItem> | InspectorItem[] | undefined;
  value: string | Map<InspectorItem, InspectorItem> | InspectorItem[];
  originalString: string;
  label: string;
  parent: InspectorItem | null;

  constructor(
    value: string | Map<InspectorItem, InspectorItem> | InspectorItem[],
    originalString: string,
    label: string,
    level: number | null,
    parent: InspectorItem | null,
    children?: Map<InspectorItem, InspectorItem> | InspectorItem[]
  ) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : level === 0
        ? vscode.TreeItemCollapsibleState.Expanded // Note: Doesn't work, see createTreeStructure
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.value = value;
    this.originalString = originalString;
    this.label = label.replace(/[\n\r]/g, ' ');
    this.parent = parent;
    this.children = children;
    this.tooltip = new vscode.MarkdownString('```clojure\n' + originalString + '\n```');
    if (level === null) {
      this.contextValue = 'raw';
    } else if (level === 0) {
      this.contextValue = 'inspectable';
    }
    this.resourceUri = vscode.Uri.parse('calva-inspector://item/' + originalString);

    const isStructuralKey =
      value instanceof Map &&
      value.size > 0 &&
      Array.from(value.entries()).every(
        ([key, val]) => key instanceof InspectorItem && val instanceof InspectorItem
      );
    try {
      const [iconSelectorString, iconSelectorValue] = isStructuralKey
        ? [Array.from(value.values())[0].originalString, Array.from(value.values())[0].value]
        : [originalString, value];
      this.iconPath = getIconPath(iconSelectorString, iconSelectorValue);
    } catch (error) {
      console.error('Error setting iconPath:', error);
    }
  }
}

function icon(name: string) {
  const extensionContext = state.extensionContext;
  const path = (name, theme) => {
    return vscode.Uri.joinPath(
      extensionContext.extensionUri,
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
  value: string | InspectorItem | InspectorItem[] | Map<InspectorItem, InspectorItem>
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

export class InspectorItemDecorationProvider implements vscode.FileDecorationProvider {
  onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[]>;

  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme === 'calva-inspector') {
      return new vscode.FileDecoration(
        undefined,
        'foo tooltip',
        new vscode.ThemeColor('terminal.ansiBrightBlue')
      );
    }
  }
}

export function revealOnConnect() {
  if (config.getConfig().autoOpenInspector) {
    void vscode.commands.executeCommand('calva.revealInspector');
  }
}