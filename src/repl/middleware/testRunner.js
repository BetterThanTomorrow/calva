const _ = require('lodash');
const state = require('../../state');
const repl = require('../client');
const message = require('../message');
const {
    evaluateText
} = require('./evaluate');
const {
    getDocument,
    getFileType,
    logSuccess,
    logTestResults,
    logError,
    logWarning,
    ERROR_TYPE,
} = require('../../utilities');

function runNamespaceTests(document = {}) {
    let runTestsCode = '(clojure.test/run-tests *ns*)';
    evaluateText(runTestsCode, 'Running tests for current namespace:', 'failed running tests');
};

function runAllTests(document = {}) {
//    let runTestsCode = '(clojure.test/run-all-tests)';
//    evaluateText(runTestsCode, 'Running all tests:', 'failed running tests');
    let current = state.deref(),
        doc = getDocument(document),
        session = current.get(getFileType(doc)),
        msg = message.testAll(session);

    if (current.get('connected')) {
        chan = current.get('outputChannel');
        chan.clear();
        chan.appendLine("Running all tests");
        chan.appendLine("----------------------------");
        let testClient = null;
        new Promise((resolve, reject) => {
            testClient = repl.create().once('connect', () => {
                testClient.send(msg, (result) => {
                    let exceptions = _.some(result, "ex"),
                    errors = _.some(result, "err");
                    if (!exceptions && !errors) {
                        logTestResults(result);
                        resolve(result);
                    } else {
                        logError({
                            type: ERROR_TYPE.ERROR,
                            reason: "Error running all tests: " + _.find(result, "err").err
                        });
                        reject(result);
                    }
                });
            });
        }).then(() => {
            testClient.end();
        }).catch(() => {
            testClient.end();
        });
    }
};

module.exports = {
    runNamespaceTests,
    runAllTests
};