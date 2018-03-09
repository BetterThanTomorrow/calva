const _ = require('lodash');
const state = require('../../state');
const repl = require('../client');
const message = require('../message');
const {
    evaluateText
} = require('./evaluate');
const {
    getDocument,
    getNamespace,
    getFileType,
    logSuccess,
    logTestResults,
    logError,
    logWarning,
    ERROR_TYPE,
} = require('../../utilities');

function runTests(msg, startStr, errorStr, document = {}) {
    let current = state.deref(),
        doc = getDocument(document),
        session = current.get(getFileType(doc));

    if (current.get('connected')) {
        chan = current.get('outputChannel');
        chan.clear();
        chan.appendLine(startStr);
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
                            reason: "Error " + errorStr + ":" + _.find(result, "err").err
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
}

function runAllTests(document = {}) {
    let current = state.deref(),
        doc = getDocument(document),
        session = current.get(getFileType(doc)),
        msg = message.testAll(session);

    runTests(msg, "Running all tests", "running all tests");
};

function runNamespaceTests(document = {}) {
    let current = state.deref(),
        doc = getDocument(document),
        session = current.get(getFileType(doc)),
        msg = message.test(session, getNamespace(doc.getText()));

    runTests(msg, "Running tests", "running tests");
};

module.exports = {
    runNamespaceTests,
    runAllTests
};