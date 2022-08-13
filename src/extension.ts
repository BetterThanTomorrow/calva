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
import select from './select';
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

import * as clojureDocs from './clojuredocs';
async function onDidSave(testController: vscode.TestController, document: vscode.TextDocument) {
  const { evaluate, test } = config.getConfig();

  if (document.languageId !== 'clojure') {
    return;
  }

  if (test && util.getConnectedState()) {
    void testRunner.runNamespaceTests(testController, document);
    state.analytics().logEvent('Calva', 'OnSaveTest').send();
  } else if (evaluate) {
    if (!outputWindow.isResultsDoc(document)) {
      await eval.loadFile(document, config.getConfig().prettyPrintingOptions);
      outputWindow.appendPrompt();
      state.analytics().logEvent('Calva', 'OnSaveLoad').send();
    }
  }
}

function onDidOpen(document) {
  if (document.languageId !== 'clojure') {
    return;
  }
}

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
  initializeState();
  await config.readEdnWorkspaceConfig();

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

  // COMMANDS
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.startJoyrideReplAndConnect', async () => {
      const projectDir: string = await joyride.prepareForJackingOrConnect();
      if (projectDir !== undefined) {
        void joyride.joyrideJackIn(projectDir);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.startOrConnectRepl', replStart.startOrConnectRepl)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.startStandaloneRepl', () => {
      void replStart.startStandaloneRepl(context, replStart.USER_TEMPLATE, true);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.startStandaloneHelloRepl', () => {
      void replStart.startStandaloneRepl(context, replStart.HELLO_TEMPLATE, false);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.startStandaloneCljsBrowserRepl', () => {
      void replStart.startStandaloneRepl(context, replStart.HELLO_CLJS_BROWSER_TEMPLATE, false);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.startStandaloneCljsNodeRepl', () => {
      void replStart.startStandaloneRepl(context, replStart.HELLO_CLJS_NODE_TEMPLATE, false);
    })
  );
  context.subscriptions.push(vscode.commands.registerCommand('calva.jackIn', jackIn.jackInCommand));
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.copyJackInCommandToClipboard',
      jackIn.copyJackInCommandToClipboard
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.connectNonProjectREPL', () => {
      void connector.connectNonProjectREPLCommand(context);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.connect', connector.connectCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.disconnect', jackIn.calvaDisconnect)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.toggleCLJCSession', connector.toggleCLJCSession)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.switchCljsBuild', connector.switchCljsBuild)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.selectCurrentForm', select.selectCurrentForm)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.loadFile', async () => {
      await eval.loadFile({}, config.getConfig().prettyPrintingOptions);
      return new Promise((resolve) => {
        outputWindow.appendPrompt(resolve);
      });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.interruptAllEvaluations', eval.interruptAllEvaluations)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.evaluateSelection', eval.evaluateCurrentForm)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.evaluateEnclosingForm', eval.evaluateEnclosingForm)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.evaluateToCursor', eval.evaluateToCursor)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.evaluateTopLevelFormToCursor',
      eval.evaluateTopLevelFormToCursor
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.evaluateStartOfFileToCursor',
      eval.evaluateStartOfFileToCursor
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.evaluateUser', eval.evaluateUser)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.evaluateCurrentTopLevelForm', eval.evaluateTopLevelForm)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.evaluateOutputWindowForm', eval.evaluateOutputWindowForm)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.evaluateSelectionReplace', eval.evaluateSelectionReplace)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.evaluateSelectionAsComment',
      eval.evaluateSelectionAsComment
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.evaluateTopLevelFormAsComment',
      eval.evaluateTopLevelFormAsComment
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.togglePrettyPrint', eval.togglePrettyPrint)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.toggleEvaluationSendCodeToOutputWindow',
      eval.toggleEvaluationSendCodeToOutputWindow
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.runTestUnderCursor', () => {
      testRunner.runTestUnderCursorCommand(controller);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.runNamespaceTests', () => {
      testRunner.runNamespaceTestsCommand(controller);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.runAllTests', () => {
      testRunner.runAllTestsCommand(controller);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.rerunTests', () => {
      testRunner.rerunTestsCommand(controller);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.clearInlineResults',
      annotations.clearEvaluationDecorations
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.copyAnnotationHoverText',
      annotations.copyHoverTextCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.copyLastResults', eval.copyLastResultCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.requireREPLUtilities', eval.requireREPLUtilitiesCommand)
  );
  context.subscriptions.push(vscode.commands.registerCommand('calva.refresh', refresh.refresh));
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.refreshAll', refresh.refreshAll)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.debug.instrument', eval.instrumentTopLevelForm)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.runCustomREPLCommand',
      snippets.evaluateCustomCodeSnippetCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.tapSelection', () =>
      snippets.evaluateCustomCodeSnippetCommand('(tap> $current-form)')
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.tapCurrentTopLevelForm', () =>
      snippets.evaluateCustomCodeSnippetCommand('(tap> $top-level-form)')
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.showOutputWindow', () => {
      outputWindow.revealResultsDoc(false);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.showFileForOutputWindowNS', () => {
      void outputWindow.revealDocForCurrentNS(false);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.toggleBetweenImplAndTest', () => {
      void fileSwitcher.toggleBetweenImplAndTest();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.setOutputWindowNamespace',
      outputWindow.setNamespaceFromCurrentFile
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.sendCurrentFormToOutputWindow',
      outputWindow.appendCurrentForm
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.sendCurrentTopLevelFormToOutputWindow',
      outputWindow.appendCurrentTopLevelForm
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.printLastStacktrace', () => {
      outputWindow.printLastStacktrace();
      outputWindow.appendPrompt();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.showPreviousReplHistoryEntry',
      replHistory.showPreviousReplHistoryEntry
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.showNextReplHistoryEntry',
      replHistory.showNextReplHistoryEntry
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.clearReplHistory', replHistory.clearHistory)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.toggleKeybindingsEnabled', () => {
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
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.openCalvaDocs', () => {
      void context.globalState.update(VIEWED_CALVA_DOCS, true);
      open(CALVA_DOCS_URL)
        .then(() => {
          state.analytics().logEvent('Calva', 'Docs opened');
        })
        .catch((e) => {
          console.error(`Problems visiting calva docs: ${e}`);
        });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.continueComment', edit.continueCommentCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.diagnostics.toggleNreplLoggingEnabled',
      nreplLogging.toggleEnabled
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.printClojureDocsToOutputWindow',
      clojureDocs.printClojureDocsToOutputWindow
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.printClojureDocsToRichComment',
      clojureDocs.printClojureDocsToRichComment
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.printTextToRichCommentCommand',
      clojureDocs.printTextToRichCommentCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'calva.printTextToOutputWindowCommand',
      clojureDocs.printTextToOutputWindowCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.convertJs2Cljs', converters.js2cljs)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('calva.convertDart2Clj', converters.dart2clj)
  );

  // Initial set of the provided contexts
  outputWindow.setContextForOutputWindowActive(false);
  void vscode.commands.executeCommand('setContext', 'calva:launching', false);
  void vscode.commands.executeCommand('setContext', 'calva:connected', false);
  void vscode.commands.executeCommand('setContext', 'calva:connecting', false);
  setKeybindingsEnabledContext();

  // PROVIDERS
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      config.documentSelector,
      new CalvaCompletionItemProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(config.documentSelector, new HoverProvider())
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      config.documentSelector,
      new definition.ClojureDefinitionProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      config.documentSelector,
      new definition.StackTraceDefinitionProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      config.documentSelector,
      new CalvaSignatureHelpProvider(),
      ' ',
      ' '
    )
  );

  vscode.workspace.registerTextDocumentContentProvider('jar', new JarContentProvider());

  // //EVENTS
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      onDidOpen(document);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      void onDidSave(controller, document);
    })
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      status.update();
      onDidChangeEditorOrSelection(editor);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(annotations.onDidChangeTextDocument)
  );
  context.subscriptions.push(
    new vscode.Disposable(() => {
      connector.disconnect();
      chan.dispose();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((_: vscode.ConfigurationChangeEvent) => {
      statusbar.update();
    })
  );
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      onDidChangeEditorOrSelection(event.textEditor);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (outputWindow.isResultsDoc(document)) {
        outputWindow.setContextForOutputWindowActive(false);
      }
    })
  );
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      if (!editors.some((editor) => outputWindow.isResultsDoc(editor.document))) {
        outputWindow.setContextForOutputWindowActive(false);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration(config.KEYBINDINGS_ENABLED_CONFIG_KEY)) {
        setKeybindingsEnabledContext();
      }
    })
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
