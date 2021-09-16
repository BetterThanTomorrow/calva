import * as vscode from 'vscode';
import * as _ from 'lodash';
import evaluate from './evaluate';
import * as util from './utilities';
import { disabledPrettyPrinter } from './printer';
import * as outputWindow from './results-output/results-doc';
import { NReplSession } from './nrepl';
import * as namespace from './namespace';
import { getSession, updateReplSessionType } from './nrepl/repl-session';
import * as getText from './util/get-text';

let diagnosticCollection = vscode.languages.createDiagnosticCollection('calva');

// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L45
interface CiderTestSummary {
    ns: number;
    var: number;
    test: number;
    pass: number;
    fail: number;
    error: number;
};

// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L97-L112
interface CiderTestResult {
    context: string;
    index: number;
    message: string;
    ns: string;
    type: string;
    var: string;
    expected?: string;
    'gen-input'?: string;
    actual?: string;
    diffs?: any;
    error?: any;
    line?: number
    file?: string;
}

// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L45-L46
interface CiderTestResults {
    summary: CiderTestSummary;
    results: {
        [key: string]: {
            [key: string]: CiderTestResult[]
        }
    }
    'testing-ns'?: string
    'gen-input': any
}

interface CiderTestError {
    ex: any;
    err: any;
}

function reportTests(results: CiderTestResults[], errorStr: string, log = true) {
    let diagnostics: {[key: string]: vscode.Diagnostic[]} = {};
    let total_summary: CiderTestSummary = { test: 0, error: 0, ns: 0, var: 0, fail: 0, pass: 0 };
    diagnosticCollection.clear();

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
                    const resultMessage = (resultItem: CiderTestResult) => {
                        let msg = [];
                        if (!_.isEmpty(resultItem.context) && resultItem.context !== "false")
                            msg.push(resultItem.context);
                        if (resultItem.message)
                            msg.push(resultItem.message);
                        return `${msg.length > 0 ? msg.join(": ").replace(/\r?\n$/, "") : ''}`;
                    }
                    if (a.type === "error" && log) {
                        const rMsg = resultMessage(a);
                        outputWindow.append(`; ERROR in ${ns}/${test} (line ${a.line}):`);
                        if (rMsg !== '') {
                            outputWindow.append(`; ${resultMessage(a)}`);
                        }
                        outputWindow.append(`; error: ${a.error} (${a.file})\n; expected:\n${a.expected}`);
                    }
                    if (a.type === "fail") {
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
                            outputWindow.append(`; expected:\n${a.expected}\n; actual:\n${a.actual}`);
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

// FIXME: use cljs session where necessary
async function runAllTests(document = {}) {
    const session = getSession(util.getFileType(document));
    outputWindow.append("; Running all project tests…");
    reportTests([await session.testAll()], "Running all tests");
    updateReplSessionType();
    outputWindow.appendPrompt();
}

function runAllTestsCommand() {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    runAllTests().catch(() => { });
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

async function runNamespaceTests(document = {}) {
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
    const results = await Promise.all(resultPromises);
    reportTests(results, "Running tests");
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

async function runTestUnderCursor() {
    const doc = util.getDocument({});
    const session = getSession(util.getFileType(doc));
    const ns = namespace.getNamespace(doc);
    const test = getTestUnderCursor();

    if (test) {
        await evaluate.loadFile(doc, disabledPrettyPrinter);
        outputWindow.append(`; Running test: ${test}…`);
        const results = [await session.test(ns, test)];
        reportTests(results, `Running test: ${test}`);
    } else {
        outputWindow.append('; No test found at cursor');
    }
    outputWindow.appendPrompt();
}

function runTestUnderCursorCommand() {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    runTestUnderCursor().catch(() => { });
}

function runNamespaceTestsCommand() {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    runNamespaceTests();
}

async function rerunTests(document = {}) {
    let session = getSession(util.getFileType(document))
    await evaluate.loadFile({}, disabledPrettyPrinter);
    outputWindow.append("; Running previously failed tests…");
    reportTests([await session.retest()], "Retesting");
    outputWindow.appendPrompt();
}

function rerunTestsCommand() {
    if (!util.getConnectedState()) {
        vscode.window.showInformationMessage('You must connect to a REPL server to run this command.')
        return;
    }
    rerunTests();
}

export default {
    runNamespaceTests,
    runNamespaceTestsCommand,
    runAllTestsCommand,
    rerunTestsCommand,
    runTestUnderCursorCommand
};
