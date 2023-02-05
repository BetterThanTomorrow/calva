import vscode_lsp from 'vscode-languageclient/node';
import vscode from 'vscode';

export enum LspStatus {
  Stopped = 'Stopped',
  Starting = 'Starting',
  Running = 'Running',
  Failed = 'Failed',
  Unknown = 'Unknown',
}

export const lspClientStateToStatus = (state: vscode_lsp.State): LspStatus => {
  switch (state) {
    case vscode_lsp.State.Stopped: {
      return LspStatus.Stopped;
    }
    case vscode_lsp.State.Starting: {
      return LspStatus.Starting;
    }
    case vscode_lsp.State.Running: {
      return LspStatus.Running;
    }
  }
};

export const updateStatusBar = (item: vscode.StatusBarItem, status: LspStatus) => {
  switch (status) {
    case LspStatus.Stopped: {
      item.text = '$(circle-outline) clojure-lsp';
      item.tooltip = 'Clojure-lsp is not active, click to get a menu';
      break;
    }
    case LspStatus.Starting: {
      item.text = '$(sync~spin) clojure-lsp';
      item.tooltip = 'Clojure-lsp is starting';
      break;
    }
    case LspStatus.Running: {
      item.text = '$(circle-filled) clojure-lsp';
      item.tooltip = 'Clojure-lsp is active';
      break;
    }
    case LspStatus.Failed: {
      item.text = '$(error) clojure-lsp';
      item.tooltip = 'Clojure-lsp failed to start';
      break;
    }
    case LspStatus.Unknown: {
      item.text = 'clojure-lsp';
      item.tooltip = 'Open a clojure file to see the server status';
      break;
    }
  }
};
