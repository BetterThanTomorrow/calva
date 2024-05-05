import * as vscode from 'vscode';
import * as cursorUtil from '../cursor-doc/utilities';
import * as tokenCursor from '../cursor-doc/token-cursor';
import * as state from '../state';
import * as printer from '../printer';
import * as select from '../select';
import * as config from '../config';

// Used to represent a key-value pair, and keys in the tree data.
// Chosen so that they can't appear in valid Clojure code
const KV_PAIR_SENTINEL = ': {-kv-pair-} :';
const KV_PAIR_KEY_SENTINEL = ': {-kv-pair-key-} :';
const KV_PAIR_VALUE_SENTINEL = ': {-kv-pair-value-} :';

type ItemChildType = 'array-item' | 'map-entry' | 'kv-pair-map-entry' | 'root';
type ItemType = 'array' | 'map' | 'kv-pair-map' | 'atomic';

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
    const prettyString: string = prettifiedOriginalString(item);
    item.tooltip = new vscode.MarkdownString(
      (item.info ? item.info + '\n' : '') +
        '```clojure\n' +
        prettyString.substring(0, 10000) +
        '\n```'
    );
    return item;
  }

  public createInspectorItem(
    item: any,
    level: number,
    rainbowEnabled: boolean,
    itemChildType: ItemChildType,
    keyOrIndex: string | number
  ): InspectorItem {
    let children: InspectorItem[] | undefined;
    let itemType: ItemType = 'atomic';
    if (Array.isArray(item.value)) {
      itemType = 'array';
      children = item.value.map((childItem, index) =>
        this.createInspectorItem(childItem, level + 1, rainbowEnabled, 'array-item', index)
      );
    } else if (item.value instanceof Map) {
      itemType = 'map';
      children = Array.from((item.value as Map<any, any>).entries()).map(([key, value]) => {
        const keyItem = this.createInspectorItem(
          key,
          level + 1,
          rainbowEnabled,
          'kv-pair-map-entry',
          KV_PAIR_KEY_SENTINEL
        );
        const valueItem = this.createInspectorItem(
          value,
          level + 1,
          rainbowEnabled,
          'kv-pair-map-entry',
          KV_PAIR_VALUE_SENTINEL
        );
        return new InspectorItem({
          value: KV_PAIR_SENTINEL,
          originalString: valueItem.originalString,
          keyOrIndex: keyItem.originalString,
          itemType: 'kv-pair-map',
          itemChildType: 'map-entry',
          info: undefined,
          level: level + 1,
          rainbowEnabled: rainbowEnabled,
          children: [keyItem, valueItem],
        });
      });
    }

    return new InspectorItem({
      value: item.value,
      originalString: item.originalString,
      info: item.info,
      itemChildType: itemChildType,
      itemType: itemType,
      keyOrIndex: keyOrIndex,
      rainbowEnabled: rainbowEnabled,
      level: level,
      children: children,
    });
  }

  public addItem(text: string, reveal: boolean, info?: string): void {
    const newItem = new InspectorItem({
      value: text,
      originalString: text,
      itemChildType: 'root',
      itemType: 'atomic',
      rainbowEnabled: config.getConfig().enableInspectorRainbow,
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

function prettifiedOriginalString(item: InspectorItem) {
  const printerOptions = {
    ...printer.prettyPrintingOptions(),
    width: 80,
    style: ['community', 'justified'],
    map: { 'sort?': false, 'comma?': false },
  };
  const result = printer.prettyPrint(item.originalString, printerOptions);
  return result?.value || item.originalString;
}

export const copyItemValue = async (item: InspectorItem) => {
  await vscode.env.clipboard.writeText(prettifiedOriginalString(item));
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
        const printerOptions = {
          ...printer.prettyPrintingOptions(),
          width: 500,
          map: { 'sort?': true, 'comma?': false },
        };
        const prettyResults = printer.prettyPrint(originalString, printerOptions);
        const prettyString = prettyResults?.value || originalString;
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
          config.getConfig().enableInspectorRainbow,
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
    itemType,
    itemChildType,
    keyOrIndex,
    info,
    level,
    rainbowEnabled,
    children,
  }: {
    value: string;
    originalString: string;
    keyOrIndex?: number | string;
    itemType: ItemType;
    itemChildType: ItemChildType;
    info: string;
    level: number | null;
    rainbowEnabled: boolean;
    children?: Map<InspectorItem, InspectorItem> | InspectorItem[];
  }) {
    const isKVSentinel = [KV_PAIR_VALUE_SENTINEL, KV_PAIR_KEY_SENTINEL].includes(
      keyOrIndex as string
    );

    const label = (
      keyOrIndex && itemChildType !== 'array-item' && !isKVSentinel
        ? `${keyOrIndex} ${originalString}`
        : originalString
    ).replace(/\s+/g, ' ');
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
    if (level === null) {
      this.contextValue = 'raw';
    } else if (level === 0) {
      this.contextValue = 'inspectable';
    }
    const type = cljType(originalString, value);
    const rainbowEnabledString = rainbowEnabled ? 'rainbowEnabled' : 'rainbowDisabled';
    this.resourceUri = vscode.Uri.parse(
      `calva-inspector://${type}/${itemType}/${itemChildType}/${level}/${rainbowEnabledString}/#${keyOrIndex}`
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

const rainbow = [
  'editorBracketHighlight.foreground1',
  'editorBracketHighlight.foreground2',
  'editorBracketHighlight.foreground3',
  'editorBracketHighlight.foreground4',
  'editorBracketHighlight.foreground5',
  'editorBracketHighlight.foreground6',
];

export class InspectorItemDecorationProvider implements vscode.FileDecorationProvider {
  onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[]>;

  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const colorIndex = (i: number) => i % rainbow.length;

    const keyOrIndex = uri.fragment;
    const [itemType, childType, level, rainbowEnabledString] = uri.path.split('/').slice(1);
    const rainbowEnabled = rainbowEnabledString === 'rainbowEnabled';
    const badge =
      childType === 'kv-pair-map-entry'
        ? keyOrIndex === KV_PAIR_KEY_SENTINEL
          ? 'k'
          : 'v'
        : childType === 'array-item'
        ? Number(keyOrIndex) < 100
          ? keyOrIndex
          : '…'
        : undefined;
    if (uri.scheme === 'calva-inspector') {
      return new vscode.FileDecoration(
        badge,
        undefined,
        rainbowEnabled && ['map', 'array'].includes(itemType)
          ? new vscode.ThemeColor(rainbow[colorIndex(Number(level))])
          : undefined
      );
    }
  }
}

export function revealOnConnect() {
  if (config.getConfig().autoOpenInspector) {
    void vscode.commands.executeCommand('calva.revealInspector');
  }
}
