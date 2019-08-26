import * as vscode from 'vscode';
import * as Immutable from 'immutable';
import * as ImmutableCursor from 'immutable-cursor';
import Analytics from './analytics';
import { ReplConnectSequence } from './nrepl/connectSequence'

let extensionContext: vscode.ExtensionContext;
export function setExtensionContext(context: vscode.ExtensionContext) {
    extensionContext = context;
    if (context.workspaceState.get('selectedCljTypeName') == undefined) {
        context.workspaceState.update('selectedCljTypeName', "unknown");
    }
}

const mode = {
    language: 'clojure',
    //scheme: 'file'
};
var data;
const initialData = {
    hostname: null,
    port: null,
    clj: null,
    cljs: null,
    cljsBuild: null,
    terminal: null,
    connected: false,
    connecting: false,
    outputChannel: vscode.window.createOutputChannel("Calva says"),
    connectionLogChannel: vscode.window.createOutputChannel("Calva Connection Log"),
    diagnosticCollection: vscode.languages.createDiagnosticCollection('calva: Evaluation errors'),
    analytics: null
};

reset();

const cursor = ImmutableCursor.from(data, [], (nextState) => {
    data = Immutable.fromJS(nextState);
});

function deref() {
    return data;
}

// Super-quick fix for: https://github.com/BetterThanTomorrow/calva/issues/144
// TODO: Revisit the whole state management business.
function _outputChannel(name: string): vscode.OutputChannel {
    const channel = deref().get(name);
    if (channel.toJS !== undefined) {
        return channel.toJS();
    } else {
        return channel;
    }
}

function outputChannel(): vscode.OutputChannel {
    return _outputChannel('outputChannel');
}

function connectionLogChannel(): vscode.OutputChannel {
    return _outputChannel('connectionLogChannel');
}

function analytics(): Analytics {
    const analytics = deref().get('analytics');
    if (analytics.toJS !== undefined) {
        return analytics.toJS();
    } else {
        return analytics;
    }
}


function reset() {
    data = Immutable.fromJS(initialData);
}

function config() {
    let configOptions = vscode.workspace.getConfiguration('calva');
    return {
        format: configOptions.get("formatOnSave"),
        evaluate: configOptions.get("evalOnSave"),
        lint: configOptions.get("lintOnSave"),
        test: configOptions.get("testOnSave"),
        jokerPath: configOptions.get("jokerPath"),
        useWSL: configOptions.get("useWSL"),
        syncReplNamespaceToCurrentFile: configOptions.get("syncReplNamespaceToCurrentFile"),
        jackInEnv: configOptions.get("jackInEnv"),
        openBrowserWhenFigwheelStarted: configOptions.get("openBrowserWhenFigwheelStarted") as boolean,
        customCljsRepl: configOptions.get("customCljsRepl", null),
        replConnectSequences: configOptions.get("replConnectSequences") as ReplConnectSequence[]
    };
}

export {
    cursor,
    mode,
    deref,
    reset,
    config,
    extensionContext,
    outputChannel,
    connectionLogChannel,
    analytics
};
