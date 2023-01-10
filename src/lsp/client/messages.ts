import * as vscode_lsp from 'vscode-languageclient/node';
import * as vscode from 'vscode';

// A quickPick that expects the same input as showInformationMessage does
// TODO: How do we make it satisfy the messageFunc interface?
function quickPick(message: string, actions: { title: string }[]): Promise<{ title: string }> {
  const qp = vscode.window.createQuickPick();
  qp.items = actions.map((item) => ({ label: item.title }));
  qp.title = message;
  return new Promise<{ title: string }>((resolve, _reject) => {
    qp.show();
    qp.onDidAccept(() => {
      if (qp.selectedItems.length > 0) {
        resolve({
          title: qp.selectedItems[0].label,
        });
      } else {
        resolve(undefined);
      }
      qp.hide();
    });
    qp.onDidHide(() => {
      resolve(undefined);
      qp.hide();
    });
  });
}

export function handleShowMessageRequest(params) {
  // showInformationMessage can't handle some of the menus that clojure-lsp uses
  // https://github.com/BetterThanTomorrow/calva/issues/1539
  // We count the sum of the lengths of the button titles and
  // use a QuickPick menu when it exceeds some number
  const totalActionsLength = params.actions.reduce(
    (length: number, action: vscode.MessageItem) => (length += action.title.length),
    0
  );
  if (params.type === vscode_lsp.MessageType.Info && totalActionsLength > 25) {
    return quickPick(params.message, params.actions);
  }
  // Else we use this, copied from the default client
  // TODO: Can we reuse the default clients implementation?
  let messageFunc: <T extends vscode.MessageItem>(message: string, ...items: T[]) => Thenable<T>;
  switch (params.type) {
    case vscode_lsp.MessageType.Error:
      messageFunc = vscode.window.showErrorMessage;
      break;
    case vscode_lsp.MessageType.Warning:
      messageFunc = vscode.window.showWarningMessage;
      break;
    case vscode_lsp.MessageType.Info:
      messageFunc = vscode.window.showInformationMessage;
      break;
    default:
      messageFunc = vscode.window.showInformationMessage;
  }
  const actions = params.actions || [];
  return messageFunc(params.message, ...actions);
}
