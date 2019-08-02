import * as vscode from 'vscode';
import * as impl from './impl';
import CalvaReferenceProvider from "./providers/reference";
import CalvaCodeActionProvider from "./providers/codeAction";
import * as state from '../state';

function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('calva.artifactVersions', impl.artifactVersions));
    context.subscriptions.push(vscode.commands.registerCommand('calva.cleanNS', impl.cleanNS));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(state.mode, new CalvaReferenceProvider()));
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(state.mode, new CalvaCodeActionProvider()));
}

export default {
    activate
}