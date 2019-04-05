import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from '../../state';
import evaluate from './evaluate';
import * as util from '../../utilities';

let diagnosticCollection = vscode.languages.createDiagnosticCollection('calva');

function reportTests(results, errorStr, log = true) {
    let chan = state.outputChannel(),
        diagnostics = {},
        total_summary: { test, error, ns, var, fail } = { test: 0, error: 0, ns: 0, var: 0, fail: 0 };
    diagnosticCollection.clear();
    if (results.err || results.ex) {
        util.logError({
            type: util.ERROR_TYPE.ERROR,
            reason: "Error " + errorStr + ":" + results.err
        });
    } else {
        for (let result of results) {
            for (const ns in result.results) {
                let resultSet = result.results[ns];
                for (const test in resultSet) {
                    for (const a of resultSet[test]) {
                        if (a.type == "error" && log)
                            chan.appendLine(`ERROR in: ${ns}: ${a.file}, line ${a.line}: ${test}: ${(a.context || "")}:\n  error: ${a.error} + "\n  expected: ${a.expected}`);
                        if (a.type == "fail") {
                            let msg = `failure in test: ${test} context: ${a.context}, expected ${a.expected}, got: ${a.actual}`,
                                err = new vscode.Diagnostic(new vscode.Range(a.line - 1, 0, a.line - 1, 1000), msg, vscode.DiagnosticSeverity.Error);
                            if (!diagnostics[a.file])
                                diagnostics[a.file] = [];
                            diagnostics[a.file].push(err);
                            if (log)
                                chan.appendLine(`FAIL in: ${a.file}: ${a.line}: ${test}: ${(a.context || "")}:\n  expected: ${a.expected}\n  actual: ${a.actual}`);
                        }
                    }
                }
            }
            if (result.summary !== null) {
                _.each(result.summary, (v, k) => {
                    total_summary[k] = result.summary[k] + (total_summary[k] !== undefined ? total_summary[k] : 0);
                });
            }
        }

        if (total_summary !== null) {
            let hasProblems = total_summary.error + total_summary.fail > 0;
            if (log) {
                chan.appendLine("\n" + (total_summary.test > 0 ?
                    total_summary.test + " tests finished, " +
                    (!hasProblems ? "all passing 👍" :
                        "problems found. 😭" +
                        " errors: " + total_summary.error + ", failures: " + total_summary.fail) : "No tests found. 😱") +
                    ", ns: " + total_summary.ns + ", vars: " + total_summary.var);
            }

            if (total_summary.test > 0) {
                if (hasProblems) {
                    _.each(diagnostics, (errors, fileName) => {
                        if (fileName.startsWith('/'))
                            diagnosticCollection.set(vscode.Uri.file(fileName), errors);
                        else {
                            // Sometimes we don't get the full path for some reason. (This is a very inexact
                            // way of dealing with that. Maybe check for the right `ns`in the file?)
                            vscode.workspace.findFiles('**/' + fileName, undefined).then((uri) => {
                                diagnosticCollection.set(uri[0], errors);
                            });
                        }
                    });
                }
            }
        }
    }
}

// FIXME: use cljs session where necessary
async function runAllTests(document = {}) {
    let client = util.getSession(util.getFileType(document));
    state.outputChannel().appendLine("Running all project tests…");
    reportTests([await client.testAll()], "Running all tests");
}

function runAllTestsCommand() {
    state.outputChannel().show(true);
    runAllTests();
}

async function considerTestNS(ns: string, client: any, nss: string[]): Promise<string[]> {
    if (!ns.endsWith('-test')) {
        let testNS = ns + '-test',
            testFilePath = await client.nsPath(testNS).path;
        if (`${testFilePath}` != "") {
            let loadForms = `(load-file "${testFilePath}")`;
            await client.eval(loadForms);
        }
        nss.push(testNS);
        return nss;
    }
    return nss;
}

async function runNamespaceTests(document = {}) {
    let client = util.getSession(util.getFileType(document)),
        doc = util.getDocument(document),
        ns = util.getNamespace(doc.getText()),
        nss = [ns];
    
    evaluate.evaluateFile({}, async () => {
        state.outputChannel().appendLine("Running namespace tests…");
        nss = await considerTestNS(ns, client, nss);
        let resultPromises = [client.test(nss[0])];
        if (nss.length > 1)
            resultPromises.push(client.test(nss[1]));
        let results = await Promise.all(resultPromises);
        reportTests(results, "Running tests")
    });
}

function runNamespaceTestsCommand() {
    state.outputChannel().show(true);
    runNamespaceTests();
}

function rerunTests(document = {}) {
    let client = util.getSession(util.getFileType(document))
    evaluate.evaluateFile({}, async () => {
        state.outputChannel().appendLine("Running previously failed tests…");
        reportTests([await client.retest()], "Retesting");
    });
}

function rerunTestsCommand() {
    state.outputChannel().show(true);
    rerunTests();
}

export default {
    runNamespaceTests,
    runNamespaceTestsCommand,
    runAllTests,
    runAllTestsCommand,
    rerunTestsCommand
};