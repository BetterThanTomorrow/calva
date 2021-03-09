import * as vscode from 'vscode';
import statusbar from './statusbar';
import * as state from './state';
import { getWorkspaceConfig } from './config';
import { updateReplSessionType } from './repl-session';

function updateNeedReplUi(isNeeded: boolean, context = state.extensionContext) {
    context.workspaceState.update('needReplUi', isNeeded);
    update(context);
}

function shouldshowReplUi(context = state.extensionContext): boolean {
    return context.workspaceState.get('needReplUi') || !getWorkspaceConfig().hideReplUi;
}

function update(context = state.extensionContext) {
    vscode.commands.executeCommand('setContext', 'calva:showReplUi', shouldshowReplUi(context));
    updateReplSessionType();
    statusbar.update(context);
}

export default {
    update,
    updateNeedReplUi,
    shouldshowReplUi
};