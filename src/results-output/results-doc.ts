import * as path from 'path';
import * as vscode from 'vscode';
import * as state from '../state';
import { highlight } from '../highlight/src/extension';
import { NReplSession } from '../nrepl';
import * as util from '../utilities';
import * as select from '../select';
import { formatCode } from '../calva-fmt/src/format';
import * as namespace from '../namespace';
import * as config from '../config';
import type { ReplSessionType } from '../config';
import * as replHistory from './repl-history';
import * as docMirror from '../doc-mirror/index';
import { PrintStackTraceCodelensProvider } from '../providers/codelense';
import * as replSession from '../nrepl/repl-session';
import { formatAsLineComments, splitEditQueueForTextBatching } from './util';

const RESULTS_DOC_NAME = `output.${config.REPL_FILE_EXT}`;

const PROMPT_HINT = 'Use `alt+enter` to evaluate';

const START_GREETINGS = [
  'This is the Calva evaluation results output window.',
  'TIPS: The keyboard shortcut `ctrl+alt+o o` shows and focuses this window',
  '  when connected to a REPL session.',
  'Please see https://calva.io/output/ for more info.',
  'Happy coding! ♥️',
].join(`\n`);

export const CLJ_CONNECT_GREETINGS = [
  'TIPS:',
  '  - You can edit the contents here. Use it as a REPL if you like.',
  '  - `alt+enter` evaluates the current top level form.',
  '  - `ctrl+enter` evaluates the current form.',
  '  - `alt+up` and `alt+down` traverse up and down the REPL command history',
  '     when the cursor is after the last contents at the prompt',
  '  - Clojure lines in stack traces are peekable and clickable.',
].join(`\n`);

export const CLJS_CONNECT_GREETINGS = [
  'TIPS: You can choose which REPL to use (clj or cljs):',
  '   *Calva: Toggle REPL connection*',
  '   (There is a button in the status bar for this)',
].join(`\n`);

function outputFileDir() {
  const projectRoot = state.getProjectRootUri();
  util.assertIsDefined(projectRoot, 'Expected there to be a project root!');
  try {
    return vscode.Uri.joinPath(projectRoot, '.calva', 'output-window');
  } catch {
    return vscode.Uri.file(path.join(projectRoot.fsPath, '.calva', 'output-window'));
  }
}

let isInitialized = false;

const DOC_URI = () => {
  return vscode.Uri.joinPath(outputFileDir(), RESULTS_DOC_NAME);
};

let _sessionType: ReplSessionType = 'clj';
const _sessionInfo: { [id: string]: { ns?: string; session?: NReplSession } } = {
  clj: {},
  cljs: {},
};
const showPrompt: { [id: string]: boolean } = {
  clj: true,
  cljs: true,
};

export function getPrompt(): string {
  // eslint-disable-next-line no-irregular-whitespace
  let prompt = `${_sessionType}꞉${getNs()}꞉> `;
  if (showPrompt[_sessionType]) {
    showPrompt[_sessionType] = false;
    prompt = `${prompt} ${formatAsLineComments(PROMPT_HINT)}`;
  }
  return prompt;
}

export function getNs(): string | undefined {
  return _sessionInfo[_sessionType].ns;
}

export function getSessionType(): ReplSessionType {
  return _sessionType;
}

export function getSession(): NReplSession | undefined {
  return _sessionInfo[_sessionType].session;
}

export function setSession(session: NReplSession, newNs?: string): void {
  if (session) {
    if (session.replType) {
      _sessionType = session.replType;
    }
    _sessionInfo[_sessionType].session = session;
  }
  if (newNs) {
    _sessionInfo[_sessionType].ns = newNs;
  }
}

export function isResultsDoc(doc?: vscode.TextDocument): boolean {
  return !!doc && path.basename(doc.fileName) === RESULTS_DOC_NAME;
}

function getViewColumn(): vscode.ViewColumn {
  const column: vscode.ViewColumn | undefined =
    state.extensionContext.workspaceState.get(`outputWindowViewColumn`);
  return column ? column : vscode.ViewColumn.Two;
}

function setViewColumn(column: vscode.ViewColumn | undefined) {
  return state.extensionContext.workspaceState.update(`outputWindowViewColumn`, column);
}

export function setContextForOutputWindowActive(isActive: boolean): void {
  void state.extensionContext.workspaceState.update(`outputWindowActive`, isActive);
  void vscode.commands.executeCommand('setContext', 'calva:outputWindowActive', isActive);
}

export function registerSubmitOnEnterHandler(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      let submitOnEnter = false;
      if (event.textEditor) {
        const document = event.textEditor.document;
        if (isResultsDoc(document)) {
          const idx = document.offsetAt(event.selections[0].active);
          const mirrorDoc = docMirror.getDocument(document);
          const selectionCursor = mirrorDoc.getTokenCursor(idx);
          selectionCursor.forwardWhitespace();
          if (selectionCursor.atEnd()) {
            const promptCursor = mirrorDoc.getTokenCursor(idx);
            do {
              promptCursor.previous();
            } while (promptCursor.getPrevToken().type !== 'prompt' && !promptCursor.atStart());
            const submitRange = selectionCursor.rangeForCurrentForm(idx);
            submitOnEnter = submitRange && submitRange[1] > promptCursor.offsetStart;
          }
        }
      }
      void vscode.commands.executeCommand(
        'setContext',
        'calva:outputWindowSubmitOnEnter',
        submitOnEnter
      );
    })
  );
}

export function registerOutputWindowActiveWatcher(context: vscode.ExtensionContext) {
  // For some reason onDidChangeTextEditorViewColumn won't fire
  state.extensionContext.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((event) => {
      if (event) {
        const isOutputWindow = isResultsDoc(event.document);
        setContextForOutputWindowActive(isOutputWindow);
        if (isOutputWindow) {
          void setViewColumn(event.viewColumn);
        }
      }
    })
  );
  // If the output window is active when initResultsDoc is run, these contexts won't be set properly without the below
  // until the next time it's focused
  const activeTextEditor = util.tryToGetActiveTextEditor();
  if (activeTextEditor && isResultsDoc(activeTextEditor.document)) {
    setContextForOutputWindowActive(true);
    replHistory.setReplHistoryCommandsActiveContext(activeTextEditor);
  }
}

export async function initResultsDoc(): Promise<vscode.TextDocument> {
  const docUri = DOC_URI();
  await vscode.workspace.fs.createDirectory(outputFileDir());
  let resultsDoc: vscode.TextDocument;
  try {
    resultsDoc = await vscode.workspace.openTextDocument(docUri);
  } catch (e) {
    await util.writeTextToFile(docUri, '');
    resultsDoc = await vscode.workspace.openTextDocument(docUri);
  }
  if (config.getConfig().autoOpenREPLWindow) {
    const resultsEditor = await vscode.window.showTextDocument(resultsDoc, getViewColumn(), true);
    const firstPos = resultsEditor.document.positionAt(0);
    const lastPos = resultsDoc.positionAt(Infinity);
    resultsEditor.selection = new vscode.Selection(lastPos, lastPos);
    resultsEditor.revealRange(new vscode.Range(firstPos, firstPos));
  }
  if (isInitialized) {
    return resultsDoc;
  }

  const greetings = `${formatAsLineComments(START_GREETINGS)}\n\n`;
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(resultsDoc.positionAt(0), resultsDoc.positionAt(Infinity));
  edit.replace(docUri, fullRange, greetings);
  await vscode.workspace.applyEdit(edit);
  void resultsDoc.save();

  registerResultDocSubscriptions();

  vscode.languages.registerCodeLensProvider(
    config.documentSelector,
    new PrintStackTraceCodelensProvider()
  );

  replHistory.resetState();
  isInitialized = true;
  return resultsDoc;
}

export async function openResultsDoc(): Promise<vscode.TextDocument> {
  const resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
  return resultsDoc;
}

export function revealResultsDoc(preserveFocus: boolean = true) {
  return openResultsDoc().then((doc) => {
    return vscode.window.showTextDocument(doc, getViewColumn(), preserveFocus);
  });
}

export async function revealDocForCurrentNS(preserveFocus: boolean = true) {
  const uri = await getUriForCurrentNamespace();
  return vscode.workspace.openTextDocument(uri).then((doc) =>
    vscode.window.showTextDocument(doc, {
      preserveFocus,
    })
  );
}

export function setNamespaceFromCurrentFile() {
  const session = replSession.getSession();
  const [ns, _] = namespace.getNamespace(
    util.tryToGetDocument({}),
    vscode.window.activeTextEditor?.selection?.active
  );
  setSession(session, ns);
  replSession.updateReplSessionType();
  appendPrompt();
}

async function appendFormGrabbingSessionAndNS(topLevel: boolean) {
  const session = replSession.getSession();
  const [ns, _] = namespace.getNamespace(
    util.tryToGetDocument({}),
    vscode.window.activeTextEditor?.selection?.active
  );
  const editor = util.getActiveTextEditor();
  const doc = editor.document;
  const selection = editor.selection;
  let code = '';
  if (selection.isEmpty) {
    const formSelection = select.getFormSelection(doc, selection.active, topLevel);
    code = await formatCode(doc.getText(formSelection), doc.eol);
  } else {
    code = await formatCode(doc.getText(selection), doc.eol);
  }
  if (code != '') {
    setSession(session, ns);
    appendLine(code, (_) => revealResultsDoc(false));
  }
}

export function appendCurrentForm() {
  void appendFormGrabbingSessionAndNS(false);
}

export function appendCurrentTopLevelForm() {
  void appendFormGrabbingSessionAndNS(true);
}

export async function lastLineIsEmpty(): Promise<boolean> {
  try {
    const doc = await vscode.workspace.openTextDocument(DOC_URI());
    return util.lastLineIsEmpty(doc);
  } catch (error) {
    console.error('Failed opening results doc', error);
  }
}

function visibleResultsEditors(): vscode.TextEditor[] {
  return vscode.window.visibleTextEditors.filter((editor) => isResultsDoc(editor.document));
}

function handleResultDocEditorDidOpen(editor: vscode.TextEditor) {
  util.scrollToBottom(editor);
}

function registerResultDocSubscriptions() {
  let currentResultDocs = visibleResultsEditors();
  const subOpen = vscode.window.onDidChangeVisibleTextEditors((editors) => {
    const current = editors.filter((editor) => isResultsDoc(editor.document));
    const opened = current.filter((editor) => currentResultDocs.includes(editor));
    currentResultDocs = current;
    opened.forEach(handleResultDocEditorDidOpen);
  });
  state.extensionContext.subscriptions.push(subOpen);
}

async function writeToResultsDoc({ text, onAppended }: ResultsBufferEntry): Promise<void> {
  const docUri = DOC_URI();
  const doc = await vscode.workspace.openTextDocument(docUri);
  const insertPosition = doc.positionAt(Infinity);
  const edit = new vscode.WorkspaceEdit();
  const editText = util.stripAnsi(text);
  edit.insert(docUri, insertPosition, editText);
  if (!((await vscode.workspace.applyEdit(edit)) && (await doc.save()))) {
    return;
  }
  onAppended?.(
    new vscode.Location(docUri, insertPosition),
    new vscode.Location(docUri, doc.positionAt(Infinity))
  );
  const editors = visibleResultsEditors();
  editors.forEach((editor) => {
    util.scrollToBottom(editor);
    highlight(editor);
  });
}

export type ResultsBuffer = ResultsBufferEntry[];

export type ResultsBufferEntry = {
  text: string;
  onAppended?: OnAppendedCallback;
};

export interface OnAppendedCallback {
  (insertLocation: vscode.Location, newPosition?: vscode.Location): any;
}

let resultsBuffer: ResultsBuffer = [];

async function writeNextOutputBatch() {
  if (!resultsBuffer[0]) {
    return;
  }
  // Any entries that contain onAppended are not batched with other pending
  // entries to simplify providing the correct insert position to the callback.
  if (resultsBuffer[0].onAppended) {
    return await writeToResultsDoc(resultsBuffer.shift());
  }
  // Batch all remaining entries up until another onAppended callback.
  const [nextText, remaining] = splitEditQueueForTextBatching(resultsBuffer);
  resultsBuffer = remaining;
  await writeToResultsDoc({ text: nextText.join('') });
}

// Ensures that writeNextOutputBatch is called on buffer sequentially.
let outputPending = false;
async function flushOutput() {
  if (outputPending) {
    return;
  }
  outputPending = true;
  try {
    while (resultsBuffer.length > 0) {
      await writeNextOutputBatch();
    }
  } catch (err) {
    console.error('Error writing to results doc:', err);
  } finally {
    outputPending = false;
  }
}

/* If something must be done after a particular edit, use the onAppended callback. */
export function append(text: string, onAppended?: OnAppendedCallback): void {
  resultsBuffer.push({ text, onAppended });
  void flushOutput();
}

export function appendLine(text = '', onAppended?: OnAppendedCallback): void {
  append(`${text}\n`, onAppended);
}

export function discardPendingPrints(): void {
  resultsBuffer = [];
  appendPrompt();
}

export type OutputStacktraceEntry = { uri: vscode.Uri; line: number };

let _lastStacktrace: any[] = [];
let _lastStackTraceRange: vscode.Range | undefined;
const _stacktraceEntries = {} as OutputStacktraceEntry;

export function getStacktraceEntryForKey(key: string): OutputStacktraceEntry {
  return _stacktraceEntries[key];
}

function stackEntryString(entry: any): string {
  const name = entry.var || entry.name;
  return `${name} (${entry.file}:${entry.line})`;
}

export function saveStacktrace(stacktrace: any[]): void {
  if (stacktrace === undefined || stacktrace.length === 0) {
    return;
  }
  _lastStacktrace = [];
  stacktrace
    .filter((entry) => {
      return (
        !entry.flags.includes('dup') &&
        !['clojure.lang.RestFn', 'clojure.lang.AFn'].includes(entry.class)
      );
    })
    .forEach((entry) => {
      entry.string = stackEntryString(entry);
      _lastStacktrace.push(entry);
      const fileUrl = entry['file-url'];
      if (typeof fileUrl === 'string') {
        _stacktraceEntries[entry.string] = {
          uri: vscode.Uri.parse(fileUrl),
          line: entry.line,
        };
      }
    });
}

export function markLastStacktraceRange(location: vscode.Location): void {
  _lastStackTraceRange = location.range; //new vscode.Range(newPosition, newPosition);
}

export function getLastStackTraceRange(): vscode.Range | undefined {
  return _lastStackTraceRange;
}

export function printLastStacktrace(): void {
  const text = _lastStacktrace.map((entry) => entry.string).join('\n');
  appendLine(text, (_location) => {
    _lastStackTraceRange = undefined;
  });
}

export function appendPrompt(onAppended?: OnAppendedCallback) {
  appendLine(getPrompt(), onAppended);
}

function getUriForCurrentNamespace(): Promise<vscode.Uri> {
  return namespace.getUriForNamespace(getSession(), getNs());
}
