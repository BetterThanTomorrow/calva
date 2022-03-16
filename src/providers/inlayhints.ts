import * as vscode from 'vscode';


let THE_RESULTS = {};

function newHint(position, replResults: string) {
   let lines = replResults.split(/\r?\n/);
   let label = new vscode.InlayHintLabelPart(lines[0])
   // the tooltip doesn't show
   label.tooltip = replResults;
   // .location implies that the hover will be related to the
   // an actual symbol at the location, so I think
   // this approach won't work for REPL results
   label.location = position;
   //  la
  //  label.command = {
  //    title: "Go to output window",
  //    command: "calva.showOutputWindow"
  //  };
   let copyLabel = new vscode.InlayHintLabelPart("(copy)")
   // this doesn't appear to be executing
   copyLabel.command = {
     title: "Copy to Clipboard",
     command: "calva.copyLastResults"};
   let space = new vscode.InlayHintLabelPart(" ");
   let hint = new vscode.InlayHint(position,
     [label, space, copyLabel],
     vscode.InlayHintKind.Parameter
    );
   return hint;
}

export class InlayHintsProvider  implements vscode.InlayHintsProvider<vscode.InlayHint> {
  //private readonly _onDidChangeInlayHints = new vscode.EventEmitter<void>();
  public readonly emitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeInlayHints = this.emitter.event;
  provideInlayHints(document, hintRange: vscode.Range, token) {
    let docResults = THE_RESULTS[document.uri.toString()] || [];
    let hints = [];
    for (let {range, value} of docResults) {
      if (hintRange.contains(range.end)) {
        hints.push(newHint(range.end, value.toString()));
      }
    }
    return hints;
  }


}

export var TheInlayHintsProvider = new InlayHintsProvider();


export function registerResult(editor: vscode.TextEditor, document: vscode.TextDocument, range: vscode.Range, value: any) {
  let k = document.uri.toString();
  let docResults = THE_RESULTS[k] || [];
  THE_RESULTS[k] = docResults;
  docResults.push({range: range, value: value});
  let firstLine = document.lineAt(0);
  let lastLine = document.lineAt(document.lineCount - 1);
  let textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
  // show hints immediately
  TheInlayHintsProvider.emitter.fire();
  // try to show hints even more immediately (doesn't seem to have an effect)
  vscode.commands.executeCommand(
    "vscode.executeInlayHintProvider", document.uri,
    textRange);

  // editor.edit((editBuilder) => {
  // }, {undoStopAfter: false, undoStopBefore: false}
  // );
  console.log("REGISTERED RESULT", document.uri.toString(), range.start, range.end, value);
}
