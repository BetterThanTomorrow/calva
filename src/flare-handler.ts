import * as vscode from 'vscode';
import * as webview from './webview';
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
    webview.show(request);
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
