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
    case definitions.LspStatus.DownloadFailed: {
      item.text = '$(cloud-download) clojure-lsp';
      item.tooltip = 'clojure-lsp: download failed — click to manage';
      break;
    }
    case definitions.LspStatus.Unknown: {
      item.text = 'clojure-lsp';
      item.tooltip = 'Open a clojure file to see the server status';
      break;
    }
  }
};

type StatusInput = {
  statuses: definitions.LspStatus[];
  downloadFailed: boolean;
  currentFileIsClojure: boolean;
  currentFileClientStatus: definitions.LspStatus | undefined;
};

/**
 * Returns the status to show for the clients with `statuses`: the status of the current file's
 * client, Stopped without one. When the current file isn't a Clojure file, the status of the only
 * client, Unknown with several or none. Starting while a client starts, and DownloadFailed when
 * the download failed and there are no clients.
 */
export const statusFor = ({
  statuses,
  downloadFailed,
  currentFileIsClojure,
  currentFileClientStatus,
}: StatusInput): definitions.LspStatus => {
  if (statuses.includes(definitions.LspStatus.Starting)) {
    return definitions.LspStatus.Starting;
  }
  if (downloadFailed && statuses.length === 0) {
    return definitions.LspStatus.DownloadFailed;
  }
  if (!currentFileIsClojure) {
    return statuses.length === 1 ? statuses[0] : definitions.LspStatus.Unknown;
  }
  return currentFileClientStatus ?? definitions.LspStatus.Stopped;
};
