import * as vscode from 'vscode';
import { parseEdn } from '../out/cljs-lib/cljs-lib';

type EvaluateFunction = (code: string) => Promise<string | null>;

type MessageRequest = {
  type: 'info' | 'warn' | 'error';
  message: string;
  items?: string[];
  then?: string;
};
type WebviewRequest = {
  title?: string;
  html?: string;
  url?: string;
  key?: string;
  column?: vscode.ViewColumn;
  opts?: any;
  then?: string;
};

type ActRequest = MessageRequest | WebviewRequest;

const actHandlers: Record<string, (request: ActRequest, EvaluateFunction) => void> = {
  message: ({ type, message, items = [], then }: MessageRequest, evaluate: EvaluateFunction) => {
    const messageHandlers = {
      info: vscode.window.showInformationMessage,
      warn: vscode.window.showWarningMessage,
      error: vscode.window.showErrorMessage,
    };
    const handler = messageHandlers[type] || messageHandlers.info;
    const p = handler(message, ...items);
    if (then) {
      void p.then((x: any) =>
        evaluate(`((resolve '${then}) ${JSON.stringify(x)})`).catch((e) => {
          void vscode.window.showErrorMessage('Failed callback ${then}: ' + e);
        })
      );
    }
  },
  html: ({ then, ...request }: WebviewRequest, evaluate: EvaluateFunction) => {
    showWebView(request);
  },
};

export function inspect(edn: string, evaluate: EvaluateFunction): any {
  if (
    edn &&
    typeof edn === 'string' &&
    (edn.startsWith('#flare/') || edn.startsWith('#cursive/'))
  ) {
    try {
      // decompose the flare into the tag and the literal
      const match = edn.match(/^#(?:flare|cursive)\/(\w+)\s*(\{.*}$)/);
      if (match) {
        const tag = match[1];
        const flare = parseEdn(match[2]);
        const handler = actHandlers[tag];
        if (handler) {
          handler(flare, evaluate);
        } else {
          void vscode.window.showErrorMessage(`Unknown flare tag: ${JSON.stringify(tag)}`);
        }
      }
    } catch (e) {
      console.log('ERROR: inspect failed', e);
    }
  }
}

// Webview below here (doesn't build when in another file)

const defaultOpts = {
  enableScripts: true,
};

// keep track of open webviews that have a key,
// so that they can be updated
const webviewRegistry: Record<string, vscode.WebviewPanel> = {};

function setHtml(panel: vscode.WebviewPanel, title: string, html: string): vscode.WebviewPanel {
  if (panel.title !== title) {
    panel.title = title;
  }
  if (panel.webview.html !== html) {
    panel.webview.html = html;
  }
  panel.reveal();
  return panel;
}

function urlInIframe(uri: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style type="text/css">
  body, html {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
  }
  #content {
    position: absolute; left: 0; right: 0; bottom: 0; top: 0px;
  }
</style>
</head>
<body>
  <iframe src="${uri}" style="width:100%; height:100%; border:none;"></iframe>
</body>
</html>`;
}

function showWebView({
  title = 'Webview',
  html,
  url,
  key,
  column = vscode.ViewColumn.Beside,
  opts = defaultOpts,
}: {
  title?: string;
  html?: string;
  url?: string;
  key?: string;
  column?: vscode.ViewColumn;
  opts?: typeof defaultOpts;
}): vscode.WebviewPanel {
  const finalHtml = url ? urlInIframe(url) : html || '';
  if (key) {
    const existingPanel = webviewRegistry[key];
    if (existingPanel) {
      return setHtml(existingPanel, title, finalHtml);
    }
  }

  const panel = vscode.window.createWebviewPanel('calva-webview', title, column, opts);
  setHtml(panel, title, finalHtml);

  if (key) {
    webviewRegistry[key] = panel;
    panel.onDidDispose(() => delete webviewRegistry[key]);
  }

  return panel;
}
