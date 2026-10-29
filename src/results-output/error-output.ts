import { randomUUID } from 'crypto';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import * as cider from '../nrepl/cider';
import * as outputWindow from '../repl-window/repl-window-doc';
import * as util from '../utilities';
import type { AfterAppendCallback } from './output';

// The append options the Output views get, and that the error's causes travel in
type ErrorOptions = { destination: string; causes?: cider.Causes; [key: string]: unknown };

const webviewErrors = {
  'output-view': {
    append: cljsLib.appendErrorToReplOutputWebview,
    attach: cljsLib.attachCausesToReplOutputWebview,
  },
  'output-sidebar': {
    append: cljsLib.appendErrorToReplOutputSidebar,
    attach: cljsLib.attachCausesToReplOutputSidebar,
  },
};

// The Output views show an error's text right away, and draw its causes when they arrive
export function writeErrorToWebview(
  options: ErrorOptions,
  message: string,
  after?: AfterAppendCallback
) {
  const text = util.stripAnsi(message).replace(/^\n+|\n+$/g, '');
  const errorId = randomUUID();
  const { append, attach } = webviewErrors[options.destination];
  const knownCauses = Array.isArray(options.causes) ? options.causes : undefined;
  append(options, text, knownCauses, errorId);
  if (!knownCauses) {
    cider.withCauses(options.causes, (causes) => attach(errorId, causes));
  }
  after?.(undefined, undefined);
}

// The REPL window keeps the outermost cause's frames for the "Print stacktrace" link after the error
export function withStacktraceLink(
  causes: cider.Causes | undefined,
  after?: AfterAppendCallback
): AfterAppendCallback | undefined {
  if (causes === undefined) {
    return after;
  }
  return (location, afterLocation) => {
    cider.withCauses(causes, (causes) => {
      const frames = cider.outermostCauseFrames(causes);
      if (frames?.length > 0) {
        outputWindow.saveStacktrace(frames);
        outputWindow.markLastStacktraceRange(afterLocation);
      }
    });
    return after?.(location, afterLocation);
  };
}
