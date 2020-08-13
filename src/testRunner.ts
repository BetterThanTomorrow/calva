import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import evaluate from './evaluate';
import * as util from './utilities';
import { disabledPrettyPrinter } from './printer';
import * as outputWindow from './results-output/results-doc';
import { NReplSession } from './nrepl';
import * as namespace from './namespace';

let diagnosticCollection = vscode.languages.createDiagnosticCollection('calva');

function reportTests(results, errorStr, log = true) {
    let diagnostics = {};
    let total_summary: { test, error, ns, var, fail } = { test: 0, error: 0, ns: 0, var: 0, fail: 0 };
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
                        for (const prop in a) {
                            if (typeof (a[prop]) === 'string') {
                                a[prop] = a[prop].replace(/\r?\n$/, "");
                            }
                        }
                        const resultMessage = (resultItem) => {
                          let msg = [];
                          if(!_.isEmpty(resultItem.context) && resultItem.context !== "false")
                            msg.push(resultItem.context);
                          if(resultItem.message)
                            msg.push(resultItem.message);
                            return `${msg.length > 0 ? msg.join(": ").replace(/\r?\n$/, "") : ''}`;
                        }
                        if (a.type == "error" && log) {
                            const rMsg = resultMessage(a);
                            outputWindow.append(`; ERROR in ${ns}/${test} (line ${a.line}):`);
                            if (rMsg !== '') {
                                outputWindow.append(`; ${resultMessage(a)}`);
                            }
                            outputWindow.append(`;   error: ${a.error} (${a.file})\n;   expected: ${a.expected}`);
                        }
                        if (a.type == "fail") {
                            const rMsg = resultMessage(a);
                            let msg = `failure in test: ${test} context: ${a.context}, expected ${a.expected}, got: ${a.actual}`,
                                err = new vscode.Diagnostic(new vscode.Range(a.line - 1, 0, a.line - 1, 1000), msg, vscode.DiagnosticSeverity.Error);
                            if (!diagnostics[a.file])
                                diagnostics[a.file] = [];
                            diagnostics[a.file].push(err);
                            if (log) {
                                outputWindow.append(`; FAIL in ${ns}/${test} (${a.file}:${a.line}):`);
                                if (rMsg !== '') {
                                    outputWindow.append(`; ${resultMessage(a)}`);
                                }
                                outputWindow.append(`;   expected: ${a.expected}\n;   actual: ${a.actual}`);
                            }
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
                outputWindow.append("; " + (total_summary.test > 0 ?
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
    const session = namespace.getSession(util.getFileType(document));
    outputWindow.append("; Running all project tests…");
    outputWindow.setSession(session, session.client.ns);
    namespace.updateREPLSessionType();
    reportTests([await session.testAll()], "Running all tests");
    outputWindow.setSession(session, session.client.ns);
}

function runAllTestsCommand() {
    state.outputChannel().show(true);
    runAllTests().catch(() => {});
}

async function considerTestNS(ns: string, session: NReplSession, nss: string[]): Promise<string[]> {
    if (!ns.endsWith('-test')) {
        const testNS = ns + '-test';
        const testFilePath = (await session.nsPath(testNS)).path;
        if (`${testFilePath}` != "") {
            let loadForms = `(load-file "${testFilePath}")`;
            await session.eval(loadForms, testNS).value;
        }
        nss.push(testNS);
        return nss;
    }
    return nss;
}

function runNamespaceTests(document = {}) {
    const session = namespace.getSession(util.getFileType(document));
    const doc = util.getDocument(document);
    const ns = namespace.getNamespace(doc);
    let nss = [ns];
    if (!outputWindow.isResultsDoc(doc)) {
        evaluate.loadFile({}, async () => {
            outputWindow.append("; Running namespace tests…");
            nss = await considerTestNS(ns, session, nss);
            const resultPromises = [session.testNs(nss[0])];
            if (nss.length > 1)
                resultPromises.push(session.testNs(nss[1]));
            const results = await Promise.all(resultPromises);
            reportTests(results, "Running tests");
        }, disabledPrettyPrinter).catch(() => { });
    }
}

async function runTestUnderCursor() {
    const doc = util.getDocument({}),
        session = namespace.getSession(util.getFileType(doc)),
        ns = namespace.getNamespace(doc),
        test = util.getTestUnderCursor();

    evaluate.loadFile(doc, async () => {
        outputWindow.append(`; Running test: ${test}…`);
        const results = [await session.test(ns, [test])];
        reportTests(results, `Running test: ${test}`);
    }, disabledPrettyPrinter).catch(() => {});
}

function runTestUnderCursorCommand() {
    state.outputChannel().show(true);
    runTestUnderCursor().catch(() => {});
}

function runNamespaceTestsCommand() {
    state.outputChannel().show(true);
    runNamespaceTests();
}

function rerunTests(document = {}) {
    let session = namespace.getSession(util.getFileType(document))
    evaluate.loadFile({}, async () => {
        outputWindow.append("; Running previously failed tests…");
        reportTests([await session.retest()], "Retesting");
    }, disabledPrettyPrinter).catch(() => {});
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
    rerunTestsCommand,
    runTestUnderCursorCommand
};
