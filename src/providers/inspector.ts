import * as vscode from 'vscode';
import * as cursorUtil from '../cursor-doc/utilities';
import * as tokenCursor from '../cursor-doc/token-cursor';
import * as state from '../state';
import * as printer from '../printer';
import * as select from '../select';
import * as config from '../config';

// Used to represent a key-value pair in the tree data.
// It can't appear in valid Clojure code
const KV_PAIR_SENTINEL = ': {-kv-pair-} :';

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

  getParent(_element: InspectorItem): vscode.ProviderResult<InspectorItem> {
    // We must implement this method to satisfy VS Code's revealing,
    // but we don't need it for our purposes and things seem to work with this.
    return null;
  }

  public getTopMostItem(): InspectorItem | undefined {
    return this.treeData[0];
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
    keyOrIndex?: string | number
  ): InspectorItem {
    let children: InspectorItem[] | undefined;
    if (Array.isArray(item.value)) {
      children = item.value.map((childItem, index) =>
        this.createInspectorItem(childItem, level + 1, index)
      );
    } else if (item.value instanceof Map) {
      children = Array.from((item.value as Map<any, any>).entries()).map(([key, value]) => {
        const keyItem = this.createInspectorItem(key, level + 2, 'k:');
        const valueItem = this.createInspectorItem(value, level + 2, 'v:');
        return new InspectorItem({
          value: KV_PAIR_SENTINEL,
          originalString: valueItem.originalString,
          keyOrIndex: keyItem.originalString,
          info: undefined,
          level: level + 1,
          children: [keyItem, valueItem],
        });
      });
    }

    return new InspectorItem({
      value: item.value,
      originalString: item.originalString,
      info: item.info,
      keyOrIndex: keyOrIndex,
      level: level,
      children: children,
    });
  }

  public addItem(text: string, reveal: boolean, info?: string): void {
    const newItem = new InspectorItem({
      value: text,
      originalString: text,
      info: info,
      level: null,
    });
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

export function addToInspector(arg: string | { value?: string; info: string } | undefined) {
  const selection = vscode.window.activeTextEditor?.selection;
  const document = vscode.window.activeTextEditor?.document;
  const relativePath = vscode.workspace.asRelativePath(document?.uri);
  const text = arg || selection ? document?.getText(selection) : '';
  const info =
    arg && typeof arg === 'object'
      ? arg.info
      : document
      ? `${relativePath}:${selection.active.line + 1}:${selection.active.character + 1}`
      : undefined;
  if (text && text !== '') {
    this.addItem(text, true, info);
    return;
  }
  if (document && selection) {
    const currentFormSelection = select.getFormSelection(document, selection.active, false);
    this.addItem(document.getText(currentFormSelection), true, info);
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
        const inspectableItem = this.createInspectorItem(
          { originalString: originalString, value: structure, info: item.info },
          0,
          null
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

        this.treeData[index] = inspectableItem;
        this.refresh();
        // TODO: Remove this workaround when vscode.TreeItemCollapsibleState.Expanded works
        this.treeView.reveal(inspectableItem, { select: true, focus: true, expand: true });
        progress.report({ increment: 100 });
      }
    }
  );
}

class InspectorItem extends vscode.TreeItem {
  children: Map<InspectorItem, InspectorItem> | InspectorItem[] | undefined;
  value: string;
  originalString: string;
  keyOrIndex: number | string | undefined;
  info: string;

  constructor({
    value,
    originalString,
    keyOrIndex,
    info,
    level,
    children,
  }: {
    value: string;
    originalString: string;
    keyOrIndex?: number | string;
    info: string;
    level: number | null;
    children?: Map<InspectorItem, InspectorItem> | InspectorItem[];
  }) {
    const label = (keyOrIndex ? `${keyOrIndex} ${originalString}` : originalString).replace(
      /\s+/g,
      ' '
    );
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
    this.info = info;
    this.children = children;
    this.tooltip = new vscode.MarkdownString(
      (info ? info + '\n' : '') + '```clojure\n' + originalString + '\n```'
    );
    if (level === null) {
      this.contextValue = 'raw';
    } else if (level === 0) {
      this.contextValue = 'inspectable';
    }
    const type = cljType(originalString, value);
    this.resourceUri = vscode.Uri.parse(
      `calva-inspector://${type}/${keyOrIndex}/${originalString}`
    );
    this.iconPath = icon(type);
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

function cljType(originalString: string, value: string) {
  return value === KV_PAIR_SENTINEL
    ? 'kv-pair'
    : originalString.startsWith('{')
    ? 'map'
    : originalString.startsWith('[')
    ? 'vector'
    : originalString.startsWith('(')
    ? 'list'
    : originalString.startsWith('#{')
    ? 'set'
    : value === 'nil'
    ? 'nil'
    : value === 'true'
    ? 'bool'
    : value === 'false'
    ? 'bool'
    : originalString.startsWith('#"')
    ? 'regex'
    : originalString.startsWith("#'")
    ? 'var'
    : originalString.startsWith('#')
    ? 'tag'
    : originalString.startsWith('"')
    ? 'string'
    : originalString.startsWith(':')
    ? 'kw'
    : Number.parseFloat(originalString) // works for ratios too b/c javascript
    ? 'numeric'
    : 'symbol';
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
