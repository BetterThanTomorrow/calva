import * as vscode from 'vscode';
import { LanguageClient, RequestType, ServerOptions, LanguageClientOptions } from 'vscode-languageclient';
import * as path from 'path';
import * as state from './state';

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
            "auto-add-ns-to-new-files?": false,
            "document-formatting?": false
        },
        middleware: {
            provideCodeLenses: async (document, token, next): Promise<vscode.CodeLens[]> => {
                if (state.config().referencesCodeLensEnabled) {
                    return await next(document, token);
                }
                return [];
            },
            resolveCodeLens: async (codeLens, token, next) => {
                if (state.config().referencesCodeLensEnabled) {
                    return await next(codeLens, token);
                }
                return null;
            },
            handleDiagnostics(uri, diagnostics, next) {
                // Disable diagnostics from clojure-lsp
                return;
            },
            provideHover(document, position, token, next) {
                // Disable hovers from clojure-lsp
                // Main issue is Java hovers: https://github.com/snoe/clojure-lsp/issues/204
                // We could possibly make Calva hover provider provide only Java hovers,
                // and clojure-lsp provide only non-Java hovers
                return null;
            },
            provideCompletionItem(document, position, context, token, next) {
                // Disable completion items from clojure-lsp
                return null;
            },
            provideSignatureHelp(document, position, context, token, next) {
                return next(document, position, context, token);
            },
            provideDocumentFormattingEdits(document, options, token, next) {
                return next(document, options, token);
            }
        }
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
    context.subscriptions.push(client.start());

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

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration('calva.referencesCodeLens.enabled')) {
            const visibleFileEditors = vscode.window.visibleTextEditors.filter(editor => {
                return editor.document.uri.scheme === 'file';
            });

            for (let editor of visibleFileEditors) {
                // Hacky solution for triggering codeLens refresh
                // Could not find a better way, aside from possibly changes to clojure-lsp
                // https://github.com/microsoft/vscode-languageserver-node/issues/705
                const edit1 = new vscode.WorkspaceEdit();
                edit1.insert(editor.document.uri, new vscode.Position(0, 0), '\n');
                await vscode.workspace.applyEdit(edit1);
                const edit2 = new vscode.WorkspaceEdit();
                edit2.delete(editor.document.uri, new vscode.Range(0, 0, 1, 0));
                await vscode.workspace.applyEdit(edit2);
            }
        }
    }));

    return client;
}

export default {
    activate
}