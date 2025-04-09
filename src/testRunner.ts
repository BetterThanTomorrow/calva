import * as vscode from 'vscode';
import * as util from './utilities';
import * as string from './util/string';
import * as outputWindow from './repl-window/repl-doc';
import { NReplSession } from './nrepl';
import * as cider from './nrepl/cider';
import * as lsp from './lsp/definitions';
import * as namespace from './namespace';
import { getSession, updateReplSessionType } from './nrepl/repl-session';
import * as getText from './util/get-text';
import * as output from './results-output/output';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('calva');

async function uriForFile(fileName: string): Promise<vscode.Uri> {
  if (fileName.startsWith('/')) {
    return vscode.Uri.file(fileName);
  }
  // Sometimes we don't get the full path for some reason. (This is a very inexact
  // way of dealing with that. Maybe check for the right `ns`in the file?)
  const uris = await vscode.workspace.findFiles('**/' + fileName, null, 1);
  return uris[0];
}

// Return a valid TestItem for the namespace.
// Creates a new item and adds it to the controller, replacing any existing item for the namespace.
// If a Range is supplied, that we set the range on the returned item.
function createCleanNamespaceItem(
  controller: vscode.TestController,
  uri: vscode.Uri,
  nsName: string,
  range?: vscode.Range
): vscode.TestItem {
  const ns = controller.createTestItem(nsName, nsName, uri);
  if (range) {
    ns.range = range;
  }
  controller.items.add(ns);
  return ns;
}

// Return a valid TestItem for the test var.
// Creates a new item if one does not exist, otherwise we find the existing entry.
// If a Range is supplied, that we set the range on the returned item.
function upsertTest(
  controller: vscode.TestController,
  uri: vscode.Uri,
  nsName: string,
  varName: string,
  range?: vscode.Range
): vscode.TestItem {
  const ns = controller.items.get(nsName);
  const testId = nsName + '/' + varName;
  let test = ns.children.get(testId);
  if (!test) {
    test = controller.createTestItem(testId, varName, uri);
  }
  if (range) {
    test.range = range;
  }
  ns.children.add(test);
  return test;
}

// Cider 0.26 and 0.27 have an issue where context can be an empty array.
// https://github.com/clojure-emacs/cider-nrepl/issues/728#issuecomment-996002988
export function assertionName(result: cider.TestResult): string {
  if (string.isNonEmptyString(result.context)) {
    return result.context;
  }
  return 'assertion';
}

function existingUriForNameSpace(
  controller: vscode.TestController,
  nsName: string
): vscode.Uri | undefined {
  return controller.items.get(nsName)?.uri;
}

async function onTestResult(
  controller: vscode.TestController,
  session: NReplSession,
  run: vscode.TestRun,
  nsName: string,
  varName: string,
  assertions: cider.TestResult[]
) {
  let uri = existingUriForNameSpace(controller, nsName);
  if (!uri) {
    uri = await namespace.getUriForNamespace(session, nsName);
  }
  if (!uri) {
    console.warn('Test Runner: Unable to find file corresponding to namespace: ' + nsName);
  }

  const test = upsertTest(controller, uri, nsName, varName);

  // The Clojure LSP gives a very accurate range for a test. In some cases, this
  // function will be called before Clojure LSP has analysed the file, so we might
  // have a test item with no range set. In this case, we can look at the line
  // data in the assertions collection and produce a good approximation of the
  // range. If the LSP subsequently scans the file, upsertTest will be called,
  // which will set the range correctly.
  if (!test.range || test.range.isEmpty) {
    const lines = assertions
      .filter(cider.hasLineNumber)
      .map((a) => a.line)
      .sort();

    if (lines.length > 0) {
      test.range = new vscode.Range(lines[0] - 1, 0, lines[lines.length - 1], 1000);
    }
  }

  // Clear any children, which are assertions left over from previous runs.
  test.children.replace([]);

  const failures = assertions.filter((result) => {
    return result.type != 'pass';
  });

  if (failures.length == 0) {
    run.passed(test);
    return;
  }

  failures.forEach((result) => {
    const assertionId = test.id + '/' + result.index;
    const assertion = controller.createTestItem(assertionId, assertionName(result), uri);
    test.children.add(assertion);

    if (cider.hasLineNumber(result)) {
      assertion.range = new vscode.Range(result.line - 1, 0, result.line - 1, 1000);
    }

    switch (result.type) {
      case 'error':
        run.errored(assertion, new vscode.TestMessage(cider.shortMessage(result)));
        break;
      case 'fail':
        run.failed(assertion, new vscode.TestMessage(cider.detailedMessage(result)));
        break;
      default:
        run.failed(assertion, new vscode.TestMessage(cider.shortMessage(result)));
        break;
    }
  });
}

async function onTestResults(
  controller: vscode.TestController,
  session: NReplSession,
  results: cider.TestResults[]
) {
  const run = controller.createTestRun(new vscode.TestRunRequest(), 'Clojure', false);
  for (const result of results) {
    for (const namespace in result.results) {
      const tests = result.results[namespace];
      for (const test in tests) {
        await onTestResult(controller, session, run, namespace, test, tests[test]);
      }
    }
  }
  run.end();
}

function useTestExplorer(): boolean | undefined {
  return vscode.workspace.getConfiguration('calva').get('useTestExplorer');
}

async function reportTests(
  controller: vscode.TestController,
  session: NReplSession,
  possibleResults: cider.TestResults[]
) {
  // Results can sometimes not be actual test results, such as when a namespace is not found: https://github.com/BetterThanTomorrow/calva/issues/1516.
  const results = possibleResults.filter((pr) => pr.results);
  const diagnostics: { [key: string]: vscode.Diagnostic[] } = {};
  diagnosticCollection.clear();

  const recordDiagnostic = (result: cider.TestResult) => {
    util.assertIsDefined(result.line, 'Expected cider test result to have a line!');

    util.assertIsDefined(result.file, 'Expected cider test result to have a file!');

    const msg = cider.diagnosticMessage(result);

    const err = new vscode.Diagnostic(
      new vscode.Range(result.line - 1, 0, result.line - 1, 1000),
      msg,
      vscode.DiagnosticSeverity.Error
    );
    if (!diagnostics[result.file]) {
      diagnostics[result.file] = [];
    }
    diagnostics[result.file].push(err);
  };

  if (useTestExplorer()) {
    void onTestResults(controller, session, results);
  }

  for (const result of results) {
    for (const ns in result.results) {
      const resultSet = result.results[ns];
      for (const test in resultSet) {
        for (const a of resultSet[test]) {
          const messages = cider.detailedMessage(a);

          if (a.type == 'error') {
            const stackTrace = await session.testStacktrace(ns, test, a.index);

            outputWindow.saveStacktrace(stackTrace.stacktrace);
            outputWindow.appendLine(messages, (_, afterResultLocation) => {
              outputWindow.markLastStacktraceRange(afterResultLocation);
            });
            if (output.getDestinationConfiguration().otherOutput !== 'repl-window') {
              output.appendLineOtherOut(messages);
            }
          } else if (messages) {
            output.appendLineOtherOut(messages);
          }

          if (a.type === 'fail') {
            recordDiagnostic(a);
          }
        }
      }
    }
  }

  const summary = cider.totalSummary(results.map((r) => r.summary));
  output.appendLineOtherOut(cider.summaryMessage(summary));

  if (!useTestExplorer()) {
    for (const fileName in diagnostics) {
      void uriForFile(fileName).then((uri) => {
        diagnosticCollection.set(uri, diagnostics[fileName]);
      });
    }
  }
}

// FIXME: use cljs session where necessary
async function runAllTests(controller: vscode.TestController, document = {}) {
  const session = getSession(util.getFileType(document));
  output.appendLineOtherOut('Running all project tests…');
  try {
    await reportTests(controller, session, [await session.testAll()]);
  } catch (e) {
    output.appendLineOtherErr(e);
  }
  updateReplSessionType();
  output.replWindowAppendPrompt();
}

function runAllTestsCommand(controller: vscode.TestController) {
  if (!util.getConnectedState()) {
    void vscode.window.showInformationMessage(
      'You must connect to a REPL server to run this command.'
    );
    return;
  }
  runAllTests(controller).catch((msg) => {
    void vscode.window.showWarningMessage(msg);
  });
}

async function loadTestNS() {
  const document = util.getActiveTextEditor().document;
  const session = getSession(util.getFileType(document));
  const doc = util.tryToGetDocument(document);

  const [ns, _] = namespace.getNamespace(
    doc,
    vscode.window.activeTextEditor?.selections[0]?.active
  );

  const testNS = !ns.endsWith('-test') ? ns + '-test' : ns;
  const nsPath = await session.nsPath(testNS);
  const testFilePath = nsPath.path;
  if (testFilePath && testFilePath !== '') {
    const filePath = vscode.Uri.parse(testFilePath).path;
    const loadForms = `(load-file "${filePath}")`;
    return session.eval(loadForms, testNS).value;
  }
}

async function runNamespaceTestsImpl(
  controller: vscode.TestController,
  document: vscode.TextDocument,
  nss: string[]
) {
  if (!util.getConnectedState()) {
    void vscode.window.showInformationMessage(
      'You must connect to a REPL server to run this command.'
    );
    return;
  }

  if (nss.length === 0) {
    void vscode.window.showInformationMessage('No namespace selected.');
    return;
  }

  const session = getSession(util.getFileType(document));

  output.appendLineOtherOut(
    `Running tests for the following namespaces:\n${
      nss.map((item) => `  ${item}`).join('\n') + '\n'
    }`
  );

  const resultPromises = nss.map((ns) => {
    return session.testNs(ns);
  });
  try {
    await reportTests(controller, session, await Promise.all(resultPromises));
  } catch (e) {
    output.appendLineOtherErr(e);
  }

  outputWindow.setSession(session, nss[0]);
  updateReplSessionType();
  output.replWindowAppendPrompt();
}

async function runNamespaceTests(controller: vscode.TestController, document: vscode.TextDocument) {
  const doc = util.tryToGetDocument(document);
  if (outputWindow.isResultsDoc(doc)) {
    return;
  }
  const [currentDocNs, _] = namespace.getNamespace(
    doc,
    vscode.window.activeTextEditor?.selections[0]?.active
  );
  const namespacesToRunTestsFor = [
    currentDocNs,
    currentDocNs.endsWith('-test') ? currentDocNs.slice(0, -5) : currentDocNs + '-test',
  ];
  return runNamespaceTestsImpl(controller, document, namespacesToRunTestsFor);
}

function getTestUnderCursor() {
  const editor = util.tryToGetActiveTextEditor();
  if (editor) {
    return getText.currentTopLevelDefined(editor?.document, editor?.selections[0].active)[1];
  }
}

async function runTestUnderCursor(controller: vscode.TestController) {
  const doc = util.tryToGetDocument({});
  const session = getSession(util.getFileType(doc));
  const [ns, _] = namespace.getNamespace(
    doc,
    vscode.window.activeTextEditor?.selections[0]?.active
  );
  const test = getTestUnderCursor();

  if (test) {
    output.appendLineOtherOut(`Running test: ${test}…`);
    try {
      await reportTests(controller, session, [await session.test(ns, test)]);
    } catch (e) {
      output.appendLineOtherErr(e);
    }
  } else {
    output.appendLineOtherOut('No test found at cursor');
  }
  output.replWindowAppendPrompt();
}

function runTestUnderCursorCommand(controller: vscode.TestController) {
  if (!util.getConnectedState()) {
    void vscode.window.showInformationMessage(
      'You must connect to a REPL server to run this command.'
    );
    return;
  }
  runTestUnderCursor(controller).catch((msg) => {
    void vscode.window.showWarningMessage(msg);
  });
}

function runNamespaceTestsCommand(controller: vscode.TestController) {
  if (!util.getConnectedState()) {
    void vscode.window.showInformationMessage(
      'You must connect to a REPL server to run this command.'
    );
    return;
  }
  runNamespaceTests(controller, util.getActiveTextEditor().document).catch((msg) => {
    void vscode.window.showWarningMessage(msg);
  });
}

async function rerunTests(controller: vscode.TestController, document = {}) {
  const session = getSession(util.getFileType(document));
  output.appendLineOtherOut('Running previously failed tests…');
  try {
    await reportTests(controller, session, [await session.retest()]);
  } catch (e) {
    output.appendLineOtherErr(e);
  }
  output.replWindowAppendPrompt();
}

function rerunTestsCommand(controller: vscode.TestController) {
  if (!util.getConnectedState()) {
    void vscode.window.showInformationMessage(
      'You must connect to a REPL server to run this command.'
    );
    return;
  }
  rerunTests(controller).catch((msg) => {
    void vscode.window.showWarningMessage(msg);
  });
}

function initialize(controller: vscode.TestController): void {
  const profile = controller.createRunProfile(
    'Clojure Run Profile',
    vscode.TestRunProfileKind.Run,

    (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
      if (!util.getConnectedState()) {
        void vscode.window.showInformationMessage(
          'You must connect to a REPL server to run tests.'
        );
        return;
      }

      if (request.exclude && request.exclude.length > 0) {
        void vscode.window.showWarningMessage(
          'Excluding tests from a test run is not currently supported - running all tests.'
        );
      }

      if (!request.include) {
        runAllTests(controller).catch((msg) => {
          void vscode.window.showWarningMessage(msg);
        });
        return;
      }

      const runItems = request.include.map((req) => {
        // Split into [namespace, var]
        return req.id.split('/', 2);
      });

      // TODO.marc: We don't support running specific vars right now.
      // If the user selects to run subset of tests, we run the whole namespace.
      // The next steps here would be to turn request.exclude and requst.include
      // into a Cider var-query that can be passed to test-var query directly.
      const namespaces = util.distinct(runItems.map((ri) => ri[0]));
      const doc = util.getActiveTextEditor().document;
      runNamespaceTestsImpl(controller, doc, namespaces).catch((msg) => {
        void vscode.window.showWarningMessage(msg);
      });
    },
    true
  );

  controller.resolveHandler = (item: vscode.TestItem | undefined) => {
    // currently unused
  };
}

function createRange(test: lsp.TestTreeNode): vscode.Range {
  return new vscode.Range(
    test.range.start.line,
    test.range.start.character,
    test.range.end.line,
    test.range.end.character
  );
}

function onTestTree(controller: vscode.TestController, testTree: lsp.TestTreeParams) {
  if (!useTestExplorer()) {
    return;
  }
  try {
    const uri = vscode.Uri.parse(testTree.uri);
    const ns = createCleanNamespaceItem(
      controller,
      uri,
      testTree.tree.name,
      createRange(testTree.tree)
    );
    ns.canResolveChildren = true;
    testTree.tree.children.forEach((c) => {
      upsertTest(controller, uri, testTree.tree.name, c.name, createRange(c));
    });
  } catch (e) {
    void vscode.window.showErrorMessage('Error in test tree parsing', e);
  }
}

export default {
  initialize,
  runNamespaceTests,
  runNamespaceTestsCommand,
  runAllTestsCommand,
  rerunTestsCommand,
  runTestUnderCursorCommand,
  onTestTree,
  loadTestNS,
};
