import * as vscode from "vscode";
import { WebviewPanel } from "vscode";
import * as markdownit from "markdown-it";

type InfoPanelState =
  | {
      panel: WebviewPanel;
      content: vscode.MarkdownString | undefined;
      locked: boolean;
    }
  | undefined;

type InfoPanelEvent =
  | { type: "Initialise" }
  | { type: "UpdateContent"; content: vscode.MarkdownString }
  | { type: "ToggleLock" };

// TODO: Think about where this belongs. Singleton might not be so great.
let infoPanel = undefined as InfoPanelState;

const initialiseInfoPanel = () => {
  const panel = vscode.window.createWebviewPanel(
    "info-panel",
    "Info Panel",
    vscode.ViewColumn.Beside
  );

  return { panel, content: undefined, locked: false };
};

const infoPanelTitle = "Calva Info Panel";
const formatHtmlDocument = (body: string) =>
  `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${infoPanelTitle}</title>
    </head>
    <body style="word-wrap: break-word">
    ${body}
    </body>
    </html>`;

const updateInfoPanelContent = (
  content: vscode.MarkdownString,
  infoPanel: InfoPanelState
) => {
  if (infoPanel.panel.visible && !infoPanel.locked) {
    const bodyHtml = markdownit().render(content.value);
    infoPanel.panel.webview.html = formatHtmlDocument(bodyHtml);
  }
};

const toggleInfoPanelLock = (infoPanel: InfoPanelState) => {
  infoPanel.locked = !infoPanel.locked;
};

export const updateInfoPanel = (event: InfoPanelEvent): void => {
  switch (event.type) {
    case "Initialise":
      if (!infoPanel) {
        infoPanel = initialiseInfoPanel();
      }
      break;
    case "UpdateContent":
      if (infoPanel) {
        updateInfoPanelContent(event.content, infoPanel);
      }
      break;
    case "ToggleLock":
      if (infoPanel) {
        toggleInfoPanelLock(infoPanel);
      }
  }
};
