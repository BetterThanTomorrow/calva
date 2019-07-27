import * as vscode from 'vscode';
import * as impl from './impl';

function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('calva.artifactVersions', impl.artifactVersions));
    context.subscriptions.push(vscode.commands.registerCommand('calva.cleanNS', impl.cleanNS));
}

export default {
    activate
}