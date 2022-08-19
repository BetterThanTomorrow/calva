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
  const topLevelRanges = cursor.rangesForTopLevelForms().flat();

  if (topLevelRanges.length) {
    topLevelRanges[0] = 0;
  }

  // grab only the ends of ranges, so we can include all of the file in the notebook
  const fullRanges = _.filter(topLevelRanges, (_, index) => {
    return index % 2 !== 0;
  });

  // last range should include end of file
  fullRanges[fullRanges.length - 1] = content.length;

  // start of file to end of top level sexp pairs
  const allRanges = _.zip(_.dropRight([_.first(topLevelRanges), ...fullRanges], 1), fullRanges);

  const ranges = allRanges.flatMap(([start, end]) => {
    const endForm = cursor.doc.getTokenCursor(end - 1);
    const afterForm = cursor.doc.getTokenCursor(end);

    if (endForm.getFunctionName() === 'comment') {
      const commentRange = afterForm.rangeForCurrentForm(0);
      const commentStartCursor = cursor.doc.getTokenCursor(commentRange[0]);
      const commentCells = [];
      let count = 0;

      commentStartCursor.downList();
      commentStartCursor.forwardSexp();

      while (commentStartCursor.forwardSexp()) {
        commentCells.push({
          value: substring(
            content,
            commentStartCursor.rangeForDefun(commentStartCursor.offsetStart)
          ),
          kind: vscode.NotebookCellKind.Code,
          languageId: 'clojure',
          metadata: {
            richComment: { index: count },
          },
        });
        count++;
      }
      commentCells.forEach((x) => (x.metadata.richComment.count = count));

      return commentCells;
    }
    return {
      value: content.substring(start, end),
      kind: vscode.NotebookCellKind.Code,
      languageId: 'clojure',
    };
  });

  return ranges;
}

function writeCellsToClojure(cells: vscode.NotebookCellData[]) {
  return cells.reduce((acc, x) => {
    if (x.kind === vscode.NotebookCellKind.Code) {
      let result: string = x.value;
      if (x.metadata?.richComment) {
        if (x.metadata.richComment.index === 0) {
          result = '\n(comment\n'.concat(result);
        }

        if (x.metadata.richComment.index === x.metadata.richComment.count - 1) {
          result = result.concat(')');
        } else {
          result = result.concat('\n');
        }
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
