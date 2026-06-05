import * as vscode from 'vscode';
import * as state from './state';
import * as annotations from './providers/annotations';
import * as path from 'path';
import * as util from './utilities';
import * as nrepl from './nrepl';
import * as statusbar from './statusbar';
import type * as printerTypes from './printer';
import * as replWindow from './repl-window/repl-window-doc';
import * as namespace from './namespace';
import * as replHistory from './repl-window/repl-history';
import * as resultsOutputUtil from './results-output/util';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as calvaConfig from './config';
import * as replSession from './nrepl/repl-session';
import * as sessionRegistry from './nrepl/session-registry';
import * as getText from './util/get-text';
import * as customSnippets from './custom-snippets';
import * as output from './results-output/output';
import * as inspector from './providers/inspector';
import * as stringResult from './util/string-result';
import * as highlightExtension from './highlight/src/extension';
import * as flareHandler from './flare-handler';
import * as evaluateUtils from './evaluate-utils';
import * as whoTracking from './api/who-tracking';
import * as outputDestinations from './results-output/output-destinations';
import * as debug from './debugger/calva-debug';

let inspectorDataProvider: inspector.InspectorDataProvider;

function initInspectorDataProvider() {
  inspectorDataProvider = new inspector.InspectorDataProvider();
  return inspectorDataProvider;
}

async function getJavaVersion(session: nrepl.NReplSession): Promise<number | null> {
  try {
    const result = await session.eval('(System/getProperty "java.version")', 'user').value;
    // Parse version like "21.0.1", "17.0.2", "1.8.0_292"
    const match = result.match(/^"(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch (error) {
    console.error('Failed to get Java version:', error);
    return null;
  }
}

async function checkJvmAttachSelfSupport(session: nrepl.NReplSession): Promise<boolean> {
  try {
    const result = await session.eval('(System/getProperty "jdk.attach.allowAttachSelf")', 'user')
      .value;
    // 'nil' means not set, any other value means enabled
    return result !== 'nil';
  } catch (error) {
    console.error('Failed to check jdk.attach.allowAttachSelf:', error);
    return false;
  }
}

async function interruptAllEvaluations() {
  if (!util.getConnectedState()) {
    void vscode.window.showInformationMessage('Not connected to a REPL server');
    return;
  }

  const firstSession = nrepl.NReplSession.getInstances()?.[0];
  if (!firstSession?.supports('interrupt')) {
    void vscode.window.showInformationMessage(
      'The nREPL server does not support interruption of evaluations.'
    );
    return;
  }

  const javaVersion = await getJavaVersion(firstSession);
  if (javaVersion !== null && javaVersion >= 21) {
    const attachSelfEnabled = await checkJvmAttachSelfSupport(firstSession);
    if (!attachSelfEnabled) {
      void vscode.window.showWarningMessage(
        'Interrupt may not work: JVM property jdk.attach.allowAttachSelf is not set. ' +
          'Add `-Djdk.attach.allowAttachSelf` to your JVM options.'
      );
    }
  }

  const msgs: string[] = [];
  const nums = nrepl.NReplEvaluation.interruptAll((msg) => {
    msgs.push(msg);
  });
  if (msgs.length) {
    output.appendLineOtherOut(msgs.join('\n'), { who: 'ui' });
  }
  try {
    nrepl.NReplSession.getInstances().forEach((session, _index) => {
      session.interruptAll();
    });
  } catch (error) {
    // TODO: Figure out why we never get here.
    console.error(error);
  }
  if (nums > 0) {
    void vscode.window.showInformationMessage(`Interrupted ${nums} running evaluation(s).`);
  } else {
    void vscode.window.showInformationMessage('Interruption command finished (unknown results)');
  }
  replWindow.discardPendingPrints();
}

async function addAsComment(
  result: string,
  codeSelection: vscode.Selection,
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  commentStyle: string
) {
  const endOfLinePosition = editor.document.lineAt(codeSelection.end.line).range.end;
  const commentText = stringResult.resultAsComment(
    codeSelection.start.character,
    result,
    commentStyle
  );
  await editor.edit((editBuilder) => {
    editBuilder.insert(endOfLinePosition, commentText);
  });
  editor.selections = [selection];
  highlightExtension.highlight(editor);
}

// TODO: Clean up this mess
async function evaluateCodeUpdatingUI(
  code: string,
  options,
  selection?: vscode.Selection
): Promise<string | null> {
  const pprintOptions = options.pprintOptions || calvaConfig.getConfig().prettyPrintingOptions;
  // passed options overwrite config options
  const evaluationSendCodeToOutputWindow =
    (options.evaluationSendCodeToOutputWindow === undefined ||
      options.evaluationSendCodeToOutputWindow === true) &&
    calvaConfig.getConfig().evaluationSendCodeToOutputWindow;
  const addToHistory =
    (options.addToHistory === undefined || options.addToHistory === true) &&
    (evaluationSendCodeToOutputWindow ||
      state.extensionContext.workspaceState.get('outputWindowActive'));
  const showErrorMessage =
    options.showErrorMessage === undefined || options.showErrorMessage === true;
  const showResult = options.showResult === undefined || options.showResult === true;
  const line = options.line;
  const column = options.column;
  const filePath = options.filePath;
  const session: nrepl.NReplSession = options.session;
  const sessionKey = sessionRegistry.resolveSessionKey(session);
  const ns = options.ns;
  let editor: vscode.TextEditor;
  try {
    editor = util.getActiveTextEditor();
  } catch (error) {
    console.log('No active editor');
  }
  let result = null;

  if (code.length > 0) {
    if (addToHistory) {
      replHistory.addToReplHistory(sessionKey, code);
      replHistory.resetState();
    }

    const err: string[] = [];

    if (replWindow.getNs() !== ns) {
      await session.evaluateInNs(options.nsForm, replWindow.getNs());
    }

    const context: nrepl.NReplEvaluation = session.eval(code, ns, {
      file: filePath,
      line: line + 1,
      column: column + 1,
      stdout: (m) => {
        output.appendEvalOut(m, { ns, replSessionType: sessionKey, who: 'ui' });
      },
      stderr: (m) => err.push(m),
      pprintOptions: pprintOptions,
    });

    sessionRegistry.updateSessionActivity(sessionKey);
    whoTracking.recordEvaluation(sessionKey, 'ui');
    whoTracking.setCurrentWho(session.sessionId, 'ui');

    try {
      const evalResultsDestination = output.getDestinationConfiguration().evalResults;
      const shouldWriteVisibleEvaluatedCode =
        evaluationSendCodeToOutputWindow && !replWindow.isReplWindowDoc(editor?.document);

      output.appendEvaluatedCode(code, {
        destination: shouldWriteVisibleEvaluatedCode ? 'repl-window' : evalResultsDestination,
        additionalDestinations:
          shouldWriteVisibleEvaluatedCode &&
          !outputDestinations.normalizeDestinations(evalResultsDestination).includes('repl-window')
            ? [evalResultsDestination]
            : [],
        sinkDestination: evalResultsDestination,
        writeVisible: shouldWriteVisibleEvaluatedCode,
        ns,
        replSessionType: sessionKey,
        visibleOutputCategory: 'evaluatedCode',
        who: 'ui',
      });

      let value = await context.value;
      value = util.stripAnsi(context.pprintOut || value);

      result = value;

      flareHandler.inspect(value, (code) => evaluateCodeUpdatingUI(code, options, selection));

      if (showResult) {
        inspectorDataProvider.addItem(value, false, `[${sessionKey}] ${ns}`);
        output.appendClojureEval(
          value,
          { ns, replSessionType: sessionKey, who: 'ui' },
          async () => {
            if (editor && replWindow.isReplWindowDoc(editor.document)) {
              replWindow.maybePrintResultsInOtherDestinationMessage();
            }
            if (selection) {
              const c = selection.start.character;
              if (editor && options.replace) {
                const indent = `${' '.repeat(c)}`,
                  edit = vscode.TextEdit.replace(selection, value.replace(/\n/gm, '\n' + indent)),
                  wsEdit = new vscode.WorkspaceEdit();
                wsEdit.set(editor.document.uri, [edit]);
                void vscode.workspace.applyEdit(wsEdit);
              } else {
                if (editor && options.comment) {
                  await addAsComment(
                    value,
                    selection,
                    editor,
                    editor.selections[0],
                    options.commentStyle
                  );
                }
                if (editor && editor.document && !replWindow.isReplWindowDoc(editor.document)) {
                  annotations.decorateSelection(
                    value,
                    selection,
                    editor,
                    editor.selections[0].active,
                    annotations.AnnotationStatus.SUCCESS
                  );
                  if (!options.comment) {
                    annotations.decorateResults(value, false, selection, editor);
                  }
                }
              }
            }
          }
        );
        // May need to move this inside of onResultsAppended callback above, depending on desired ordering of appended results
        if (err.length > 0) {
          const errMsg = err.join('\n');
          if (context.stacktrace) {
            replWindow.saveStacktrace(context.stacktrace);
            replWindow.appendLine(
              resultsOutputUtil.formatAsLineComments(errMsg),
              (_, afterResultLocation) => {
                replWindow.markLastStacktraceRange(afterResultLocation);
              }
            );
            if (
              !outputDestinations
                .normalizeDestinations(output.getDestinationConfiguration().evalOutput)
                .includes('repl-window')
            ) {
              output.appendEvalErr(errMsg, { ns, replSessionType: sessionKey, who: 'ui' });
            }
          } else {
            output.appendEvalErr(errMsg, { ns, replSessionType: sessionKey, who: 'ui' });
          }
        }
      }
    } catch (e) {
      if (showErrorMessage) {
        const outputWindowError = err.length
          ? resultsOutputUtil.formatAsLineComments(err.join('\n'))
          : resultsOutputUtil.formatAsLineComments(e);
        replWindow.appendLine(outputWindowError, async (resultLocation, afterResultLocation) => {
          if (selection) {
            const editorError = util.stripAnsi(err.length ? err.join('\n') : e);
            const currentCursorPos = editor.selections[0].active;
            if (editor && options.comment) {
              await addAsComment(
                editorError,
                selection,
                editor,
                editor.selections[0],
                options.commentStyle
              );
            }
            if (editor && editor.document && !replWindow.isReplWindowDoc(editor.document)) {
              annotations.decorateSelection(
                editorError,
                selection,
                editor,
                currentCursorPos,
                annotations.AnnotationStatus.ERROR
              );
              if (!options.comment) {
                annotations.decorateResults(editorError, true, selection, editor);
              }
            }
          }
          session
            .stacktrace()
            .then((stacktrace) => {
              if (stacktrace && stacktrace.stacktrace) {
                replWindow.markLastStacktraceRange(afterResultLocation);
                replWindow.saveStacktrace(stacktrace.stacktrace);
              }
            })
            .catch((e) => {
              console.error(`Failed fetching stacktrace: ${e.message}`);
            });
        });
        if (
          !outputDestinations
            .normalizeDestinations(output.getDestinationConfiguration().evalOutput)
            .includes('repl-window')
        ) {
          output.appendEvalErr(err.length ? err.join('\n') : e, {
            ns,
            replSessionType: sessionKey,
            who: 'ui',
          });
          if (
            outputDestinations
              .normalizeDestinations(output.getDestinationConfiguration().evalOutput)
              .includes('output-view')
          ) {
            session
              .stacktrace()
              .then((stacktrace) => {
                if (stacktrace && stacktrace.stacktrace) {
                  cljsLib.appendStackTraceToReplOutputWebview(stacktrace.stacktrace);
                }
              })
              .catch((e) => {
                console.error(`Failed fetching stacktrace: ${e.message}`);
              });
          }
        }
      }
    }
    replWindow.setSession(session, context.ns || ns);
    replSession.updateReplSessionType();
  }

  return result;
}

async function evaluateSelection(document = {}, options) {
  void state.analytics().logGA4Pageview('/evaluated-form');

  const selectionFn: (editor: vscode.TextEditor) => [vscode.Selection, string] =
    options.selectionFn;

  if (cljsLib.getStateValue('connected')) {
    const editor = util.getActiveTextEditor();
    const selection = selectionFn(editor);
    const codeSelection: vscode.Selection = selection[0];
    let code = selection[1];
    [codeSelection, code]; //TODO: What's this doing here?

    // Strip leading #_ and optional whitespace so that
    // evaluating with the cursor at the end of #_(form) sends just (form)
    // to the REPL instead of the silently-discarded #_(form).
    if (editor.selections[0].isEmpty) {
      code = code.replace(/^#_\s*/, '');
    }
    const doc = util.getDocument(document);
    if (vscode.window.tabGroups?.activeTabGroup?.activeTab?.isPreview) {
      void vscode.window.showTextDocument(doc, { preview: false });
    }
    const [ns, nsForm] = namespace.getNamespace(doc, codeSelection.end);
    const line = codeSelection.start.line;
    const column = codeSelection.start.character;
    const filePath = doc.fileName;
    const session = replSession.getSession();

    if (code.length > 0) {
      if (options.debug) {
        if (!debug.supportsDebuggerOps(session)) {
          debug.warnUnsupportedDebugger(session);
          return;
        }
        code = '#dbg\n' + code;
      } else {
        code = debug.instrumentCodeWithSourceBreakpoints(doc, codeSelection, code, session);
      }
      annotations.decorateSelection(
        '',
        codeSelection,
        editor,
        undefined,
        annotations.AnnotationStatus.PENDING
      );
      if (
        state.extensionContext.workspaceState.get('outputWindowActive') &&
        !(await replWindow.lastLineIsEmpty())
      ) {
        replWindow.appendLine();
      }
      await evaluateCodeUpdatingUI(
        code,
        { ...options, ns, nsForm, line, column, filePath, session },
        codeSelection
      );
      void output.replWindowAppendPrompt();
    }
  } else {
    void vscode.window.showErrorMessage('Not connected to a REPL');
  }
}

function printWarningForError(e: any) {
  console.warn(`Unhandled error: ${e.message}`);
}

function _currentSelectionElseCurrentForm(editor: vscode.TextEditor): getText.SelectionAndText {
  if (editor.selections[0].isEmpty) {
    return getText.currentFormText(editor?.document, editor.selections[0].active);
  } else {
    return [editor.selections[0], editor.document.getText(editor.selections[0])];
  }
}

function _currentTopLevelFormText(editor: vscode.TextEditor): getText.SelectionAndText {
  return getText.currentTopLevelFormText(editor?.document, editor?.selections[0].active);
}

function _currentEnclosingFormText(editor: vscode.TextEditor): getText.SelectionAndText {
  return getText.currentEnclosingFormText(editor?.document, editor?.selections[0].active);
}

function evaluateSelectionReplace(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateSelection(
      document,
      Object.assign({}, options, {
        replace: true,
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        selectionFn: _currentSelectionElseCurrentForm,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function validateCommentStyle(commentStyle: string) {
  if (!['line', 'ignore', 'rcf'].includes(commentStyle)) {
    throw new Error(
      `Invalid comment style: ${commentStyle}. Must be one of "line", "ignore", or "rcf".`
    );
  }
}

function evaluateSelectionAsComment(options = { commentStyle: 'line' }, document = {}) {
  const normalized = evaluateUtils.normalizeEvaluateAsCommentArgs(document, options);
  validateCommentStyle(normalized.options.commentStyle);
  if (util.getConnectedState()) {
    evaluateSelection(
      normalized.document,
      Object.assign({}, normalized.options, {
        comment: true,
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        selectionFn: _currentSelectionElseCurrentForm,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function evaluateTopLevelFormAsComment(options = { commentStyle: 'line' }, document = {}) {
  const normalized = evaluateUtils.normalizeEvaluateAsCommentArgs(document, options);
  validateCommentStyle(normalized.options.commentStyle);
  if (util.getConnectedState()) {
    evaluateSelection(
      normalized.document,
      Object.assign({}, normalized.options, {
        comment: true,
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        selectionFn: _currentTopLevelFormText,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function offerToConnect() {
  vscode.window
    .showInformationMessage('The editor is not connected to a REPL server', 'Connect')
    .then(
      (choice) => {
        if (choice === 'Connect') {
          void vscode.commands.executeCommand('calva.showReplMenu');
        }
      },
      (reason) => {
        console.log('Rejected because: ', reason);
      }
    );
}

function evaluateTopLevelForm(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateSelection(
      document,
      Object.assign({}, options, {
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        selectionFn: _currentTopLevelFormText,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function evaluateReplWindowForm(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateSelection(
      document,
      Object.assign({}, options, {
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        selectionFn: _currentTopLevelFormText,
        evaluationSendCodeToOutputWindow: false,
        addToHistory: true,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function evaluateCurrentForm(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateSelection(
      document,
      Object.assign({}, options, {
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        selectionFn: _currentSelectionElseCurrentForm,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function evaluateEnclosingForm(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateSelection(
      document,
      Object.assign({}, options, {
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        selectionFn: _currentEnclosingFormText,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function evaluateUsingTextAndSelectionGetter(
  getter: (doc: vscode.TextDocument, pos: vscode.Position) => getText.SelectionAndText,
  formatter: (s: string) => string,
  document = {},
  options = {}
) {
  evaluateSelection(
    document,
    Object.assign({}, options, {
      pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
      selectionFn: (editor: vscode.TextEditor) => {
        const [selection, code] = getter(editor?.document, editor?.selections[0].active);
        return [selection, formatter(code)];
      },
    })
  ).catch(printWarningForError);
}

function evaluateToCursor(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateUsingTextAndSelectionGetter(
      vscode.window.activeTextEditor.selections[0].isEmpty
        ? getText.currentEnclosingFormToCursor
        : getText.selectionAddingBrackets,
      (code) => `${code}`,
      document,
      options
    );
  } else {
    offerToConnect();
  }
}

function evaluateTopLevelFormToCursor(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateUsingTextAndSelectionGetter(
      getText.currentTopLevelFormToCursor,
      (code) => `${code}`,
      document,
      options
    );
  } else {
    offerToConnect();
  }
}

function evaluateStartOfFileToCursor(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateUsingTextAndSelectionGetter(
      getText.startOFileToCursor,
      (code) => `${code}`,
      document,
      options
    );
  } else {
    offerToConnect();
  }
}

async function loadDocument(
  document: vscode.TextDocument | Record<string, never> | undefined,
  pprintOptions: printerTypes.PrettyPrintingOptions,
  shouldResetPreview: boolean = false,
  silent: boolean = false,
  sessionKey?: string,
  who: string = 'ui'
) {
  void state.analytics().logGA4Pageview('/load-file');

  const doc = util.tryToGetDocument(document);
  if (
    !silent &&
    shouldResetPreview &&
    vscode.window.tabGroups?.activeTabGroup?.activeTab?.isPreview
  ) {
    void vscode.window.showTextDocument(doc, { preview: false });
  }
  const fileType = util.getFileType(doc);
  const [ns, nsForm] = namespace.getNamespace(doc, doc.positionAt(0));
  const session = sessionKey ? sessionRegistry.getSession(sessionKey) : replSession.getSession();

  if (
    doc &&
    doc.languageId == 'clojure' &&
    fileType != 'edn' &&
    cljsLib.getStateValue('connected')
  ) {
    const docUri = replWindow.isReplWindowDoc(doc)
      ? await namespace.getUriForNamespace(session, ns)
      : doc.uri;
    const filePath = docUri.path;
    sessionRegistry.updateSessionActivity(session);
    return await loadFile(filePath, ns, nsForm, pprintOptions, fileType, silent, sessionKey, who);
  }
}

async function loadFileCommand(fileArg?: unknown) {
  const { path: filePath, silent, sessionKey, who } = parseLoadFileArg(fileArg);
  if (util.getConnectedState()) {
    const uri = util.resolveFileArgToUri(filePath, vscode.workspace.workspaceFolders);
    let document: vscode.TextDocument | Record<string, never> = {};
    if (uri) {
      document = await vscode.workspace.openTextDocument(uri);
    }
    const result = await loadDocument(
      document,
      calvaConfig.getConfig().prettyPrintingOptions,
      true,
      silent,
      sessionKey,
      who
    );
    await output.replWindowAppendPrompt();
    return result;
  } else {
    if (silent) {
      throw new Error('Not connected to a REPL server');
    }
    offerToConnect();
  }
}

function parseLoadFileArg(fileArg: unknown): {
  path: unknown;
  silent: boolean;
  sessionKey: string | undefined;
  who: string;
} {
  if (fileArg != null && typeof fileArg === 'object' && !Array.isArray(fileArg)) {
    const obj = fileArg as Record<string, unknown>;
    if ('path' in obj || 'silent' in obj || 'sessionKey' in obj || 'who' in obj) {
      return {
        path: obj.path,
        silent: !!obj.silent,
        sessionKey: typeof obj.sessionKey === 'string' ? obj.sessionKey : undefined,
        who: typeof obj.who === 'string' ? obj.who : 'ui',
      };
    }
  }
  return { path: fileArg, silent: false, sessionKey: undefined, who: 'ui' };
}

async function loadFile(
  filePath: string,
  ns: string,
  nsForm: string,
  pprintOptions: printerTypes.PrettyPrintingOptions,
  fileType: string,
  silent: boolean = false,
  targetSessionKey?: string,
  who: string = 'ui'
) {
  const fileName = path.basename(filePath);
  const fileContents = await util.getFileContents(filePath);
  const session = targetSessionKey
    ? sessionRegistry.getSession(targetSessionKey)
    : replSession.getSession();
  const sessionKey = sessionRegistry.resolveSessionKey(session, targetSessionKey);

  output.appendLineOtherOut(`Evaluating file: ${fileName}`, { who });
  whoTracking.recordEvaluation(sessionKey, who);
  whoTracking.setCurrentWho(session.sessionId, who);

  const errorMessages = [];
  const res = session.loadFile(fileContents, {
    fileName,
    filePath,
    stdout: (m) => output.appendEvalOut(m, { ns, replSessionType: sessionKey, who }),
    stderr: (m) => {
      output.appendEvalErr(m, { ns, replSessionType: sessionKey, who });
      errorMessages.push(m);
    },
    pprintOptions: pprintOptions,
  });
  try {
    const value = await res.value;
    if (value) {
      inspectorDataProvider.addItem(value, false, `[${sessionKey}] ${ns}`);
      output.appendClojureEval(value, { ns, replSessionType: sessionKey, who });
    } else {
      output.appendLineEvalOut('No results from file evaluation.', { who });
    }
    return value;
  } catch (e) {
    replWindow.appendLine(
      `; Evaluation of file ${fileName} failed: ${e}`,
      (_location, nextLocation) => {
        if (res.stacktrace) {
          replWindow.saveStacktrace(res.stacktrace.stacktrace);
          replWindow.markLastStacktraceRange(nextLocation);
        }
      }
    );
    if (
      !outputDestinations
        .normalizeDestinations(output.getDestinationConfiguration().evalOutput)
        .includes('repl-window')
    ) {
      output.appendLineOtherErr(`Evaluation of file ${fileName} failed: ${e}`, { who });
    }
    if (silent) {
      throw new Error(`Evaluation of file ${fileName} failed: ${errorMessages.join(' ')} - ${e}`);
    }
    if (
      !vscode.window.visibleTextEditors.find((editor: vscode.TextEditor) =>
        replWindow.isReplWindowDoc(editor.document)
      )
    ) {
      void vscode.window
        .showErrorMessage(
          `Evaluation of file ${fileName} failed: ${errorMessages.join(' ')} - ${e}`,
          'Show output'
        )
        .then((choice) => {
          if (choice === 'Show output') {
            void output.showResultOutputDestination(true);
          }
        });
    }
  } finally {
    replWindow.setSession(session, ns);
    replSession.updateReplSessionType();
    if (calvaConfig.getConfig().autoEvaluateCode.onFileLoaded[fileType]) {
      output.appendLineOtherOut(`Evaluating \`autoEvaluateCode.onFileLoaded.${fileType}\``, {
        who,
      });
      const context = customSnippets.makeContext(
        vscode.window.activeTextEditor,
        ns,
        ns,
        nsForm,
        fileType
      );
      await customSnippets.evaluateSnippet(
        util.getActiveTextEditor(),
        calvaConfig.getConfig().autoEvaluateCode.onFileLoaded[fileType],
        context,
        {}
      );
    }
  }
}

async function evaluateUser(code: string) {
  const session = replSession.getSession();
  if (session) {
    try {
      await session.eval(code, session.client.ns).value;
    } catch (e) {
      const chan = state.outputChannel();
      chan.appendLine(`Eval failure: ${e}`);
    }
  } else {
    void vscode.window.showInformationMessage('Not connected to a REPL server');
  }
}

async function requireREPLUtilitiesCommand() {
  if (util.getConnectedState()) {
    const chan = state.outputChannel(),
      [ns, _nsForm] = namespace.getDocumentNamespace(util.tryToGetDocument({})),
      session = replSession.getSession();

    if (session) {
      try {
        await namespace.createNamespaceFromDocumentIfNotExists(util.tryToGetDocument({}));
        await session.requireREPLUtilities(ns);
        chan.appendLine(`REPL utilities are now available in namespace ${ns}.`);
      } catch (e) {
        chan.appendLine(`REPL utilities could not be acquired for namespace ${ns}: ${e}`);
      }
    }
  } else {
    void vscode.window.showInformationMessage('Not connected to a REPL server');
  }
}

async function copyLastResultCommand() {
  const chan = state.outputChannel();
  const session = replSession.getSession();

  const value = await session.eval('*1', session.client.ns).value;
  if (value !== null) {
    void vscode.env.clipboard.writeText(value);
    void vscode.window.showInformationMessage('Results copied to the clipboard.');
  } else {
    chan.appendLine('Nothing to copy');
  }
}

async function togglePrettyPrint() {
  const config = vscode.workspace.getConfiguration('calva'),
    pprintConfigKey = 'prettyPrintingOptions',
    pprintOptions = config.get<printerTypes.PrettyPrintingOptions>(pprintConfigKey);
  pprintOptions.enabled = !pprintOptions.enabled;
  if (pprintOptions.enabled && !(pprintOptions.printEngine || pprintOptions.printFn)) {
    pprintOptions.printEngine = 'pprint';
  }
  await config.update(pprintConfigKey, pprintOptions, vscode.ConfigurationTarget.Global);
  statusbar.update();
}

async function toggleEvaluationSendCodeToOutputWindow() {
  const config = vscode.workspace.getConfiguration('calva');
  await config.update(
    'evaluationSendCodeToOutputWindow',
    !config.get('evaluationSendCodeToOutputWindow'),
    vscode.ConfigurationTarget.Global
  );
  statusbar.update();
}

function instrumentTopLevelForm() {
  if (util.getConnectedState()) {
    evaluateSelection(
      {},
      {
        pprintOptions: calvaConfig.getConfig().prettyPrintingOptions,
        debug: true,
        selectionFn: _currentTopLevelFormText,
      }
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

async function evaluateInOutputWindow(code: string, sessionType: string, ns: string, options) {
  const outputDocument = await replWindow.openReplWindowDoc();
  const evalPos = outputDocument.positionAt(outputDocument.getText().length);
  try {
    // When sessionType is explicitly provided, use it directly without routing
    // Otherwise, use the routing logic to determine the session
    const session = sessionType
      ? sessionRegistry.getSession(sessionType)
      : replSession.getSession();
    replSession.updateReplSessionType();
    if (replWindow.getNs() !== ns) {
      replWindow.setSession(session, ns);
      if (options.evaluationSendCodeToOutputWindow !== false) {
        void output.replWindowAppendPrompt();
      }
    }

    return await evaluateCodeUpdatingUI(code, {
      ...options,
      filePath: outputDocument.fileName,
      session,
      ns,
      nsForm: options.nsForm ?? `(in-ns '${ns})`,
      line: evalPos.line,
      column: evalPos.character,
    });
  } catch (e) {
    output.appendLineOtherErr('Evaluation failed.', { who: 'ui' });
  }
}

async function evaluateInCurrentEditor(
  editor: vscode.TextEditor,
  code: string,
  sessionType: string,
  ns: string,
  options
) {
  const document = editor?.document;
  if (document) {
    const evalPos = editor.selection.active;
    try {
      // When sessionType is explicitly provided, use it directly without routing
      // Otherwise, use the routing logic to determine the session
      const session = sessionType
        ? sessionRegistry.getSession(sessionType)
        : replSession.getSession();
      return await evaluateCodeUpdatingUI(code, {
        ...options,
        filePath: document.fileName,
        session,
        ns,
        nsForm: options.nsForm ?? `(in-ns '${ns})`,
        line: evalPos.line,
        column: evalPos.character,
      });
    } catch (e) {
      output.appendLineOtherErr('Evaluation failed.', { who: 'ui' });
    }
  }
}

export {
  interruptAllEvaluations,
  evaluateCodeUpdatingUI,
  loadDocument,
  loadFileCommand,
  loadFile,
  evaluateCurrentForm,
  evaluateEnclosingForm,
  evaluateTopLevelForm,
  evaluateSelectionReplace,
  evaluateSelectionAsComment,
  evaluateTopLevelFormAsComment,
  evaluateToCursor,
  evaluateTopLevelFormToCursor,
  evaluateStartOfFileToCursor,
  evaluateUser,
  copyLastResultCommand,
  requireREPLUtilitiesCommand,
  togglePrettyPrint,
  toggleEvaluationSendCodeToOutputWindow,
  instrumentTopLevelForm,
  evaluateInOutputWindow,
  evaluateInCurrentEditor,
  evaluateReplWindowForm,
  initInspectorDataProvider,
};
