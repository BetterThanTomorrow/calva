import * as vscode from 'vscode';
import { TextDecoder, TextEncoder } from 'util';
import { prettyPrint } from '../out/cljs-lib/cljs-lib';
import * as tokenCursor from './cursor-doc/token-cursor';
import * as repl from './api/repl';
import _ = require('lodash');
import { isInteger } from 'lodash';

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

function substring(content: string, [start, end]) {
  if (isInteger(start) && isInteger(end)) {
    return content.substring(start, end);
  }
  return '';
}

function parseClojure(content: string): vscode.NotebookCellData[] {
  const cursor = tokenCursor.createStringCursor(content);
  let offset = 0;
  let cells = [];

  while (cursor.forwardSexp()) {
    const start = offset;
    const end = cursor.offsetStart;
    offset = end;

    const endForm = cursor.doc.getTokenCursor(end - 1);
    const afterForm = cursor.doc.getTokenCursor(end);

    if (endForm.getFunctionName() === 'comment') {
      const commentRange = afterForm.rangeForCurrentForm(0);
      const commentStartCursor = cursor.doc.getTokenCursor(commentRange[0]);
      const commentCells = [];
      let previouseEnd = start;

      commentStartCursor.downList();
      commentStartCursor.forwardSexp();

      while (commentStartCursor.forwardSexp()) {
        const range = commentStartCursor.rangeForDefun(commentStartCursor.offsetStart);

        let leading = '';
        const indent = commentStartCursor.doc.getRowCol(range[0])[1]; // will break with tabs?

        leading = content.substring(previouseEnd, range[0]);
        previouseEnd = range[1];

        commentCells.push({
          value: substring(content, range),
          kind: vscode.NotebookCellKind.Code,
          languageId: 'clojure',
          metadata: {
            leading: leading,
            indent,
            range,
            richComment: true,
            trailing: '',
          },
        });
      }

      _.last(commentCells).metadata.trailing = content.substring(previouseEnd, end);

      cells = cells.concat(commentCells);

      continue;
    }

    const range = cursor.rangeForDefun(cursor.offsetStart);

    const leading = content.substring(start, range[0]);

    if (leading.indexOf(';; ') === -1) {
      cells.push({
        value: leading,
        kind: vscode.NotebookCellKind.Markup,
        languageId: 'markdown',
        metadata: {
          indent: 0,
          range,
          leading: '',
          trailing: '',
        },
      });
    } else {
      cells.push({
        value: leading.replace(/;; /g, ''),
        kind: vscode.NotebookCellKind.Markup,
        languageId: 'markdown',
        metadata: {
          indent: 0,
          range,
          markdownComment: true,
          leading: '',
          trailing: '',
        },
      });
    }

    cells.push({
      value: substring(content, range),
      kind: vscode.NotebookCellKind.Code,
      languageId: 'clojure',
      metadata: {
        indent: 0,
        range,
        leading: '',
        trailing: '',
      },
    });
  }

  _.last(cells).metadata.trailing = content.substring(
    _.last(cells).metadata.range[1],
    content.length
  );

  console.log(cells);

  return cells;
}

function writeCellsToClojure(cells: vscode.NotebookCellData[]) {
  return cells.reduce((acc, x, index) => {
    if (x.kind === vscode.NotebookCellKind.Code) {
      let result = '';

      // created inside the notebook
      if (undefined === x.metadata.leading) {
        const indent = index > 0 ? _.repeat(' ', cells[index - 1].metadata.indent) : '';

        result = '\n\n' + indent + x.value;
      } else {
        result = x.metadata.leading + x.value + x.metadata.trailing;
      }

      return acc.concat(result);
    } else {
      if (x.metadata.markdownComment) {
        let result = x.value.replace(/\n(?!$)/g, '\n;; ');
        if (index === 0) {
          result = ';; ' + result;
        }
        return acc.concat(result);
      }
      return acc.concat(x.value);
    }
  }, '');
}

export class NotebookKernel {
  readonly id: string = 'calva-book-kernel';
  readonly notebookType: string = 'calva-clojure-notebook';
  readonly label: string = 'Clojure Notebook';
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
