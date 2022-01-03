import * as vscode from 'vscode';
import evaluate from './evaluate';
import * as util from './utilities';
import { disabledPrettyPrinter } from './printer';
import * as outputWindow from './results-output/results-doc';
import { NReplSession } from './nrepl';
import * as cider from './nrepl/cider'
import * as lsp from './lsp/types'
import * as namespace from './namespace';
import { getSession, updateReplSessionType } from './nrepl/repl-session';
import * as getText from './util/get-text';

let diagnosticCollection = vscode.languages.createDiagnosticCollection('calva');

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
// Creates a new item if one does not exist, othrwise we find the existing entry.
// If a Range is supplied, that we set the range on the returned item.
function upsertNamespace(controller: vscode.TestController, uri: vscode.Uri, nsName: string, range?: vscode.Range): vscode.TestItem {
    let ns = controller.items.get(nsName);
    if (!ns) {
        ns = controller.createTestItem(nsName, nsName, uri);
    }
    if (range) {
        ns.range = range;
    }
    controller.items.add(ns);
    return ns;
}

// Return a valid TestItem for the test var.
// Creates a new item if one does not exist, othrwise we find the existing entry.
// If a Range is supplied, that we set the range on the returned item.
function upsertTest(controller: vscode.TestController, uri: vscode.Uri, nsName: string, varName: string, range?: vscode.Range): vscode.TestItem {
    const ns = upsertNamespace(controller, uri, nsName);
    let testId = nsName + '/' + varName;
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
    if (util.isNonEmptyString(result.context)) {
        return result.context;
    }
    return "assertion";
}

function existingUriForNameSpace(controller: vscode.TestController, nsName: string): vscode.Uri | null {
    return controller.items.get(nsName)?.uri;
}

async function onTestResult(controller: vscode.TestController, session: NReplSession, run: vscode.TestRun, nsName: string, varName: string, assertions: cider.TestResult[]) {

    let uri = existingUriForNameSpace(controller, nsName);
    if (!uri) {
        uri = await namespace.getUriForNamespace(session, nsName);
    }
    if (!uri) {
        console.warn('Test Runner: Unable to find file corresponding to namespace: ' + nsName);
    }

    const test = upsertTest(controller, uri, nsName, varName)

    // The Clojure LSP gives a very accurate range for a test. In some cases, this
    // function will be called before Clojure LSP has analysed the file, so we might
    // have a test item with no range set. In this case, we can look at the line
    // data in the assertions collection and produce a good approximation of the
    // range. If the LSP subsequently scans the file, upsertTest will be called,
    // which will set the range correctly.
    if (!test.range || test.range.isEmpty) {
        const lines = assertions.map(a => a.line).filter(x => x).sort();
        if (lines.length > 0) {
            test.range = new vscode.Range(lines[0] - 1, 0, lines[lines.length - 1], 1000);
        }
    }

    // Clear any children, which are assertions left over from previous runs.
    test.children.replace([]);

    const failures = assertions.filter(result => {
        return result.type != 'pass';
    });

    if (failures.length == 0) {
        run.passed(test);
        return;
    }

    failures.forEach(result => {
        let assertionId = test.id + '/' + result.index;
        const assertion = controller.createTestItem(assertionId, assertionName(result), uri);
        test.children.add(assertion);
        assertion.range = new vscode.Range(result.line - 1, 0, result.line - 1, 1000);

        switch (result.type) {
            case "error":
                run.errored(assertion, new vscode.TestMessage(cider.shortMessage(result)));
                break;
            case "fail":
            default:
                run.failed(assertion, new vscode.TestMessage(cider.shortMessage(result)));
                break;
        }
    });
}

async function onTestResults(controller: vscode.TestController, session: NReplSession, results: cider.TestResults[]) {
    const run = controller.createTestRun(new vscode.TestRunRequest(), "Clojure", false);
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

function useTestExplorer(): boolean {
    return vscode.workspace.getConfiguration('calva').get('useTestExplorer');
}

function reportTests(controller: vscode.TestController, session: NReplSession, results: cider.TestResults[]) {
    let diagnostics: { [key: string]: vscode.Diagnostic[] } = {};
    diagnosticCollection.clear();

    const recordDiagnostic = (result: cider.TestResult) => {
        const msg = cider.diagnosticMessage(result);
        const err = new vscode.Diagnostic(new vscode.Range(result.line - 1, 0, result.line - 1, 1000), msg, vscode.DiagnosticSeverity.Error);
        if (!diagnostics[result.file])
            diagnostics[result.file] = [];
        diagnostics[result.file].push(err);
    }

    if (useTestExplorer()) {
        onTestResults(controller, session, results);
    }

    for (let result of results) {
        for (const ns in result.results) {
            let resultSet = result.results[ns];
            for (const test in resultSet) {
                for (const a of resultSet[test]) {
                    cider.cleanUpWhiteSpace(a);

                    const messages = cider.detailedMessage(a);
                    if (messages) {
                        outputWindow.append(messages);
                    }

                    if (a.type === "fail") {
                        recordDiagnostic(a);
                    }
                }
            }
        }
    }

    const summary = cider.totalSummary(results.map(r => r.summary));
    outputWindow.append("; " + cider.summaryMessage(summary));

    if (!useTestExplorer()) {
        for (const fileName in diagnostics) {
            uriForFile(fileName).then(uri => {
                diagnosticCollection.set(uri, diagnostics[fileName]);
            });
        }
    }
}

// FIXME: use cljs session where necessary
async function runAllTests(controller: vscode.TestController, document = {}) {
    const session = getSession(util.getFileType(document));
    outputWindow.append("; Running all project tests…");
    try {
        reportTests(controller, session, [await session.testAll()]);
    } catch (e) {
        outputWindow.append('; ' + e)
    }
    updateReplSessionType();
    outputWindow.appendPrompt();
}

function runAllTestsCommand(controller: vscode.TestController) {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    runAllTests(controller).catch((msg) => {
        vscode.window.showWarningMessage(msg)
    });
}

async function considerTestNS(ns: string, session: NReplSession): Promise<string[]> {
    if (!ns.endsWith('-test')) {
        const testNS = ns + '-test';
        const nsPath = await session.nsPath(testNS);
        const testFilePath = nsPath.path;
        if (testFilePath && testFilePath !== "") {
            const filePath = vscode.Uri.parse(testFilePath).path;
            let loadForms = `(load-file "${filePath}")`;
            await session.eval(loadForms, testNS).value;
        }

        return [ns, testNS];
    }
    return [ns];
}

async function runNamespaceTestsImpl(controller: vscode.TestController, document: vscode.TextDocument, nss: string[]) {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }

    if (nss.length === 0) {
        vscode.window.showInformationMessage('No namespace selected.')
        return;
    }

    const session = getSession(util.getFileType(document));

    // TODO.marc: Should we be passing the `document` argument to `loadFile`?
    await evaluate.loadFile({}, disabledPrettyPrinter);
    outputWindow.append(`; Running tests for ${nss[0]}...`);

    const resultPromises = nss.map((ns) => {
        return session.testNs(ns);
    });
    try {
        reportTests(controller, session, await Promise.all(resultPromises));
    } catch (e) {
        outputWindow.append('; ' + e)
    }

    outputWindow.setSession(session, nss[0]);
    updateReplSessionType();
    outputWindow.appendPrompt();
}

async function runNamespaceTests(controller: vscode.TestController, document: vscode.TextDocument) {
    const doc = util.getDocument(document);
    if (outputWindow.isResultsDoc(doc)) {
        return;
    }
    const session = getSession(util.getFileType(document));
    const ns = namespace.getNamespace(doc);
    const nss = await considerTestNS(ns, session);
    runNamespaceTestsImpl(controller, document, nss);
}

function getTestUnderCursor() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        return getText.currentTopLevelFunction(editor)[1];
    }
}

async function runTestUnderCursor(controller: vscode.TestController) {
    const doc = util.getDocument({});
    const session = getSession(util.getFileType(doc));
    const ns = namespace.getNamespace(doc);
    const test = getTestUnderCursor();

    if (test) {
        await evaluate.loadFile(doc, disabledPrettyPrinter);
        outputWindow.append(`; Running test: ${test}…`);
        try {
            reportTests(controller, session, [await session.test(ns, test)]);
        } catch (e) {
            outputWindow.append('; ' + e)
        }
    } else {
        outputWindow.append('; No test found at cursor');
    }
    outputWindow.appendPrompt();
}

function runTestUnderCursorCommand(controller: vscode.TestController) {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    runTestUnderCursor(controller).catch((msg) => {
        vscode.window.showWarningMessage(msg)
    });
}

function runNamespaceTestsCommand(controller: vscode.TestController) {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    runNamespaceTests(controller, vscode.window.activeTextEditor.document).catch((msg) => {
        vscode.window.showWarningMessage(msg)
    });
}

async function rerunTests(controller: vscode.TestController, document = {}) {
    let session = getSession(util.getFileType(document))
    await evaluate.loadFile({}, disabledPrettyPrinter);
    outputWindow.append("; Running previously failed tests…");

    try {
        reportTests(controller, session, [await session.retest()]);
    } catch (e) {
        outputWindow.append('; ' + e)
    }

    outputWindow.appendPrompt();
}

function rerunTestsCommand(controller: vscode.TestController) {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    rerunTests(controller).catch((msg) => {
        vscode.window.showWarningMessage(msg)
    });
}

function initialize(controller: vscode.TestController): void {

    const profile = controller.createRunProfile('Clojure Run Profile',
        vscode.TestRunProfileKind.Run,

        (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {

            if (!util.getConnectedState()) {
                vscode.window.showInformationMessage('You must connect to a REPL server to run tests.')
                return;
            }

            if (request.exclude && request.exclude.length > 0) {
                vscode.window.showWarningMessage("Excluding tests from a test run is not currently supported - running all tests.");
            }

            if (!request.include) {
                runAllTests(controller).catch((msg) => {
                    vscode.window.showWarningMessage(msg)
                });
                return;
            }

            const runItems = request.include.map(req => {
                // Split into [namespace, var]
                return req.id.split('/', 2);
            });

            // TODO.marc: We don't support running specific vars right now.
            // If the user selects to run subset of tests, we run the whole namespace.
            // The next steps here would be to turn request.exclude and requst.include
            // into a Cider var-query that can be passed to test-var query directly.
            const namespaces = util.distinct(runItems.map(ri => ri[0]));
            const doc = vscode.window.activeTextEditor.document
            runNamespaceTestsImpl(controller, doc, namespaces).catch((msg) => {
                vscode.window.showWarningMessage(msg)
            });

        },
        true);

    controller.resolveHandler = (item: vscode.TestItem | undefined) => {
        // currently unused
    }
}

function createRange(test: lsp.TestTreeNode): vscode.Range {
    return new vscode.Range(
        test.range.start.line,
        test.range.start.character,
        test.range.end.line,
        test.range.end.character);
}

function onTestTree(controller: vscode.TestController, testTree: lsp.TestTreeParams) {
    if (!useTestExplorer()) {
        return;
    }
    try {
        const uri = vscode.Uri.parse(testTree.uri)
        const ns = upsertNamespace(controller, uri, testTree.tree.name, createRange(testTree.tree));
        ns.canResolveChildren = true;
        testTree.tree.children.forEach(c => {
             upsertTest(controller, uri, testTree.tree.name, c.name, createRange(c));
        });
    } catch (e) {
        vscode.window.showErrorMessage('Error in test tree parsing', e);
    }
}

export default {
    initialize,
    runNamespaceTests,
    runNamespaceTestsCommand,
    runAllTestsCommand,
    rerunTestsCommand,
    runTestUnderCursorCommand,
    onTestTree
};
