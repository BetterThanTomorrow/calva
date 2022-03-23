import * as vscode from 'vscode';
import statusbar from './statusbar';
import * as state from './state';
import { getConfig } from './config';
import { updateReplSessionType } from './nrepl/repl-session';

function updateNeedReplUi(isNeeded: boolean, context = state.extensionContext) {
  void context.workspaceState.update('needReplUi', isNeeded);
  update(context);
}

function shouldshowReplUi(context = state.extensionContext): boolean {
  return context.workspaceState.get('needReplUi') || !getConfig().hideReplUi;
}

function update(context = state.extensionContext) {
  void vscode.commands.executeCommand('setContext', 'calva:showReplUi', shouldshowReplUi(context));
  updateReplSessionType();
  statusbar.update(context);
}

export default {
  update,
  updateNeedReplUi,
  shouldshowReplUi,
};
