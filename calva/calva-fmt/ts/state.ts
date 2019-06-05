import * as vscode from 'vscode';
import * as Immutable from 'immutable';
import * as ImmutableCursor from 'immutable-cursor';

const mode = {
    language: 'clojure',
    //scheme: 'file'
};

var data;
const initialData = {
    documents: {}
};

reset();

const cursor = ImmutableCursor.from(data, [], (nextState) => {
    data = Immutable.fromJS(nextState);
});

function deref() {
    return data;
}

function reset() {
    data = Immutable.fromJS(initialData);
}

function config() {
    let configOptions = vscode.workspace.getConfiguration('calva.fmt');
    return {
        parinferOnSelectionChange: configOptions.get("inferParensOnCursorMove"),
    };
}

export {
    cursor,
    mode,
    deref,
    reset,
    config
};
