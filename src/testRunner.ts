import * as vscode from 'vscode';
import evaluate from './evaluate';
import * as util from './utilities';
import { disabledPrettyPrinter } from './printer';
import * as outputWindow from './results-output/results-doc';
import { NReplSession } from './nrepl';
import * as cider from './nrepl/cider'
import * as namespace from './namespace';
import { getSession, updateReplSessionType } from './nrepl/repl-session';
import * as getText from './util/get-text';

let diagnosticCollection = vscode.languages.createDiagnosticCollection('calva');

function guessFileName(namespace: string): string {
    return namespace.replace(/\./g, "/").replace(/-/g, "_");
}

async function uriForFile(fileName: string): Promise<vscode.Uri> {
    if (fileName.startsWith('/')) {
        return vscode.Uri.file(fileName);
    }
    // Sometimes we don't get the full path for some reason. (This is a very inexact
    // way of dealing with that. Maybe check for the right `ns`in the file?)
    const uris = await vscode.workspace.findFiles('**/' + fileName);
    return uris[0];
}

async function onTestResult(controller: vscode.TestController, run: vscode.TestRun, nsName: string, varName: string, assertions: cider.TestResult[]) {
    let ns = controller.items.get(nsName);
    if (!ns) {
        const uri = await uriForFile(guessFileName(nsName));
        ns = controller.createTestItem(nsName, nsName, uri);
        ns.description = "Namespace";
        controller.items.add(ns);
    }

    let testId = nsName + '/' + varName;

    let test = ns.children.get(testId);

    if (!test) {
        const uri = await uriForFile(guessFileName(nsName));
        test = controller.createTestItem(testId, varName, uri);
        test.description = "Var";
        ns.children.add(test);
    }

    const lines = assertions.map(a => a.line).filter(x => x).sort();
    if (lines.length > 0) {
        test.range = new vscode.Range(lines[0] - 1, 0, lines[lines.length - 1], 1000);
    }

    test.children.replace([]);

    const failures = assertions.filter(result => {
        return result.type != 'pass';
    });

    if (failures.length == 0) {
        run.passed(test);
        return;
    }

    const x = failures.map(async function (result) {
        let assertionId = testId + '/' + result.index;
        const uri = await uriForFile(result.file); // todo - cache this.
        const label = result.context + " " + result.index;
        const assertion = controller.createTestItem(assertionId, label, uri);
        assertion.description = 'is';
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

    const y = await Promise.all(x);
}



async function onTestResults(controller: vscode.TestController, results: cider.TestResults[]) {
    const run = controller.createTestRun(new vscode.TestRunRequest(), "Clojure", false);
    for (const result of results) {
        for (const namespace in result.results) {
            const tests = result.results[namespace];
            for (const test in tests) {
                // slow?
                await onTestResult(controller, run, namespace, test, tests[test]);
            }
        }
    }
    run.end();
}


function reportTests(controller: vscode.TestController, results: cider.TestResults[]) {
    let diagnostics: { [key: string]: vscode.Diagnostic[] } = {};
    diagnosticCollection.clear();

    const recordDiagnostic = (result: cider.TestResult) => {
        const msg = cider.diagnosticMessage(result);
        const err = new vscode.Diagnostic(new vscode.Range(result.line - 1, 0, result.line - 1, 1000), msg, vscode.DiagnosticSeverity.Error);
        if (!diagnostics[result.file])
            diagnostics[result.file] = [];
        diagnostics[result.file].push(err);
    }


    const useTestExplorer: boolean = vscode.workspace.getConfiguration('calva').get('useTestExplorer');

    if (useTestExplorer) {
        onTestResults(controller, results).catch(e => {
            vscode.window.showErrorMessage("Error in test explorer: " + e);
        });
    }


    for (let result of results) {
        for (const ns in result.results) {
            let resultSet = result.results[ns];
            for (const test in resultSet) {
                for (const a of resultSet[test]) {

                    cider.cleanUpWhiteSpace(a);

                    outputWindow.append(cider.detailedMessage(a));

                    if (a.type === "fail") {
                        recordDiagnostic(a);
                    }
                }
            }
        }
    }

    const summary = cider.totalSummary(results.map(r => r.summary));
    outputWindow.append("; " + cider.summaryMessage(summary));

    if (!useTestExplorer) {
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
        reportTests(controller, [await session.testAll()]);
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

async function considerTestNS(ns: string, session: NReplSession, nss: string[]): Promise<string[]> {
    if (!ns.endsWith('-test')) {
        const testNS = ns + '-test';
        const nsPath = await session.nsPath(testNS);
        const testFilePath = nsPath.path;
        if (testFilePath && testFilePath !== "") {
            const filePath = vscode.Uri.parse(testFilePath).path;
            let loadForms = `(load-file "${filePath}")`;
            await session.eval(loadForms, testNS).value;
        }
        nss.push(testNS);
        return nss;
    }
    return nss;
}

async function runNamespaceTests(controller: vscode.TestController, document = {}) {
    const doc = util.getDocument(document);
    if (outputWindow.isResultsDoc(doc)) {
        return;
    }
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    const session = getSession(util.getFileType(document));
    const ns = namespace.getNamespace(doc);
    let nss = [ns];
    await evaluate.loadFile({}, disabledPrettyPrinter);
    outputWindow.append(`; Running tests for ${ns}...`);
    nss = await considerTestNS(ns, session, nss);
    const resultPromises = [session.testNs(nss[0])];
    if (nss.length > 1) {
        resultPromises.push(session.testNs(nss[1]));
    }
    try {
        reportTests(controller, await Promise.all(resultPromises));
    } catch (e) {
        outputWindow.append('; ' + e)
    }

    outputWindow.setSession(session, ns);
    updateReplSessionType();
    outputWindow.appendPrompt();
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
            reportTests(controller, [await session.test(ns, test)]);
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
    runNamespaceTests(controller).catch((msg) => {
        vscode.window.showWarningMessage(msg)
    });
}

async function rerunTests(controller: vscode.TestController, document = {}) {
    let session = getSession(util.getFileType(document))
    await evaluate.loadFile({}, disabledPrettyPrinter);
    outputWindow.append("; Running previously failed tests…");

    try {
        reportTests(controller, [await session.retest()]);
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

function initialize(context: vscode.ExtensionContext): vscode.TestController {
    const controller = vscode.tests.createTestController('calvaTestController', 'Clojure Cider')
    context.subscriptions.push(controller);

    controller.createRunProfile('Clojure Run Profile',
        vscode.TestRunProfileKind.Run,

        (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
            // Currently unused
            console.log('in test run handler');
            if (!request.include) {
                vscode.commands.executeCommand('calva.runAllTests');
                return;
            }
        },
        true);


    controller.resolveHandler = (item: vscode.TestItem | undefined) => {
        // Currently unused
        console.log('in test resolve handler');
    }

    return controller;
}


export default {
    initialize,
    runNamespaceTests,
    runNamespaceTestsCommand,
    runAllTestsCommand,
    rerunTestsCommand,
    runTestUnderCursorCommand
};
