import * as vscode from 'vscode';
import * as fiddleFilesUtil from './util/fiddle-files';
import * as state from './state';
import * as config from './config';

export function updateFiddleFileOpenedContext(editor: vscode.TextEditor) {
  if (!editor || !editor.document || editor.document.languageId !== 'clojure') {
    return;
  }
  void vscode.commands.executeCommand(
    'setContext',
    'calva:activeEditorIsFiddle',
    fiddleFilesUtil.isFiddleFile(
      editor.document.fileName,
      state.getProjectRootUri().fsPath,
      config.getConfig().fiddleFilePaths
    )
  );
}
