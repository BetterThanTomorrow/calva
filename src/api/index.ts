import * as replV0 from './repl-v0';
import * as replV1 from './repl-v1';
import * as ranges from './ranges';
import * as calvaVsCode from './vscode';
import * as editor from './editor';
import * as document from './document';
import * as pprint from './pprint';

export function getApi() {
  return {
    v0: {
      evaluateCode: replV0.evaluateCode, // old mistake
      repl: replV0,
      ranges,
      vscode: calvaVsCode,
      editor,
      pprint,
    },
    v1: {
      repl: replV1,
      ranges,
      vscode: calvaVsCode,
      editor,
      document,
      pprint,
    },
  };
}
