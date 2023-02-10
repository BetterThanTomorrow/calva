import { LspStatus } from './definitions';
import * as vscode from 'vscode';

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
