import * as vscode from 'vscode';
import { TextDecoder, TextEncoder } from 'util';
import { prettyPrint } from '../out/cljs-lib/cljs-lib';
import * as tokenCursor from './cursor-doc/token-cursor';
import * as repl from './api/repl-v1';
import _ = require('lodash');
import { isInteger } from 'lodash';
import { getNamespace } from './api/document';

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
  const topLevelRanges = cursor.rangesForTopLevelForms().flat();

  if (topLevelRanges.length) {
    topLevelRanges[0] = 0;
  }

  // grab only the ends of ranges, so we can include all of the file in the notebook
  const fullRanges = _.filter(topLevelRanges, (_, index) => {
    return index % 2 !== 0;
  });

  const lastRangeAdjustment = content.length - fullRanges[fullRanges.length - 1];
  // last range should include end of file
  fullRanges[fullRanges.length - 1] = content.length;

  // start of file to end of top level sexp pairs
  const allRanges = _.zip(_.dropRight([_.first(topLevelRanges), ...fullRanges], 1), fullRanges);

  const ranges = allRanges.flatMap(([start, end], index) => {
    const endAdjustment = index + 1 === allRanges.length ? lastRangeAdjustment + 1 : 1;
    const endForm = cursor.doc.getTokenCursor(end - endAdjustment);
    const afterForm = cursor.doc.getTokenCursor(end);

    if (endForm.getFunctionName() === 'comment') {
      const commentRange = afterForm.rangeForCurrentForm(0);
      const commentStartCursor = cursor.doc.getTokenCursor(commentRange[0]);
      const commentCells = [];
      let previouseEnd = start;

      commentStartCursor.downList();
      commentStartCursor.forwardSexp();
      commentStartCursor.forwardSexp(true, true);

      do {
        const range = commentStartCursor.rangeForDefun(commentStartCursor.offsetStart);
        const commentCellCursor = cursor.doc.getTokenCursor(range[0]);
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
      } while (commentStartCursor.forwardSexp(true, true));

      if (commentCells.length) {
        _.last(commentCells).metadata.trailing = content.substring(previouseEnd, end);
      }

      return commentCells;
    }

    return {
      value: content.substring(start, end),
      kind: vscode.NotebookCellKind.Code,
      languageId: 'clojure',
      metadata: {
        indent: 0,
        leading: '',
        trailing: '',
      },
    };
  });

  return ranges;
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

// TODO: Why is this called also when executing a single cell?
async function executeAll(
  cells: vscode.NotebookCell[],
  _notebook: vscode.NotebookDocument,
  controller: vscode.NotebookController
) {
  for (const cell of cells) {
    if (cell.metadata?.richComment && cells.length > 1) {
      continue;
    }
    await doExecution(cell, controller);
  }
}

async function doExecution(
  cell: vscode.NotebookCell,
  controller: vscode.NotebookController
): Promise<void> {
  const firstCell = cell.notebook.getCells()[0];
  const ns = cell !== firstCell ? getNamespace(firstCell.document) : undefined;
  const execution = controller.createNotebookCellExecution(cell);
  execution.start(Date.now());

  try {
    const response = (
      await repl.evaluateCode(
        undefined,
        cell.document.getText(),
        ns,
        {
          stdout: (_) => {
            return;
          },
          stderr: (_) => {
            return;
          },
        },
        {
          'nrepl.middleware.print/print': 'nrepl.util.print/pr',
          'nrepl.middleware.print/options': { 'print-meta': true },
          'nrepl.middleware.eval/env': { 'calva-notebook': true, notebook: true },
        }
      )
    ).result;
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
