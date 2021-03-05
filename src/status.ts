import * as vscode from 'vscode';
import statusbar from './statusbar';
import * as state from './state';
import * as util from './utilities';

function updateNeedReplUi(isNeeded: boolean, context = state.extensionContext) {
    context.workspaceState.update('needReplUi', isNeeded);
    update(context);
}

function shouldshowReplUi(context = state.extensionContext): boolean {
    return context.workspaceState.get('needReplUi') || !state.config().hideReplUi;
}

function update(context = state.extensionContext) {
    vscode.commands.executeCommand('setContext', 'calva:showReplUi', shouldshowReplUi(context));
    util.updateReplSessionType();
    statusbar.update(context);
}

export default {
    update,
    updateNeedReplUi,
    shouldshowReplUi
};