import * as vscode from 'vscode';
import { LanguageClient, RequestType, ServerOptions, LanguageClientOptions } from 'vscode-languageclient';
import * as path from 'path';

function createClient(jarPath: string): LanguageClient {
    const serverOptions: ServerOptions = {
        run: { command: 'java', args: ['-jar', jarPath] },
        debug: { command: 'java', args: ['-jar', jarPath] },
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'clojure' }],
        synchronize: {
            configurationSection: 'clojure-lsp',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        },
        initializationOptions: {
            "dependency-scheme": "jar",
            // LSP-TODO: Use lsp's feature and remove Calva's feature for this 
            "auto-add-ns-to-new-files?": false
        },
    };
    return new LanguageClient(
        'clojure',
        'Clojure Language Client',
        serverOptions,
        clientOptions
    );
}

function activate(context: vscode.ExtensionContext): LanguageClient {
    const jarPath = path.join(context.extensionPath, 'clojure-lsp.jar');
    const client = createClient(jarPath);
    client.start();

    const jarEventEmitter: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter();
    const contentsRequest = new RequestType<string, string, string, vscode.CancellationToken>('clojure/dependencyContents');
    const textDocumentContentProvider: vscode.TextDocumentContentProvider = {
        onDidChange: jarEventEmitter.event,
        provideTextDocumentContent: async (uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> => {
            const v = await client.sendRequest<any, string, string, vscode.CancellationToken>(contentsRequest,
                { uri: decodeURIComponent(uri.toString()) },
                token);
            return v || '';
        }
    };
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('jar', textDocumentContentProvider));

    // The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens above a symbol
    context.subscriptions.push(vscode.commands.registerCommand('code-lens-references', async (_, line, character) => {
        vscode.window.activeTextEditor.selection = new vscode.Selection(line - 1, character - 1, line - 1, character - 1);
        await vscode.commands.executeCommand('editor.action.referenceSearch.trigger');
    }));

    return client;
}

export default {
    activate
}