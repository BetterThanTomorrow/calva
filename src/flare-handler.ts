import * as vscode from 'vscode';
import { parseEdn } from '../out/cljs-lib/cljs-lib';

type EvaluateFunction = (code: string) => Promise<string | null>;

type WebviewRequest = {
  title?: string;
  html?: string;
  url?: string;
  key?: string;
  column?: vscode.ViewColumn;
  opts?: any;
  then?: string;
};

type ActRequest = WebviewRequest;

const actHandlers: Record<string, (request: ActRequest, EvaluateFunction) => void> = {
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

const defaultWebviewOptions = {
  enableScripts: true,
};

interface CalvaWebPanel extends vscode.WebviewPanel {
  url?: string;
}

// keep track of open webviews that have a key
// so that they can be updated in the future
const calvaWebPanels: Record<string, CalvaWebPanel> = {};

function showWebView({
  title = 'WebView',
  key,
  html,
  url,
  reload = false,
  reveal = true,
  column = vscode.ViewColumn.Beside,
  opts = defaultWebviewOptions,
}: {
  title?: string;
  key?: string;
  html?: string;
  url?: string;
  reload?: boolean;
  reveal?: boolean;
  column?: vscode.ViewColumn;
  opts?: typeof defaultWebviewOptions;
}): void {
  let panel: CalvaWebPanel;
  if (key) {
    panel = calvaWebPanels[key];
  }
  if (!panel) {
    panel = vscode.window.createWebviewPanel('calva-webview', title, column, opts);
    if (key) {
      calvaWebPanels[key] = panel;
      panel.onDidDispose(() => delete calvaWebPanels[key]);
    }
  }

  if (html && panel.webview.html != html) {
    panel.webview.html = html;
  }

  if (url && (url != panel.url || reload)) {
    panel.url = url;
    panel.webview.html = urlInIframe(url);
  }

  if (panel.title !== title) {
    panel.title = title;
  }

  if (reveal) {
    panel.reveal();
  }
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
