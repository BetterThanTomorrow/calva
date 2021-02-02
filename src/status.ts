import * as vscode from 'vscode';
import * as namespace from './namespace';
import statusbar from './statusbar';
import * as state from './state';

function updateNeedREPLUi(isNeeded: boolean, context = state.extensionContext) {
    context.workspaceState.update('needREPLUi', isNeeded);
    update(context);
}

function shouldShowREPLUi(context = state.extensionContext): boolean {
    return context.workspaceState.get('needREPLUi') || !state.config().hideREPLUi;
}

function update(context = state.extensionContext) {
    vscode.commands.executeCommand('setContext', 'calva:showREPLUi', shouldShowREPLUi(context));
    namespace.updateREPLSessionType();
    statusbar.update(context);
}

export default {
    update,
    updateNeedREPLUi,
    shouldShowREPLUi
};