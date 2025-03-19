import * as messages from './messages';
import { provideSignatureHelp } from '../../providers/signature';
import { provideHover } from '../../providers/hover';
import { isResultsDoc } from '../../repl-window/repl-doc';
import * as vscode_lsp from 'vscode-languageclient/node';
import * as defs from '../definitions';
import * as config from '../../config';
import * as utils from '../utils';
import * as vscode from 'vscode';
import * as path from 'path';
import { getClientProvider } from '../state';
import * as tokenFilter from './semantic-token-filter';
import * as api from '../api';

/**
 * This can potentially be used to replace or alter the automatic command instrumentation performed by the
 * LSP client and is being left in here as reference in case we want to return to this problem in the
 * future.
 *
 * Specifically, this might be able to replace the `disableBuiltInExecuteCommandFeature` hack below, or, it
 * might be used in combination thereof to replace the manual command registrations applied by Calva.
 *
 * The capabilities data given to the initialize function contains a server-provided list of all available
 * commands. This list can be used to register, in a conflict-free way, the missing commands.
 */
// class ExecuteCommandDisablement implements vscode_lsp.DynamicFeature<any> {
//   initialize() {}

//   fillClientCapabilities(capabilities: vscode_lsp.ClientCapabilities): void {
//     capabilities.workspace.executeCommand.dynamicRegistration = true;
//   }

//   dispose() {}

//   public getState(): vscode_lsp.FeatureState {
//     return {
//       kind: 'workspace',
//       id: vscode_lsp.ExecuteCommandRequest.type.method,
//       registrations: false,
//     };
//   }

//   public get registrationType() {
//     return vscode_lsp.ExecuteCommandRequest.type;
//   }

//   register() {}
//   unregister() {}
// }

/**
 * This is a super nasty hack to remove the automatically registered commands from vscode because running multiple
 * language clients in the same window will cause command registration conflicts.
 *
 * I initially tried to replace the builtin feature by registering the `ExecuteCommandDisablement` implementation
 * defined and commented above but it just runs in parallel (it doesn't replace the builtin).
 *
 * I am sure there must be a better way to disable the automatic command registration but I just can't find it
 * right now.
 *
 * This hack was derived by looking at the implementation of the builtin `ExecuteCommandFeature` which can be found
 * here: https://github.com/microsoft/vscode-languageserver-node/blob/84b4af76874ef32a0edb62e33dd2ad9a700c33ea/client/src/common/executeCommand.ts
 *
 * As far as my current understanding goes disabling this automatic registration is safe as we anyway explicitly
 * register LSP commands to take care of the functionality managed by this automatic registration.
 */
const disableBuiltInExecuteCommandFeature = (client: vscode_lsp.LanguageClient) => {
  const feature = client.getFeature(vscode_lsp.ExecuteCommandRequest.type.method as any);
  feature.initialize = () => {
    // do nothing
  };
  feature.register = () => {
    // do nothing
  };
};

// The Node LSP client requires the client code to jump through a few hoops in
// order to enable an experimental feature. This class exists solely to
// enable the `experimental.testTree` feature.
class TestTreeFeature implements vscode_lsp.StaticFeature {
  initialize() {
    // do nothing
  }

  fillClientCapabilities(capabilities: vscode_lsp.ClientCapabilities): void {
    capabilities.experimental = { testTree: true };
  }

  dispose(): void {
    // do nothing
  }

  getState(): vscode_lsp.FeatureState {
    return { kind: 'static' };
  }
}

// Cache for semantic token type, so we don't need to hit the LSP server every time
let commentTokenType: number | null = null;

type CreateClientParams = {
  lsp_server_path: string;
  uri: vscode.Uri;
  id: string;
};
export const createClient = (params: CreateClientParams): defs.LspClient => {
  // Run JARs with system Java; anything else execute directly
  let serverOptions: vscode_lsp.ServerOptions;
  if (path.extname(params.lsp_server_path) === '.jar') {
    serverOptions = {
      command: path.join(process.env.JAVA_HOME, 'bin', 'java'),
      args: ['-jar', params.lsp_server_path],
    };
  } else {
    serverOptions = {
      command: params.lsp_server_path,
    };
  }

  const client = new vscode_lsp.LanguageClient(
    'clojure',
    'Clojure Language Client',
    serverOptions,
    {
      workspaceFolder: {
        uri: params.uri,
        name: params.id,
        index: 0,
      },
      documentSelector: [
        { scheme: 'file', language: 'clojure' },
        { scheme: 'jar', language: 'clojure' },
      ],
      synchronize: {
        configurationSection: 'clojure-lsp',
        fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc'),
      },
      errorHandler: {
        error: (err, message) => {
          console.error('Clojure-lsp languageclient failed to start', err, message);
          return {
            action: vscode_lsp.ErrorAction.Shutdown,
          };
        },
        closed: () => {
          console.error('Clojure-lsp languageclient failed due to an interrupted connection');
          return {
            action: vscode_lsp.CloseAction.DoNotRestart,
          };
        },
      },
      progressOnInitialization: false,
      initializationOptions: {
        'dependency-scheme': 'jar',
        'auto-add-ns-to-new-files?': true,
        'document-formatting?': false,
        'document-range-formatting?': false,
      },
      middleware: {
        didOpen: (document, next) => {
          if (isResultsDoc(document)) {
            return Promise.resolve();
          }
          return next(document);
        },
        didSave: (document, next) => {
          if (isResultsDoc(document)) {
            return Promise.resolve();
          }
          return next(document);
        },
        didChange: (change, next) => {
          if (isResultsDoc(change.document)) {
            return Promise.resolve();
          }
          return next(change);
        },
        provideLinkedEditingRange: (_document, _position, _token, _next): null => {
          return null;
        },
        async provideHover(document, position, token, next) {
          const hovers = await provideHover(getClientProvider(), document, position);
          if (hovers) {
            return null;
          } else {
            return next(document, position, token);
          }
        },
        handleDiagnostics(uri, diagnostics, next) {
          if (uri.path.endsWith(config.REPL_FILE_EXT)) {
            return;
          }
          return next(uri, diagnostics);
        },
        provideCodeActions(document, range, context, token, next) {
          return next(document, range, context, token);
        },
        provideCodeLenses: async (document, token, next): Promise<vscode.CodeLens[]> => {
          if (config.getConfig().referencesCodeLensEnabled) {
            return await next(document, token);
          }
          return [];
        },
        resolveCodeLens: async (codeLens, token, next) => {
          if (config.getConfig().referencesCodeLensEnabled) {
            return await next(codeLens, token);
          }
          return null;
        },
        provideDefinition(_document, _position, _token, _next) {
          return null;
        },
        provideCompletionItem(_document, _position, _context, _token, _next) {
          return null;
        },
        provideDocumentSemanticTokens: async (
          document: vscode.TextDocument,
          token: vscode.CancellationToken,
          next: (
            document: vscode.TextDocument,
            token: vscode.CancellationToken
          ) => Thenable<vscode.SemanticTokens> | vscode.SemanticTokens | null
        ) => {
          const result = await next(document, token);
          if (!result) {
            return result;
          }
          if (!commentTokenType) {
            try {
              const serverTokens = await api.getSemanticTokens(client);
              console.debug('lsp serverTokens:', serverTokens);
              commentTokenType = serverTokens?.indexOf('comment') || 10;
            } catch (e) {
              console.error('Failed to get semantic tokens from server:', e);
              commentTokenType = 10;
            }
          }

          const filterTokens = (tokens: vscode.SemanticTokens) => {
            const data = new Uint32Array(tokens.data);
            const filteredData = tokenFilter.filterCommentTokens(data, commentTokenType);
            return new vscode.SemanticTokens(new Uint32Array(filteredData));
          };

          return filterTokens(result);
        },
        async provideSignatureHelp(document, position, context, token, next) {
          const help = await provideSignatureHelp(document, position, token);
          if (help) {
            return null;
          } else {
            return next(document, position, context, token);
          }
        },
      },
    }
  );

  disableBuiltInExecuteCommandFeature(client);

  const testTree = new TestTreeFeature();
  client.registerFeature(testTree);

  // client.registerFeature(new ExecuteCommandDisablement());

  client.onRequest('window/showMessageRequest', messages.handleShowMessageRequest);

  void client.start().catch((err) => {
    console.error('Client failed to start', err);
  });

  return {
    id: params.id,
    uri: params.uri,
    client,
    get status() {
      return utils.lspClientStateToStatus(client.state);
    },
  };
};
