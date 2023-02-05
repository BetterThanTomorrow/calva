import repl from './repl';
import ranges from './ranges';
import calvaVsCode from './vscode';
import editor from './editor';
import pprint from './pprint';

export function getApi() {
  return {
    // If we can avoid it we don't want to ever break our callers.
    // This first version of the API is a draft though, so signaling
    // potential removal of this version of the API with the `0`.
    v0: {
      evaluateCode: repl.evaluateCode, // backward compatible
      repl,
      ranges,
      vscode: calvaVsCode,
      editor,
      pprint,
    },
  };
}
