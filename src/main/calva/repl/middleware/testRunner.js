import vscode from 'vscode';
import _ from 'lodash';
import { deref } from '../../state';
import createReplClient from '../client';
import message from 'goog:calva.repl.message';
import { evaluateFile } from './evaluate';
import { ERROR_TYPE, getDocument, getFileType, getNamespace, getSession, logError } from '../../utilities';

let diagnosticCollection = vscode.languages.createDiagnosticCollection('calva');

function markTestResults(responsesArray, log = true) {
    let chan = deref().get('outputChannel'),
        diagnostics = {},
        total_summary = {};
    diagnosticCollection.clear();
    _.each(responsesArray, (responses) => {
        _.each(responses, response => {
            let results = response.results || null,
                summary = response.summary || null;
            if (results !== null) {
                _.each(results, (tests, ns) => {
                    _.each(tests, (asserts, test) => {
                        _.each(asserts, a => {
                            if (a.type == "error") {
                                if (log) {
                                    chan.appendLine("ERROR in: " + ns + ": " + a.file + ", line " + a.line +
                                        ": " + test + ": " + (a.context || "") + ":\n" +
                                        "  error: " + a.error + "\n  expected: " + a.expected);
                                }
                            }
                            if (a.type == "fail") {
                                let msg = "failure in test: " + test +
                                    " context: " + a.context + ", expected " +
                                    a.expected + ", got: " + a.actual,
                                    err = new vscode.Diagnostic(new vscode.Range(a.line - 1, 0, a.line - 1, 1000),
                                        msg,
                                        vscode.DiagnosticSeverity.Error);
                                if (!diagnostics[a.file]) {
                                    diagnostics[a.file] = [];
                                }
                                diagnostics[a.file].push(err);
                                if (log) {
                                    chan.appendLine("FAIL in: " + a.file + ":" + a.line +
                                        ": " + test + ": " + (a.context || "") + ":\n" +
                                        "  expected: " + a.expected + "\n  actual: " + a.actual);
                                }
                            }
                        })
                    })
                })
            }
            if (summary !== null) {
                _.each(summary, (v, k) => {
                    total_summary[k] = summary[k] + (total_summary[k] !== undefined ? total_summary[k] : 0);
                });
            }
        });
    });
    if (total_summary !== null) {
        let hasProblems = total_summary.error + total_summary.fail > 0;
        if (log) {
            chan.appendLine("\n" + (total_summary.test > 0 ?
                total_summary.test + " tests finished, " +
                (!hasProblems ? "all passing 👍" :
                    "problems found. 😭" +
                    " errors: " + total_summary.error + ", failures: " + total_summary.fail) :
                "No tests found. 😱") +
                ", ns: " + total_summary.ns + ", vars: " + total_summary.var);
        }

        if (total_summary.test > 0) {
            if (hasProblems) {
                _.each(diagnostics, (errors, fileName) => {
                    if (fileName.startsWith('/')) {
                        diagnosticCollection.set(vscode.Uri.file(fileName), errors);
                    }
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

function runTests(messages, startStr, errorStr, log = true) {
    let current = deref(),
        chan = current.get('outputChannel');

    if (current.get('connected')) {
        if (log) {
            chan.appendLine(startStr);
        }
        let testClient = null,
            results = [],
            errors = 0,
            exceptions = 0;

        // It seems we cannot set up two connections, lest they get mixed up.
        // Thus we only send new messages when a message has returned.
        (function loop(i) {
            new Promise((resolve, reject) => {
                testClient = createReplClient().once('connect', () => {
                    testClient.send(messages[i], (result) => {
                        exceptions += _.some(result, "ex");
                        errors += _.some(result, "err");
                        if (!exceptions && !errors) {
                            resolve(result);
                        } else {
                            logError({
                                type: ERROR_TYPE.ERROR,
                                reason: "Error " + errorStr + ":" + _.find(result, "err").err
                            });
                            reject(result);
                        }
                    });
                });
            }).then((result) => {
                testClient.end();
                results.push(result);
                if (i < messages.length - 1) {
                    loop(i + 1);
                } else {
                    if ((messages[0].op === message.operation.RETEST) && (results[0][0]["testing-ns"].length < 1)) {
                        chan.appendLine("No tests to rerun. (They probably all passed last time 🤘)")
                    } else {
                        markTestResults(results);
                    }
                }
            }).catch(() => {
                testClient.end();
            });
        })(0);
    }
}

function runAllTests(document = {}) {
    let doc = getDocument(document),
        session = getSession(getFileType(doc)),
        msg = message.testAllMsg(session);

    runTests([msg], "Running all tests", "running all tests");
}

function runAllTestsCommand() {
    let chan = deref().get('outputChannel');

    chan.show();
    runAllTests();
}

function getNamespaceTestMessages(document = {}) {
    let doc = getDocument(document),
        session = getSession(getFileType(doc)),
        ns = getNamespace(doc.getText()),
        messages = [message.testMsg(session, ns)];

    if (!ns.endsWith('-test')) {
        messages.push(message.testMsg(session, ns + '-test'));
    }
    return messages;
}

function runNamespaceTests(document = {}) {
    evaluateFile({}, () => {
        runTests(getNamespaceTestMessages(document), "Running tests", "running tests");
    });
}

function runNamespaceTestsCommand() {
    deref().get('outputChannel').show();
    runNamespaceTests();
}

function rerunTests(document = {}) {
    let doc = getDocument(document),
        session = getSession(getFileType(doc)),
        msg = message.rerunTestsMsg(session);

    evaluateFile({}, () => {
        runTests([msg], "Retesting", "retesting");
    });
}

function rerunTestsCommand() {
    deref().get('outputChannel').show();
    rerunTests();
}



export {
    runNamespaceTests,
    runNamespaceTestsCommand,
    runAllTests,
    runAllTestsCommand,
    rerunTestsCommand
};