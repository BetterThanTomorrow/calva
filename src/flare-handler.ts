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
  'sidebar-panel?'?: boolean;
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
      console.log('Inspecting EDN:', edn);
      // decompose the flare into the tag and the literal
      const match = edn.match(/^#(?:flare|cursive)\/(\w+)\s*(\{.*})\s*$/s);
      if (match) {
        const tag = match[1];
        const flare = parseEdn(match[2]);
        console.log('Parsed flare:', { tag, flare });
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
  retainContextWhenHidden: true,
};

interface CalvaWebPanel extends vscode.WebviewPanel {
  url?: string;
}

interface CalvaWebView extends vscode.WebviewView {
  url?: string;
}

// keep track of open webviews that have a key
// so that they can be updated in the future
const calvaWebPanels: Record<string, CalvaWebPanel> = {};
const calvaSidebarWebViews: Record<string, CalvaWebView> = {};

// WebView provider for sidebar
class CalvaFlareWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'calva.flare';
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(private readonly context: vscode.ExtensionContext) {
    this._context = context;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
  }

  public updateContent(html: string, title?: string, key?: string) {
    console.log('updateContent called with:', {
      html: html?.substring(0, 100),
      title,
      key,
      hasView: !!this._view,
    });
    if (this._view) {
      this._view.webview.html = html;
      if (title) {
        this._view.title = title;
      }
      if (key) {
        (this._view as CalvaWebView).url = key; // Store key in url field for tracking
        calvaSidebarWebViews[key] = this._view as CalvaWebView;
      }
      console.log('Content updated successfully');
    } else {
      console.log('ERROR: No webview available for content update');
    }
  }

  public updateUrl(url: string, title?: string, key?: string) {
    if (this._view) {
      this._view.webview.html = urlInIframe(url);
      if (title) {
        this._view.title = title;
      }
      if (key) {
        (this._view as CalvaWebView).url = url;
        calvaSidebarWebViews[key] = this._view as CalvaWebView;
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calva Flare</title>
</head>
<body>
    <p>Flare content will appear here</p>
</body>
</html>`;
  }
}

let flareWebviewProvider: CalvaFlareWebviewProvider | null = null;

export function registerFlareWebviewProvider(context: vscode.ExtensionContext) {
  flareWebviewProvider = new CalvaFlareWebviewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CalvaFlareWebviewProvider.viewType,
      flareWebviewProvider
    )
  );
}

function showWebView({
  title = 'WebView',
  key,
  html,
  url,
  reload = false,
  reveal = true,
  column = vscode.ViewColumn.Beside,
  opts = defaultWebviewOptions,
  'sidebar-panel?': sidebarPanel = false,
}: {
  title?: string;
  key?: string;
  html?: string;
  url?: string;
  reload?: boolean;
  reveal?: boolean;
  column?: vscode.ViewColumn;
  opts?: typeof defaultWebviewOptions;
  'sidebar-panel?'?: boolean;
}): void {
  // Debug logging
  console.log('showWebView called with:', {
    title,
    key,
    html: html?.substring(0, 100),
    url,
    sidebarPanel,
  });

  if (sidebarPanel) {
    console.log('Using sidebar panel, flareWebviewProvider:', !!flareWebviewProvider);
    // Handle sidebar webview
    if (flareWebviewProvider) {
      if (html) {
        console.log('Updating sidebar content with HTML:', html.substring(0, 100));
        flareWebviewProvider.updateContent(html, title, key);
      } else if (url) {
        console.log('Updating sidebar content with URL:', url);
        flareWebviewProvider.updateUrl(url, title, key);
      }

      if (reveal) {
        // Focus the Calva view container to show the sidebar
        void vscode.commands.executeCommand('calva.flare.focus');
      }
    } else {
      console.log('ERROR: flareWebviewProvider is null');
      void vscode.window.showErrorMessage(
        'Sidebar flare webview not available. Please restart VS Code.'
      );
    }
    return;
  }

  console.log('Using regular panel');
  // Handle regular webview panel (existing logic)
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
