import vscode from 'vscode';
import Immutable from 'immutable';
import ImmutableCursor from 'immutable-cursor';

const mode = {
  language: 'clojure',
  //scheme: 'file'
};

let data;
const initialData = {
  documents: {},
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
  const configOptions = vscode.workspace.getConfiguration('calva.fmt');
  return {
    parinferOnSelectionChange: configOptions.get('inferParensOnCursorMove'),
  };
}

export { cursor, mode, deref, reset, config };
