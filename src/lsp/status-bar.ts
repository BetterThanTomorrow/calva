import * as definitions from './definitions';
import * as vscode from 'vscode';

export const updateStatusBar = (item: vscode.StatusBarItem, status: definitions.LspStatus) => {
  switch (status) {
    case definitions.LspStatus.Stopped: {
      item.text = '$(circle-outline) clojure-lsp';
      item.tooltip = 'Clojure-lsp is not active, click to get a menu';
      break;
    }
    case definitions.LspStatus.Starting: {
      item.text = '$(sync~spin) clojure-lsp';
      item.tooltip = 'Clojure-lsp is starting';
      break;
    }
    case definitions.LspStatus.Running: {
      item.text = '$(circle-filled) clojure-lsp';
      item.tooltip = 'Clojure-lsp is active';
      break;
    }
    case definitions.LspStatus.Failed: {
      item.text = '$(error) clojure-lsp';
      item.tooltip = 'Clojure-lsp failed to start';
      break;
    }
    case definitions.LspStatus.Unknown: {
      item.text = 'clojure-lsp';
      item.tooltip = 'Open a clojure file to see the server status';
      break;
    }
  }
};
