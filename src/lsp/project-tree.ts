import * as vscode from 'vscode';
import * as vscode_lsp from 'vscode-languageclient/node';

interface Position {
  line: number;
  character: number;
}
interface Range {
  start: Position;
  end: Position;
}

enum ProjectTreeNodeType {
  project = 1,
  sourcePath = 2,
  library = 3,
  jar = 4,
  ns = 5,
  class = 6,
  function = 7,
  variable = 8,
  interface = 9,
}

interface ProjectTreeNodeBranch {
  name: string;
  type: ProjectTreeNodeType;
  id?: string;
  uri?: string;
  detail?: string;
  nodes: [ProjectTreeNode];
}

interface ProjectTreeNodeLeaf {
  name: string;
  type: ProjectTreeNodeType;
  id?: string;
  uri?: string;
  detail?: string;
  range?: Range;
  final: boolean;
}

type ProjectTreeNode = ProjectTreeNodeBranch | ProjectTreeNodeLeaf;

class ProjectTreeDataProvider
  implements vscode.TreeDataProvider<ProjectTreeNode>, vscode.TextDocumentContentProvider
{
  constructor(private readonly client: vscode_lsp.LanguageClient) {}

  // private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
  // readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

  private _elementTypeToIcon(type: ProjectTreeNodeType): vscode.ThemeIcon {
    switch (type) {
      case ProjectTreeNodeType.project:
        return vscode.ThemeIcon.Folder;
      case ProjectTreeNodeType.sourcePath:
        return new vscode.ThemeIcon('file-directory');
      case ProjectTreeNodeType.library:
        return new vscode.ThemeIcon('library');
      case ProjectTreeNodeType.jar:
        return vscode.ThemeIcon.File;
      case ProjectTreeNodeType.class:
        return new vscode.ThemeIcon('symbol-class');
      case ProjectTreeNodeType.ns:
        return vscode.ThemeIcon.File;
      case ProjectTreeNodeType.interface:
        return new vscode.ThemeIcon('symbol-interface');
      case ProjectTreeNodeType.function:
        return new vscode.ThemeIcon('symbol-function');
      case ProjectTreeNodeType.variable:
        return new vscode.ThemeIcon('symbol-variable');
      default:
        vscode.ThemeIcon.File;
    }
  }

  getTreeItem(element: ProjectTreeNode): vscode.TreeItem {
    const isFinal = 'final' in element && element.final;

    return {
      label: element.name,
      resourceUri: vscode.Uri.parse(element.uri),
      description: element.detail,
      id: element.id,
      tooltip: element.name,
      iconPath: this._elementTypeToIcon(element.type),
      collapsibleState: isFinal
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed,
      command: element.uri
        ? {
            command: 'projectTree.openNode',
            title: 'Open node on editor',
            arguments: [element],
          }
        : void 0,
    };
  }
  getChildren(element?: ProjectTreeNode): vscode.ProviderResult<ProjectTreeNode[]> {
    return this.client
      .sendRequest<ProjectTreeNodeBranch>('clojure/workspace/projectTree/nodes', element)
      .then((node) => node?.nodes);
  }

  provideTextDocumentContent(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    return vscode.workspace.fs.readFile(uri).then((content) => content.toString());
  }
}

export class ProjectTreeExplorer {
  constructor(client: vscode_lsp.LanguageClient) {
    const treeDataProvider = new ProjectTreeDataProvider(client);

    vscode.window.createTreeView('projectTree', {
      treeDataProvider: treeDataProvider,
    });

    vscode.commands.registerCommand('projectTree.openNode', this._navigateToNode);
  }

  private _navigateToNode(element: ProjectTreeNode) {
    void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(element.uri)).then(() => {
      if ('range' in element && element.range) {
        if (vscode.window.activeTextEditor) {
          const newPos = new vscode.Position(
            element.range.start.line,
            element.range.start.character
          );
          vscode.window.activeTextEditor.selections = [new vscode.Selection(newPos, newPos)];
          void vscode.commands.executeCommand('revealLine', {
            lineNumber: element.range.start.line,
            at: 'center',
          });
        }
      }
    });
  }
}
