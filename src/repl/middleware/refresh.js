const vscode = require('vscode');
const state = require ('../../state');
const repl = require('../client');
const message = require('../message');
const {getFileType, getDocument} = require('../../utilities');

function logResults (results) {
    let reloaded = [];
    for (var r = 0; r < results.length; r++) {
        if (results[r].hasOwnProperty('reloading') && results[r].reloading.length > 0) {
            reloaded = results[r].reloading;
        }
    }
    if (reloaded.length > 0) {
        let chan = current.get('outputChannel');
        chan.clear();
        chan.appendLine("Refreshing files \n");
        chan.appendLine("----------------------------");
        for (var i = 0; i < reloaded.length; i++) {
            chan.appendLine(reloaded[i]);
        }
    }
};

function refreshChanged(document = {}) {
    let current = state.deref(),
        doc = getDocument(document);

    if(current.get('connected')) {
         client = repl.create().once('connect', () => {
            let msg = message.refresh(current.get(getFileType(doc)));
            client.send(msg, function (results) {
                logResults(results);
                client.end();
            });
        });
    }
};

function refreshAll(document = {}) {
    let current = state.deref(),
        doc = getDocument(document);
    if(current.get('connected')) {
        let client = repl.create().once('connect', () => {
            let msg = message.refreshAll(current.get(getFileType(doc)));
            client.send(msg, function (results) {
                logResults(results);
                client.end();
            });
        });
    }
};

function refreshClear(document = {}) {
    let current = state.deref(),
        doc = getDocument(document);
    if(current.get('connected')) {
        let client = repl.create().once('connect', () => {
            let msg = message.refreshClear(current.get(getFileType(doc)));
            client.send(msg, function (results) {
                let chan = current.get('outputChannel');
                    chan.clear();
                    chan.appendLine("Refresh clear: " + results[0].status[0] + " \n");
                client.end();
            });
        });
    }
};

module.exports = {
    refreshChanged,
    refreshAll,
    refreshClear
};
