import * as vscode from 'vscode';
import * as namespace from './namespace';
import * as namespace2 from './namespace2';
import statusbar from './statusbar';
import * as state from './state';
import { getStateValue, setStateValue } from '../out/cljs-lib/cljs-lib';

function updateNeedReplUi(isNeeded: boolean, context = state.extensionContext) {
    context.workspaceState.update('needReplUi', isNeeded);
    update(context);
}

function shouldshowReplUi(context = state.extensionContext): boolean {
    return context.workspaceState.get('needReplUi') || !state.config().hideReplUi;
}

function update(context = state.extensionContext) {
    vscode.commands.executeCommand('setContext', 'calva:showReplUi', shouldshowReplUi(context));
    setStateValue('current-session-type', namespace.getReplSessionType(getStateValue('connected')));
    statusbar.update(context);
}

export default {
    update,
    updateNeedReplUi,
    shouldshowReplUi
};