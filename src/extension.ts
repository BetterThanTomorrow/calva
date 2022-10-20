import * as vscode from 'vscode';
import * as paredit from './paredit/extension';
import * as fmt from './calva-fmt/src/extension';
import * as highlight from './highlight/src/extension';
import * as state from './state';
import * as jackIn from './nrepl/jack-in';
import * as replStart from './nrepl/repl-start';
import * as util from './utilities';
import { NotebookKernel, NotebookProvider } from './NotebookProvider';
import status from './status';
import connector from './connector';
import CalvaCompletionItemProvider from './providers/completion';
import JarContentProvider from './providers/content';
import HoverProvider from './providers/hover';
import * as definition from './providers/definition';
import { CalvaSignatureHelpProvider } from './providers/signature';
import testRunner from './testRunner';
import annotations from './providers/annotations';
import * as select from './select';
import eval from './evaluate';
import refresh from './refresh';
import * as greetings from './greet';
import Analytics from './analytics';
import * as open from 'open';
import statusbar from './statusbar';
import * as debug from './debugger/calva-debug';
import * as model from './cursor-doc/model';
import * as outputWindow from './results-output/results-doc';
import * as fileSwitcher from './file-switcher/file-switcher';
import * as replHistory from './results-output/repl-history';
import * as config from './config';
import * as snippets from './custom-snippets';
import * as whenContexts from './when-contexts';
import lsp from './lsp/main';
import { setStateValue } from '../out/cljs-lib/cljs-lib';
import * as edit from './edit';
import * as nreplLogging from './nrepl/logging';
import * as converters from './converters';
import * as joyride from './joyride';
import * as api from './api/index';
import * as depsClj from './nrepl/deps-clj';
import * as clojureDocs from './clojuredocs';
import { capitalize } from './utilities';
import * as overrides from './overrides';

function onDidChangeEditorOrSelection(editor: vscode.TextEditor) {
  replHistory.setReplHistoryCommandsActiveContext(editor);
  whenContexts.setCursorContextIfChanged(editor);
}

function setKeybindingsEnabledContext() {
  const keybindingsEnabled = vscode.workspace
    .getConfiguration()
    .get(config.KEYBINDINGS_ENABLED_CONFIG_KEY);
  void vscode.commands.executeCommand(
    'setContext',
    config.KEYBINDINGS_ENABLED_CONTEXT_KEY,
    keybindingsEnabled
  );
}

function initializeState() {
  setStateValue('connected', false);
  setStateValue('connecting', false);
  setStateValue('outputChannel', vscode.window.createOutputChannel('Calva says'));
  setStateValue('connectionLogChannel', vscode.window.createOutputChannel('Calva Connection Log'));
  setStateValue(
    'diagnosticCollection',
    vscode.languages.createDiagnosticCollection('calva: Evaluation errors')
  );
}

async function activate(context: vscode.ExtensionContext) {
  console.info('Calva activate START');

  overrides.activate();

  initializeState();
  await config.updateCalvaConfigFromUserConfigEdn(false);
  await config.updateCalvaConfigFromEdn();

  status.updateNeedReplUi(false, context);

  const controller = vscode.tests.createTestController('calvaTestController', 'Calva');
  context.subscriptions.push(controller);
  testRunner.initialize(controller);

  void lsp.activate(context, (testTree) => {
    testRunner.onTestTree(controller, testTree);
  });

  setStateValue('analytics', new Analytics(context));
  state.analytics().logPath('/start').logEvent('LifeCycle', 'Started').send();

  model.initScanner(vscode.workspace.getConfiguration('editor').get('maxTokenizationLineLength'));

  const chan = state.outputChannel();

  context.subscriptions.push(
    new vscode.Disposable(() => {
      connector.disconnect();
      chan.dispose();
    })
  );

  const legacyExtension = vscode.extensions.getExtension('cospaia.clojure4vscode');
  const fmtExtension = vscode.extensions.getExtension('cospaia.calva-fmt');
  const pareEditExtension = vscode.extensions.getExtension('cospaia.paredit-revived');
  const cwExtension = vscode.extensions.getExtension('tonsky.clojure-warrior');
  const vimExtension = vscode.extensions.getExtension('vscodevim.vim');
  const clojureExtension = vscode.extensions.getExtension('avli.clojure');
  const customCljsRepl = config.getConfig().customCljsRepl;
  const replConnectSequences = config.getConfig().replConnectSequences;
  const BUTTON_GOTO_DOC = 'Open the docs';
  const BUTTON_OK = 'Got it';
  const VIM_DOC_URL = 'https://calva.io/vim/';
  const VIEWED_VIM_DOCS = 'viewedVimDocs';
  const DONT_SHOW_CLOJURE_EXT_NAG = 'dontShowClojureExtNag';
  const CONNECT_SEQUENCES_DOC_URL = 'https://calva.io/connect-sequences/';
  const CALVA_DOCS_URL = 'https://calva.io/';
  const VIEWED_CALVA_DOCS = 'viewedCalvaDocs';
  if (customCljsRepl && replConnectSequences.length == 0) {
    chan.appendLine('Old customCljsRepl settings detected.');
    void vscode.window
      .showErrorMessage(
        'Old customCljsRepl settings detected. You need to specify it using the new calva.customConnectSequence setting. See the Calva user documentation for instructions.',
        ...[BUTTON_GOTO_DOC, BUTTON_OK]
      )
      .then((v) => {
        if (v == BUTTON_GOTO_DOC) {
          open(CONNECT_SEQUENCES_DOC_URL).catch(() => {
            // do nothing
          });
        }
      });
  }

  if (legacyExtension) {
    void vscode.window.showErrorMessage(
      'Calva Legacy extension detected. Things will break. Please uninstall, or disable, the old Calva extension.',
      'Roger that. Right away!'
    );
  }

  state.setExtensionContext(context);
  state.initDepsEdnJackInExecutable();
  void depsClj.downloadDepsClj(context.extensionPath);

  if (!fmtExtension) {
    try {
      void fmt.activate(context);
    } catch (e) {
      console.error('Failed activating Formatter: ' + e.message);
    }
  } else {
    void vscode.window.showErrorMessage(
      'Calva Format extension detected, which will break things. Please uninstall or, disable, it before continuing using Calva.',
      'Got it. Will do!'
    );
  }
  if (!pareEditExtension) {
    try {
      paredit.activate(context);
    } catch (e) {
      console.error('Failed activating Paredit: ' + e.message);
    }
  } else {
    void vscode.window.showErrorMessage(
      'Calva Paredit extension detected, which will cause problems. Please uninstall, or disable, it.',
      'I hear ya. Doing it!'
    );
  }

  status.update(context);

  // Initial set of the provided contexts
  outputWindow.setContextForOutputWindowActive(false);
  void vscode.commands.executeCommand('setContext', 'calva:launching', false);
  void vscode.commands.executeCommand('setContext', 'calva:connected', false);
  void vscode.commands.executeCommand('setContext', 'calva:connecting', false);
  setKeybindingsEnabledContext();

  // COMMANDS
  const commands = {
    clearInlineResults: annotations.clearEvaluationDecorations,
    clearReplHistory: replHistory.clearHistory,
    connect: connector.connectCommand,
    connectNonProjectREPL: () => void connector.connectNonProjectREPLCommand(context),
    continueComment: edit.continueCommentCommand,
    convertDart2Clj: converters.dart2clj,
    convertJs2Cljs: converters.js2cljs,
    copyAnnotationHoverText: annotations.copyHoverTextCommand,
    copyJackInCommandToClipboard: jackIn.copyJackInCommandToClipboard,
    copyLastResults: eval.copyLastResultCommand,
    'debug.instrument': eval.instrumentTopLevelForm,
    'diagnostics.toggleNreplLoggingEnabled': nreplLogging.toggleEnabled,
    disconnect: jackIn.calvaDisconnect,
    evaluateCurrentTopLevelForm: eval.evaluateTopLevelForm,
    evaluateEnclosingForm: eval.evaluateEnclosingForm,
    evaluateOutputWindowForm: eval.evaluateOutputWindowForm,
    evaluateSelection: eval.evaluateCurrentForm,
    evaluateSelectionAsComment: eval.evaluateSelectionAsComment,
    evaluateSelectionReplace: eval.evaluateSelectionReplace,
    evaluateSelectionToSelectionEnd: eval.evaluateToCursor,
    evaluateStartOfFileToCursor: eval.evaluateStartOfFileToCursor,
    evaluateToCursor: eval.evaluateToCursor,
    evaluateTopLevelFormAsComment: eval.evaluateTopLevelFormAsComment,
    evaluateTopLevelFormToCursor: eval.evaluateTopLevelFormToCursor,
    evaluateUser: eval.evaluateUser,
    interruptAllEvaluations: eval.interruptAllEvaluations,
    jackIn: jackIn.jackInCommand,
    loadFile: async () => {
      await eval.loadFile({}, config.getConfig().prettyPrintingOptions);
      return new Promise((resolve) => {
        outputWindow.appendPrompt(resolve);
      });
    },
    openCalvaDocs: () => {
      void context.globalState.update(VIEWED_CALVA_DOCS, true);
      open(CALVA_DOCS_URL)
        .then(() => {
          state.analytics().logEvent('Calva', 'Docs opened');
        })
        .catch((e) => {
          console.error(`Problems visiting calva docs: ${e}`);
        });
    },
    openUserConfigEdn: config.openCalvaConfigEdn,
    prettyPrintReplaceCurrentForm: edit.prettyPrintReplaceCurrentForm,
    printClojureDocsToOutputWindow: clojureDocs.printClojureDocsToOutputWindow,
    printClojureDocsToRichComment: clojureDocs.printClojureDocsToRichComment,
    printLastStacktrace: () => {
      outputWindow.printLastStacktrace();
      outputWindow.appendPrompt();
    },
    printTextToOutputWindowCommand: clojureDocs.printTextToOutputWindowCommand,
    printTextToRichCommentCommand: clojureDocs.printTextToRichCommentCommand,
    refresh: refresh.refresh,
    refreshAll: refresh.refreshAll,
    requireREPLUtilities: eval.requireREPLUtilitiesCommand,
    rereadUserConfigEdn: config.updateCalvaConfigFromUserConfigEdn,
    rerunTests: () => testRunner.rerunTestsCommand(controller),
    runAllTests: () => testRunner.runAllTestsCommand(controller),
    runCustomREPLCommand: snippets.evaluateCustomCodeSnippetCommand,
    runNamespaceTests: () => testRunner.runNamespaceTestsCommand(controller),
    runTestUnderCursor: () => testRunner.runTestUnderCursorCommand(controller),
    selectCurrentForm: select.selectCurrentForm,
    sendCurrentFormToOutputWindow: outputWindow.appendCurrentForm,
    sendCurrentTopLevelFormToOutputWindow: outputWindow.appendCurrentTopLevelForm,
    setOutputWindowNamespace: outputWindow.setNamespaceFromCurrentFile,
    showFileForOutputWindowNS: () => void outputWindow.revealDocForCurrentNS(false),
    showNextReplHistoryEntry: replHistory.showNextReplHistoryEntry,
    showOutputWindow: () => outputWindow.revealResultsDoc(false),
    showPreviousReplHistoryEntry: replHistory.showPreviousReplHistoryEntry,
    startJoyrideReplAndConnect: async () => {
      const projectDir: string = await joyride.prepareForJackingOrConnect();
      if (projectDir !== undefined) {
        void joyride.joyrideJackIn(projectDir);
      }
    },
    startOrConnectRepl: replStart.startOrConnectRepl,
    startStandaloneCljsBrowserRepl: () =>
      void replStart.startStandaloneRepl(context, replStart.HELLO_CLJS_BROWSER_TEMPLATE, false),
    startStandaloneCljsNodeRepl: () =>
      void replStart.startStandaloneRepl(context, replStart.HELLO_CLJS_NODE_TEMPLATE, false),
    startStandaloneHelloRepl: () =>
      void replStart.startStandaloneRepl(context, replStart.HELLO_TEMPLATE, false),
    startStandaloneRepl: () =>
      void replStart.startStandaloneRepl(context, replStart.USER_TEMPLATE, true),
    switchCljsBuild: connector.switchCljsBuild,
    tapCurrentTopLevelForm: () =>
      snippets.evaluateCustomCodeSnippetCommand('(tap> $top-level-form)'),
    tapSelection: () => snippets.evaluateCustomCodeSnippetCommand('(tap> $current-form)'),
    toggleBetweenImplAndTest: () => void fileSwitcher.toggleBetweenImplAndTest(),
    toggleCLJCSession: connector.toggleCLJCSession,
    toggleEvaluationSendCodeToOutputWindow: eval.toggleEvaluationSendCodeToOutputWindow,
    toggleKeybindingsEnabled: () => {
      const keybindingsEnabled = vscode.workspace
        .getConfiguration()
        .get(config.KEYBINDINGS_ENABLED_CONFIG_KEY);
      void vscode.workspace
        .getConfiguration()
        .update(
          config.KEYBINDINGS_ENABLED_CONFIG_KEY,
          !keybindingsEnabled,
          vscode.ConfigurationTarget.Global
        );
    },
    togglePrettyPrint: eval.togglePrettyPrint,
  };

  function registerCalvaCommand([command, callback]) {
    const calvaCmd = `calva.${command}`;
    context.subscriptions.push(vscode.commands.registerCommand(calvaCmd, callback));
  }

  Object.entries(commands).forEach(registerCalvaCommand);

  // PROVIDERS
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('jar', new JarContentProvider())
  );

  const languageProviders = {
    completionItemProvider: {
      provider: new CalvaCompletionItemProvider(),
    },
    definitionProvider: [
      {
        provider: new definition.ClojureDefinitionProvider(),
      },
      {
        provider: new definition.StackTraceDefinitionProvider(),
      },
    ],
    hoverProvider: {
      provider: new HoverProvider(),
    },
    signatureHelpProvider: {
      provider: new CalvaSignatureHelpProvider(),
      registerArgs: [' '],
    },
  };

  function registerLangProvider([service, providers]) {
    providers = Array.isArray(providers) ? providers : [providers];
    const register = `register${capitalize(service)}`;

    providers.forEach(({ provider, registerArgs = [] }) => {
      context.subscriptions.push(
        vscode.languages[register](config.documentSelector, provider, ...registerArgs)
      );
    });
  }

  Object.entries(languageProviders).forEach(registerLangProvider);

  //EVENTS
  const onDidEvents = {
    workspace: {
      saveTextDocument: async (document: vscode.TextDocument) => {
        const { evalOnSave, testOnSave } = config.getConfig();

        if (document.languageId !== 'clojure') {
          return;
        }

        if (evalOnSave) {
          if (!outputWindow.isResultsDoc(document)) {
            await eval.loadFile(document, config.getConfig().prettyPrintingOptions);
            outputWindow.appendPrompt();
            state.analytics().logEvent('Calva', 'OnSaveLoad').send();
          }
        }

        if (testOnSave && util.getConnectedState()) {
          void testRunner.runNamespaceTests(controller, document);
          state.analytics().logEvent('Calva', 'OnSaveTest').send();
        }
      },
      changeTextDocument: annotations.onDidChangeTextDocument,
      closeTextDocument: (document) => {
        if (outputWindow.isResultsDoc(document)) {
          outputWindow.setContextForOutputWindowActive(false);
        }
      },
      changeConfiguration: (e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration(config.KEYBINDINGS_ENABLED_CONFIG_KEY)) {
          setKeybindingsEnabledContext();
          statusbar.update();
        }
      },
    },
    window: {
      changeActiveTextEditor: (editor) => {
        status.update();
        onDidChangeEditorOrSelection(editor);
      },
      changeTextEditorSelection: (event) => onDidChangeEditorOrSelection(event.textEditor),
      changeVisibleTextEditors: (editors) => {
        if (!editors.some((editor) => outputWindow.isResultsDoc(editor.document))) {
          outputWindow.setContextForOutputWindowActive(false);
        }
      },
    },
  };

  function registerOnDidEventHandler(scope) {
    return ([eventName, callback]) => {
      const event = `onDid${capitalize(eventName)}`;
      context.subscriptions.push(vscode[scope][event](callback));
    };
  }

  Object.entries(onDidEvents).forEach(([scope, handlers]) =>
    Object.entries(handlers).forEach(registerOnDidEventHandler(scope))
  );

  // Clojure debug adapter setup
  const provider = new debug.CalvaDebugConfigurationProvider();
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(debug.CALVA_DEBUG_CONFIGURATION.type, provider)
  );
  const factory = new debug.CalvaDebugAdapterDescriptorFactory();
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      debug.CALVA_DEBUG_CONFIGURATION.type,
      factory
    )
  );
  if ('dispose' in factory) {
    context.subscriptions.push(factory);
  }
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer('calva-clojure-notebook', new NotebookProvider(), {
      transientOutputs: true,
    })
  );
  context.subscriptions.push(new NotebookKernel());

  void vscode.commands.executeCommand('setContext', 'calva:activated', true);

  greetings.activationGreetings(chan);

  if (vimExtension) {
    chan.appendLine(`VIM Extension detected. Please read: ${VIM_DOC_URL} now and then.\n`);
    if (!context.globalState.get(VIEWED_VIM_DOCS)) {
      void vscode.window
        .showErrorMessage(
          'VIM Extension detected. Please view the docs for tips (and to stop this info box from appearing).',
          ...[BUTTON_GOTO_DOC]
        )
        .then((v) => {
          if (v == BUTTON_GOTO_DOC) {
            void context.globalState.update(VIEWED_VIM_DOCS, true);
            open(VIM_DOC_URL).catch(() => {
              // do nothing
            });
          }
        });
    }
  }

  if (clojureExtension) {
    chan.appendLine(`The Clojure Extension is installed.\n`);
    if (!context.globalState.get(DONT_SHOW_CLOJURE_EXT_NAG)) {
      void vscode.window
        .showWarningMessage(
          'You have the Clojure extension installed. Please note that it will conflict with Calva.',
          "Don't show again",
          'OK'
        )
        .then((v) => {
          if (v == "Don't show again") {
            void context.globalState.update(DONT_SHOW_CLOJURE_EXT_NAG, true);
          }
        });
    }
  }

  state.analytics().logPath('/activated').logEvent('LifeCycle', 'Activated').send();

  if (!cwExtension) {
    try {
      highlight.activate(context);
    } catch (e) {
      console.error('Failed activating Highlight: ' + e.message);
    }
  } else {
    void vscode.window.showErrorMessage(
      "Clojure Warrior extension detected. This will not work well together with Calva's highlighting (which is an improvement on Clojure Warrior). Please uninstall/disable it.",
      ...['Got it.', 'Will do!']
    );
  }

  console.info('Calva activate END');

  return api.getApi();
}

function deactivate(): Promise<void> | undefined {
  state.analytics().logEvent('LifeCycle', 'Deactivated').send();
  jackIn.calvaJackout();
  paredit.deactivate();
  return lsp.deactivate();
}

export { activate, deactivate };
