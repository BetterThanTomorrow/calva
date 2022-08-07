import * as vscode from 'vscode';
import { TextDecoder, TextEncoder } from 'util';
import { prettyPrint } from '../out/cljs-lib/cljs-lib';
import * as tokenCursor from './cursor-doc/token-cursor';
import * as repl from './api/repl';

export class NotebookProvider implements vscode.NotebookSerializer {
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();

  deserializeNotebook(
    data: Uint8Array,
    _token: vscode.CancellationToken
  ): vscode.NotebookData | Thenable<vscode.NotebookData> {
    const content = this.decoder.decode(data);
    const cellRawData = parseClojure(content);

    return {
      cells: cellRawData,
    };
  }

  serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Uint8Array | Thenable<Uint8Array> {
    const stringOutput = writeCellsToClojure(data.cells);
    return this.encoder.encode(stringOutput);
  }
}

function parseClojure(content: string): vscode.NotebookCellData[] {
  const cursor = tokenCursor.createStringCursor(content);

  const ranges = cursor.rangesForTopLevelForms().map(([start, end]) => {
    return {
      value: content.substring(start, end),
      kind: vscode.NotebookCellKind.Code,
      languageId: 'clojure',
    };
  });
  console.log(ranges);
  return ranges;
}

function writeCellsToClojure(cells: vscode.NotebookCellData[]) {
  return cells.map((x) => x.value).join('\n\n');
}

export class NotebookKernel {
  readonly id: string = 'calva-book-kernel';
  readonly notebookType: string = 'calva-notebook';
  readonly label: string = 'Calva Notebook';
  readonly supportedLanguages = ['clojure'];

  private readonly _controller: vscode.NotebookController;

  constructor() {
    this._controller = vscode.notebooks.createNotebookController(
      this.id,
      this.notebookType,
      this.label,
      executeAll
    );

    this._controller.supportedLanguages = this.supportedLanguages;
  }

  dispose(): void {
    this._controller.dispose();
  }
}

async function executeAll(
  cells: vscode.NotebookCell[],
  _notebook: vscode.NotebookDocument,
  controller: vscode.NotebookController
) {
  for (const cell of cells) {
    await doExecution(cell, controller);
  }
}

async function doExecution(
  cell: vscode.NotebookCell,
  controller: vscode.NotebookController
): Promise<void> {
  const execution = controller.createNotebookCellExecution(cell);
  execution.start(Date.now());

  try {
    const response = (await repl.evaluateCode(undefined, cell.document.getText())).result;
    const pretty = prettyPrint(response).value;
    const output = [
      vscode.NotebookCellOutputItem.text(response),
      vscode.NotebookCellOutputItem.text('```clojure\n' + pretty + '\n```', 'text/markdown'),
      vscode.NotebookCellOutputItem.text(response, 'x-application/edn'),
    ];

    if (response.replace(/^"|"$/g, '').startsWith('<html')) {
      output.push(vscode.NotebookCellOutputItem.text(response.replace(/^"|"$/g, ''), 'text/html'));
    }

    await execution.replaceOutput([new vscode.NotebookCellOutput(output)]);

    execution.end(true, Date.now());
  } catch (err) {
    await execution.replaceOutput([
      new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.error({
          name: (err instanceof Error && err.name) || 'error',
          message: (err instanceof Error && err.message) || JSON.stringify(err, undefined, 4),
        }),
      ]),
    ]);
    execution.end(false, Date.now());
  }
}
