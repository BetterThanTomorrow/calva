import * as vscode from 'vscode';
import * as state from './state';
import annotations from './providers/annotations';
import * as path from 'path';
import * as util from './utilities';
import { NReplSession, NReplEvaluation } from './nrepl';
import statusbar from './statusbar';
import { PrettyPrintingOptions } from './printer';
import * as outputWindow from './results-output/results-doc';
import { DEBUG_ANALYTICS } from './debugger/calva-debug';
import * as namespace from './namespace';
import * as replHistory from './results-output/repl-history';
import { formatAsLineComments } from './results-output/util';
import { getStateValue } from '../out/cljs-lib/cljs-lib';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import * as getText from './util/get-text';
import * as customSnippets from './custom-snippets';

function interruptAllEvaluations() {
  if (util.getConnectedState()) {
    const msgs: string[] = [];
    const nums = NReplEvaluation.interruptAll((msg) => {
      msgs.push(msg);
    });
    if (msgs.length) {
      outputWindow.appendLine(msgs.join('\n'));
    }
    try {
      NReplSession.getInstances().forEach((session, _index) => {
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
    outputWindow.discardPendingPrints();
    return;
  }
  void vscode.window.showInformationMessage('Not connected to a REPL server');
}

async function addAsComment(
  c: number,
  result: string,
  codeSelection: vscode.Selection,
  editor: vscode.TextEditor,
  selection: vscode.Selection
) {
  const indent = `${' '.repeat(c)}`,
    output = result
      .replace(/\n\r?$/, '')
      .split(/\n\r?/)
      .join(`\n${indent};;    `),
    edit = vscode.TextEdit.insert(codeSelection.end, `\n${indent};; => ${output}\n`),
    wsEdit = new vscode.WorkspaceEdit();
  wsEdit.set(editor.document.uri, [edit]);
  await vscode.workspace.applyEdit(wsEdit);
  editor.selection = selection;
}

// TODO: Clean up this mess
async function evaluateCodeUpdatingUI(
  code: string,
  options,
  selection?: vscode.Selection
): Promise<string | null> {
  const pprintOptions = options.pprintOptions || getConfig().prettyPrintingOptions;
  // passed options overwrite config options
  const evaluationSendCodeToOutputWindow =
    (options.evaluationSendCodeToOutputWindow === undefined ||
      options.evaluationSendCodeToOutputWindow === true) &&
    getConfig().evaluationSendCodeToOutputWindow;
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
  const session: NReplSession = options.session;
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
      replHistory.addToReplHistory(session.replType, code);
      replHistory.resetState();
    }

    const err: string[] = [];

    if (outputWindow.getNs() !== ns) {
      await session.evaluateInNs(options.nsForm, outputWindow.getNs());
    }

    const context: NReplEvaluation = session.eval(code, ns, {
      file: filePath,
      line: line + 1,
      column: column + 1,
      stdout: (m) => {
        outputWindow.append(m);
      },
      stderr: (m) => err.push(m),
      pprintOptions: pprintOptions,
    });

    try {
      if (evaluationSendCodeToOutputWindow) {
        outputWindow.appendLine(code);
      }

      let value = await context.value;
      value = util.stripAnsi(context.pprintOut || value);

      result = value;

      if (showResult) {
        outputWindow.appendLine(value, async (resultLocation) => {
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
                await addAsComment(c, value, selection, editor, editor.selection);
              }
              if (editor && !outputWindow.isResultsDoc(editor.document)) {
                annotations.decorateSelection(
                  value,
                  selection,
                  editor,
                  editor.selection.active,
                  resultLocation,
                  annotations.AnnotationStatus.SUCCESS
                );
                if (!options.comment) {
                  annotations.decorateResults(value, false, selection, editor);
                }
              }
            }
          }
        });
        // May need to move this inside of onResultsAppended callback above, depending on desired ordering of appended results
        if (err.length > 0) {
          const errMsg = formatAsLineComments(err.join('\n'));
          if (context.stacktrace) {
            outputWindow.saveStacktrace(context.stacktrace);
            outputWindow.appendLine(errMsg, (_, afterResultLocation) => {
              outputWindow.markLastStacktraceRange(afterResultLocation);
            });
          } else {
            outputWindow.appendLine(errMsg);
          }
        }
      }
    } catch (e) {
      if (showErrorMessage) {
        const outputWindowError = err.length
          ? formatAsLineComments(err.join('\n'))
          : formatAsLineComments(e);
        outputWindow.appendLine(outputWindowError, async (resultLocation, afterResultLocation) => {
          if (selection) {
            const editorError = util.stripAnsi(err.length ? err.join('\n') : e);
            const currentCursorPos = editor.selection.active;
            if (editor && options.comment) {
              await addAsComment(
                selection.start.character,
                editorError,
                selection,
                editor,
                editor.selection
              );
            }
            if (editor && !outputWindow.isResultsDoc(editor.document)) {
              annotations.decorateSelection(
                editorError,
                selection,
                editor,
                currentCursorPos,
                resultLocation,
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
                outputWindow.markLastStacktraceRange(afterResultLocation);
                outputWindow.saveStacktrace(stacktrace.stacktrace);
              }
            })
            .catch((e) => {
              console.error(`Failed fetching stacktrace: ${e.message}`);
            });
        });
      }
    }
    outputWindow.setSession(session, context.ns || ns);
    replSession.updateReplSessionType();
  }

  return result;
}

async function evaluateSelection(document = {}, options) {
  void state.analytics().logGA4Pageview('/evaluated-form');

  const selectionFn: (editor: vscode.TextEditor) => [vscode.Selection, string] =
    options.selectionFn;

  if (getStateValue('connected')) {
    const editor = util.getActiveTextEditor();
    state.analytics().logEvent('Evaluation', 'selectionFn').send();
    const selection = selectionFn(editor);
    const codeSelection: vscode.Selection = selection[0];
    let code = selection[1];
    [codeSelection, code]; //TODO: What's this doing here?

    const doc = util.getDocument(document);
    const [ns, nsForm] = namespace.getNamespace(doc, codeSelection.end);
    const line = codeSelection.start.line;
    const column = codeSelection.start.character;
    const filePath = doc.fileName;
    const session = replSession.getSession(util.getFileType(doc));

    if (code.length > 0) {
      if (options.debug) {
        code = '#dbg\n' + code;
      }
      annotations.decorateSelection(
        '',
        codeSelection,
        editor,
        undefined,
        undefined,
        annotations.AnnotationStatus.PENDING
      );
      if (
        state.extensionContext.workspaceState.get('outputWindowActive') &&
        !(await outputWindow.lastLineIsEmpty())
      ) {
        outputWindow.appendLine();
      }
      await evaluateCodeUpdatingUI(
        code,
        { ...options, ns, nsForm, line, column, filePath, session },
        codeSelection
      );
      outputWindow.appendPrompt();
    }
  } else {
    void vscode.window.showErrorMessage('Not connected to a REPL');
  }
}

function printWarningForError(e: any) {
  console.warn(`Unhandled error: ${e.message}`);
}

function _currentSelectionElseCurrentForm(editor: vscode.TextEditor): getText.SelectionAndText {
  if (editor.selection.isEmpty) {
    return getText.currentFormText(editor?.document, editor.selection.active);
  } else {
    return [editor.selection, editor.document.getText(editor.selection)];
  }
}

function _currentTopLevelFormText(editor: vscode.TextEditor): getText.SelectionAndText {
  return getText.currentTopLevelFormText(editor?.document, editor?.selection.active);
}

function _currentEnclosingFormText(editor: vscode.TextEditor): getText.SelectionAndText {
  return getText.currentEnclosingFormText(editor?.document, editor?.selection.active);
}

function evaluateSelectionReplace(document = {}, options = {}) {
  evaluateSelection(
    document,
    Object.assign({}, options, {
      replace: true,
      pprintOptions: getConfig().prettyPrintingOptions,
      selectionFn: _currentSelectionElseCurrentForm,
    })
  ).catch(printWarningForError);
}

function evaluateSelectionAsComment(document = {}, options = {}) {
  evaluateSelection(
    document,
    Object.assign({}, options, {
      comment: true,
      pprintOptions: getConfig().prettyPrintingOptions,
      selectionFn: _currentSelectionElseCurrentForm,
    })
  ).catch(printWarningForError);
}

function evaluateTopLevelFormAsComment(document = {}, options = {}) {
  evaluateSelection(
    document,
    Object.assign({}, options, {
      comment: true,
      pprintOptions: getConfig().prettyPrintingOptions,
      selectionFn: _currentTopLevelFormText,
    })
  ).catch(printWarningForError);
}

function offerToConnect() {
  vscode.window
    .showInformationMessage('The editor is not connected to a REPL server', 'Connect')
    .then(
      (choice) => {
        if (choice === 'Connect') {
          void vscode.commands.executeCommand('calva.startOrConnectRepl');
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
        pprintOptions: getConfig().prettyPrintingOptions,
        selectionFn: _currentTopLevelFormText,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function evaluateOutputWindowForm(document = {}, options = {}) {
  evaluateSelection(
    document,
    Object.assign({}, options, {
      pprintOptions: getConfig().prettyPrintingOptions,
      selectionFn: _currentTopLevelFormText,
      evaluationSendCodeToOutputWindow: false,
      addToHistory: true,
    })
  ).catch(printWarningForError);
}

function evaluateCurrentForm(document = {}, options = {}) {
  if (util.getConnectedState()) {
    evaluateSelection(
      document,
      Object.assign({}, options, {
        pprintOptions: getConfig().prettyPrintingOptions,
        selectionFn: _currentSelectionElseCurrentForm,
      })
    ).catch(printWarningForError);
  } else {
    offerToConnect();
  }
}

function evaluateEnclosingForm(document = {}, options = {}) {
  evaluateSelection(
    document,
    Object.assign({}, options, {
      pprintOptions: getConfig().prettyPrintingOptions,
      selectionFn: _currentEnclosingFormText,
    })
  ).catch(printWarningForError);
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
      pprintOptions: getConfig().prettyPrintingOptions,
      selectionFn: (editor: vscode.TextEditor) => {
        const [selection, code] = getter(editor?.document, editor?.selection.active);
        return [selection, formatter(code)];
      },
    })
  ).catch(printWarningForError);
}

function evaluateToCursor(document = {}, options = {}) {
  evaluateUsingTextAndSelectionGetter(
    vscode.window.activeTextEditor.selection.isEmpty
      ? getText.currentEnclosingFormToCursor
      : getText.selectionAddingBrackets,
    (code) => `${code}`,
    document,
    options
  );
}

function evaluateTopLevelFormToCursor(document = {}, options = {}) {
  evaluateUsingTextAndSelectionGetter(
    getText.currentTopLevelFormToCursor,
    (code) => `${code}`,
    document,
    options
  );
}

function evaluateStartOfFileToCursor(document = {}, options = {}) {
  evaluateUsingTextAndSelectionGetter(
    getText.startOFileToCursor,
    (code) => `${code}`,
    document,
    options
  );
}

async function loadDocument(
  document: vscode.TextDocument | Record<string, never> | undefined,
  pprintOptions: PrettyPrintingOptions
) {
  void state.analytics().logGA4Pageview('/load-file');

  const doc = util.tryToGetDocument(document);
  const fileType = util.getFileType(doc);
  const [ns, _] = namespace.getNamespace(doc, doc.positionAt(0));
  const session = replSession.getSession(util.getFileType(doc));

  if (doc && doc.languageId == 'clojure' && fileType != 'edn' && getStateValue('connected')) {
    state.analytics().logEvent('Evaluation', 'LoadFile').send();
    const docUri = outputWindow.isResultsDoc(doc)
      ? await namespace.getUriForNamespace(session, ns)
      : doc.uri;
    const filePath = docUri.path;
    return await loadFile(filePath, ns, pprintOptions, fileType);
  }
}

async function loadFile(
  filePath: string,
  ns: string,
  pprintOptions: PrettyPrintingOptions,
  fileType: string
) {
  const fileName = path.basename(filePath);
  const fileContents = await util.getFileContents(filePath);
  const session = replSession.getSession(path.extname(fileName).replace(/^\./, ''));

  outputWindow.appendLine(`; Evaluating file: ${fileName}`);

  const errorMessages = [];
  const res = session.loadFile(fileContents, {
    fileName,
    filePath,
    stdout: (m) => outputWindow.append(m),
    stderr: (m) => {
      outputWindow.appendLine(formatAsLineComments(m));
      errorMessages.push(m);
    },
    pprintOptions: pprintOptions,
  });
  try {
    const value = await res.value;
    if (value) {
      outputWindow.appendLine(value);
    } else {
      outputWindow.appendLine('; No results from file evaluation.');
    }
  } catch (e) {
    outputWindow.appendLine(
      `; Evaluation of file ${fileName} failed: ${e}`,
      (_location, nextLocation) => {
        if (res.stacktrace) {
          outputWindow.saveStacktrace(res.stacktrace.stacktrace);
          outputWindow.markLastStacktraceRange(nextLocation);
        }
      }
    );
    if (
      !vscode.window.visibleTextEditors.find((editor: vscode.TextEditor) =>
        outputWindow.isResultsDoc(editor.document)
      )
    ) {
      void vscode.window
        .showErrorMessage(
          `Evaluation of file ${fileName} failed: ${errorMessages.join(' ')} - ${e}`,
          'Show output'
        )
        .then((choice) => {
          if (choice === 'Show output') {
            void vscode.commands.executeCommand('calva.showOutputWindow');
          }
        });
    }
  } finally {
    outputWindow.setSession(session, ns);
    replSession.updateReplSessionType();
    if (getConfig().autoEvaluateCode.onFileLoaded[fileType]) {
      outputWindow.appendLine(`; Evaluating 'autoEvaluateCode.onFileLoaded.${fileType}'`);
      const context = customSnippets.makeContext(vscode.window.activeTextEditor, ns, ns, fileType);
      await customSnippets.evaluateSnippet(
        util.getActiveTextEditor(),
        getConfig().autoEvaluateCode.onFileLoaded[fileType],
        context,
        {}
      );
    }
  }
}

async function evaluateUser(code: string) {
  const fileType = util.getFileType(util.tryToGetDocument({})),
    session = replSession.getSession(fileType);
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
      fileType = util.getFileType(util.tryToGetDocument({})),
      session = replSession.getSession(fileType);

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
  const session = replSession.getSession(util.getFileType(util.tryToGetDocument({})));

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
    pprintOptions = config.get<PrettyPrintingOptions>(pprintConfigKey);
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
  evaluateSelection(
    {},
    {
      pprintOptions: getConfig().prettyPrintingOptions,
      debug: true,
      selectionFn: _currentTopLevelFormText,
    }
  ).catch(printWarningForError);
  state
    .analytics()
    .logEvent(DEBUG_ANALYTICS.CATEGORY, DEBUG_ANALYTICS.EVENT_ACTIONS.INSTRUMENT_FORM)
    .send();
}

async function evaluateInOutputWindow(code: string, sessionType: string, ns: string, options) {
  const outputDocument = await outputWindow.openResultsDoc();
  const evalPos = outputDocument.positionAt(outputDocument.getText().length);
  try {
    const session = replSession.getSession(sessionType);
    replSession.updateReplSessionType();
    if (outputWindow.getNs() !== ns) {
      outputWindow.setSession(session, ns);
      if (options.evaluationSendCodeToOutputWindow !== false) {
        outputWindow.appendPrompt();
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
    outputWindow.appendLine('; Evaluation failed.');
  }
}

export default {
  interruptAllEvaluations,
  loadDocument,
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
  evaluateOutputWindowForm,
};
