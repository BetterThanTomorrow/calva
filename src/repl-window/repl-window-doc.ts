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
import { formatAsLineComments, splitEditQueueForTextBatching } from '../results-output/util';
import * as output from '../results-output/output';

const REPL_DOC_NAME = `repl.${config.REPL_FILE_EXT}`;

const PROMPT_HINT = 'Use `alt+enter` to evaluate';

const START_GREETINGS = [
  'This is the Calva REPL Window.',
  "It's just a file, really, with some special treatment from Calva.",
  'Use it as a REPL input prompt if you like. (When the REPL is connected.)',
  'TIPS: The keyboard shortcut `ctrl+alt+o r` shows and focuses this window',
  'Please see https://calva.io/repl-window/ for more info.',
  'Happy coding! ♥️',
].join(`\n`);

const OUTPUT_DESTINATION_SETTINGS_MESSAGE = `

This file is configured as the output destination for all REPL output.
You can configure this with the setting:
  "calva.outputDestinations"
`;

function outputDestinationSettingMessage() {
  if (
    JSON.stringify(config.getConfig().outputDestinations) ===
    JSON.stringify(output.defaultDestinationConfiguration)
  ) {
    return OUTPUT_DESTINATION_SETTINGS_MESSAGE;
  }
  return '';
}

export const CLJ_CONNECT_GREETINGS = [
  'TIPS: As with any Clojure file when the REPL is connected:',
  '- `alt+enter` evaluates the current top level form.',
  '- `ctrl+enter` evaluates the current form.',
  'Special for this file:',
  '- `alt+up` and `alt+down` traverse up and down the REPL command history',
  '   when the cursor is after the last contents at the prompt',
  '',
  'See also the Calva Inspector: https://calva.io/inspector/',
].join(`\n`);

export const CLJS_CONNECT_GREETINGS = [
  'TIPS: You can choose which REPL to use (clj or cljs):',
  '   *Calva: REPL Sessions*',
  '   (Click the session indicator in the status bar to open it)',
].join(`\n`);

function computeDocUri(): vscode.Uri {
  const projectRoot = state.getProjectRootUri();
  util.assertIsDefined(projectRoot, 'Expected there to be a project root!');
  try {
    return vscode.Uri.joinPath(projectRoot, '.calva', REPL_DOC_NAME);
  } catch {
    return vscode.Uri.file(path.join(projectRoot.fsPath, '.calva', REPL_DOC_NAME));
  }
}

let _docUri: vscode.Uri | undefined;

function getDocUri(): vscode.Uri {
  if (!_docUri) {
    _docUri = computeDocUri();
  }
  return _docUri;
}

function getDocDir(): vscode.Uri {
  return vscode.Uri.joinPath(getDocUri(), '..');
}

type SessionInfo = {
  ns?: string;
  session?: NReplSession;
};

let _sessionType: ReplSessionType = 'clj';
const _sessionInfo: Record<string, SessionInfo> = {
  clj: {},
  cljs: {},
};
const showPrompt: Record<string, boolean> = {
  clj: true,
  cljs: true,
};

function ensureSessionEntries(sessionType: string) {
  if (!_sessionInfo[sessionType]) {
    _sessionInfo[sessionType] = {};
  }
  if (!Object.prototype.hasOwnProperty.call(showPrompt, sessionType)) {
    showPrompt[sessionType] = true;
  }
}

function resolveSessionType(session?: NReplSession, override?: string): ReplSessionType {
  if (override) {
    return override;
  }
  const metadataKey = (session as any)?._calvaSessionMetadata?.key;
  if (metadataKey) {
    return metadataKey;
  }
  if (session?.replType) {
    return session.replType;
  }
  return _sessionType;
}

export function getPrompt(): string {
  ensureSessionEntries(_sessionType);
  // eslint-disable-next-line no-irregular-whitespace
  let prompt = `${_sessionType}꞉${getNs()}꞉> `;
  if (showPrompt[_sessionType]) {
    showPrompt[_sessionType] = false;
    prompt = `${prompt} ${formatAsLineComments(PROMPT_HINT)}`;
  }
  return prompt;
}

export function getNs(): string | undefined {
  ensureSessionEntries(_sessionType);
  return _sessionInfo[_sessionType].ns;
}

export function getSessionType(): ReplSessionType {
  return _sessionType;
}

export function getSession(): NReplSession | undefined {
  ensureSessionEntries(_sessionType);
  return _sessionInfo[_sessionType].session;
}

export function setSession(session: NReplSession, newNs?: string, sessionKey?: string): void {
  const resolvedType = resolveSessionType(session, sessionKey);
  ensureSessionEntries(resolvedType);
  _sessionType = resolvedType;

  if (session) {
    _sessionInfo[resolvedType].session = session;
  }
  if (newNs) {
    _sessionInfo[resolvedType].ns = newNs;
  }
}

export function isReplWindowDoc(doc?: vscode.TextDocument): boolean {
  if (!doc || !_docUri) {
    return false;
  }
  return doc.uri.toString() === _docUri.toString();
}

/**
 * Checks if a document looks like a Calva REPL window file.
 * Must have `.calva-repl` extension AND be in a `.calva` directory.
 */
function looksLikeReplWindowFile(doc?: vscode.TextDocument): boolean {
  if (!doc) {
    return false;
  }
  const fileName = doc.fileName;
  const looksLikeCurrentReplWindowFile = fileName.endsWith(`${path.sep}.calva/${REPL_DOC_NAME}`);
  const looksLikeLegacyReplWindowFile = fileName.endsWith(
    `${path.sep}.calva${path.sep}output-window${path.sep}output.calva-repl`
  );
  return looksLikeCurrentReplWindowFile || looksLikeLegacyReplWindowFile;
}

// Track which files have been warned to avoid repeated warnings
const warnedFiles = new Set<string>();

async function warnIfNotActiveReplWindow(doc: vscode.TextDocument): Promise<void> {
  // Only warn if the repl is connected and there IS an active REPL window to compare against
  if (!util.getConnectedState() || !_docUri) {
    return;
  }

  if (!looksLikeReplWindowFile(doc) || isReplWindowDoc(doc)) {
    return;
  }

  const fileKey = doc.uri.toString();
  if (warnedFiles.has(fileKey)) {
    return;
  }
  warnedFiles.add(fileKey);

  return vscode.window
    .showWarningMessage(
      'This file is NOT the active Calva REPL Window. To open the active REPL Window, use the command: Calva: Show/Open REPL Window',
      'Open REPL Window'
    )
    .then((selection) => {
      if (selection === 'Open REPL Window') {
        void revealReplWindowDoc(false);
      }
    });
}

// Track if we've already informed user about results going elsewhere
let havePrintedResultsElsewhereMessage = false;

/**
 * When evaluating in the REPL window but results are configured to go elsewhere,
 * prints a one-time informational message to the REPL window.
 */
export function maybePrintResultsInOtherDestinationMessage(): void {
  if (output.getDestinationConfiguration().evalResults === 'repl-window') {
    return;
  }
  if (havePrintedResultsElsewhereMessage) {
    return;
  }
  havePrintedResultsElsewhereMessage = true;

  const destination = output.getDestinationConfiguration().evalResults;
  const destinationNames: Record<output.OutputDestination, string> = {
    'repl-window': 'REPL Window',
    'output-channel': 'Output Channel',
    terminal: 'Output Terminal',
    'output-view': 'Output View',
  };
  const destinationName = destinationNames[destination] || destination;

  const message = `Results are configured to appear in the ${destinationName}.
To reveal the output, use the command:
> Calva: Show/Open the result output destination`;
  appendLine();
  appendLine(formatAsLineComments(message));
}

function getViewColumn(): vscode.ViewColumn {
  const column: vscode.ViewColumn | undefined =
    state.extensionContext.workspaceState.get(`replWindowViewColumn`);
  return column ? column : vscode.ViewColumn.Two;
}

function setViewColumn(column: vscode.ViewColumn | undefined) {
  return state.extensionContext.workspaceState.update(`replWindowViewColumn`, column);
}

export function setContextForReplWindowActive(isActive: boolean): void {
  void state.extensionContext.workspaceState.update(`outputWindowActive`, isActive);
  void vscode.commands.executeCommand('setContext', 'calva:outputWindowActive', isActive);
}

export function registerSubmitOnEnterHandler(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      let submitOnEnter = false;
      if (event.textEditor) {
        const document = event.textEditor.document;
        if (isReplWindowDoc(document)) {
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
        'calva:replWindowSubmitOnEnter',
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
        const isReplWindow = isReplWindowDoc(event.document);
        setContextForReplWindowActive(isReplWindow);
        if (isReplWindow) {
          void setViewColumn(event.viewColumn);
        } else {
          // Warn if user opened a .calva-repl file that isn't the active REPL window
          void warnIfNotActiveReplWindow(event.document);
        }
      }
    })
  );
  // If the repl window is active when initReplWindowDoc is run, these contexts won't be set properly without the below
  // until the next time it's focused
  const activeTextEditor = util.tryToGetActiveTextEditor();
  if (activeTextEditor && isReplWindowDoc(activeTextEditor.document)) {
    setContextForReplWindowActive(true);
    replHistory.setReplHistoryCommandsActiveContext(activeTextEditor);
  }
}

export async function clearReplWindowDoc() {
  const docUri = getDocUri();
  await vscode.workspace.fs.createDirectory(getDocDir());
  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(docUri);
  } catch {
    await util.writeTextToFile(docUri, '');
    doc = await vscode.workspace.openTextDocument(docUri);
  }
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(Infinity));
  edit.replace(docUri, fullRange, '');
  await vscode.workspace.applyEdit(edit);
  await doc.save();
}

export async function initReplWindowDoc(): Promise<vscode.TextDocument> {
  const docUri = getDocUri();
  await vscode.workspace.fs.createDirectory(getDocDir());
  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(docUri);
  } catch (e) {
    await util.writeTextToFile(docUri, '');
    doc = await vscode.workspace.openTextDocument(docUri);
  }
  if (config.getConfig().autoOpenREPLWindow) {
    const resultsEditor = await vscode.window.showTextDocument(doc, getViewColumn(), true);
    const firstPos = resultsEditor.document.positionAt(0);
    const lastPos = doc.positionAt(Infinity);
    resultsEditor.selections = [new vscode.Selection(lastPos, lastPos)];
    resultsEditor.revealRange(new vscode.Range(firstPos, firstPos));
  }
  if (config.getConfig().autoOpenResultOutputDestination) {
    void output.showResultOutputDestination(true);
  }
  if (_docUri) {
    return doc;
  }

  const greetings = `${formatAsLineComments(START_GREETINGS)}\n\n${formatAsLineComments(
    CLJ_CONNECT_GREETINGS
  )}${outputDestinationSettingMessage()}\n\n`;
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(Infinity));
  edit.replace(docUri, fullRange, greetings);
  await vscode.workspace.applyEdit(edit);
  void doc.save();

  registerReplWindowDocSubscriptions();

  vscode.languages.registerCodeLensProvider(
    config.documentSelector,
    new PrintStackTraceCodelensProvider()
  );

  replHistory.resetState();
  return doc;
}

export async function openReplWindowDoc(): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(getDocUri());
  return doc;
}

export function revealReplWindowDoc(preserveFocus = true) {
  return openReplWindowDoc().then((doc) => {
    return vscode.window.showTextDocument(doc, getViewColumn(), preserveFocus);
  });
}

export async function revealReplWindowDocForCurrentNS(preserveFocus = true) {
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
    vscode.window.activeTextEditor?.selections[0]?.active
  );
  setSession(session, ns);
  replSession.updateReplSessionType();
  output.replWindowAppendPrompt();
}

function appendFormGrabbingSessionAndNS(topLevel: boolean): void {
  const session = replSession.getSession();
  const [ns, _] = namespace.getNamespace(
    util.tryToGetDocument({}),
    vscode.window.activeTextEditor?.selections[0]?.active
  );
  const editor = util.getActiveTextEditor();
  const doc = editor.document;
  const selection = editor.selections[0];
  let code = '';
  if (selection.isEmpty) {
    const formSelection = select.getFormSelection(doc, selection.active, topLevel);
    code = formatCode(doc.getText(formSelection), doc.eol);
  } else {
    code = formatCode(doc.getText(selection), doc.eol);
  }
  if (code != '') {
    setSession(session, ns);
    appendLine(code, (_) => revealReplWindowDoc(false));
  }
}

export function appendCurrentForm() {
  appendFormGrabbingSessionAndNS(false);
}

export function appendCurrentTopLevelForm() {
  appendFormGrabbingSessionAndNS(true);
}

export async function lastLineIsEmpty(): Promise<boolean> {
  try {
    const doc = await vscode.workspace.openTextDocument(getDocUri());
    return util.lastLineIsEmpty(doc);
  } catch (error) {
    console.error('Failed opening REPL window doc', error);
  }
}

function visibleReplWindowEditors(): vscode.TextEditor[] {
  return vscode.window.visibleTextEditors.filter((editor) => isReplWindowDoc(editor.document));
}

function handleReplWindowDocEditorDidOpen(editor: vscode.TextEditor) {
  util.scrollToBottom(editor);
}

function registerReplWindowDocSubscriptions() {
  let currentResultDocs = visibleReplWindowEditors();
  const subOpen = vscode.window.onDidChangeVisibleTextEditors((editors) => {
    const current = editors.filter((editor) => isReplWindowDoc(editor.document));
    const opened = current.filter((editor) => currentResultDocs.includes(editor));
    currentResultDocs = current;
    opened.forEach(handleReplWindowDocEditorDidOpen);
  });
  state.extensionContext.subscriptions.push(subOpen);
}

async function writeToReplWindowDoc({ text, onAppended }: ResultsBufferEntry): Promise<void> {
  const docUri = getDocUri();
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
  const editors = visibleReplWindowEditors();
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
    return await writeToReplWindowDoc(resultsBuffer.shift());
  }
  // Batch all remaining entries up until another onAppended callback.
  const [nextText, remaining] = splitEditQueueForTextBatching(resultsBuffer);
  resultsBuffer = remaining;
  await writeToReplWindowDoc({ text: nextText.join('') });
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
    console.error('Error writing to REPL window doc:', err);
  } finally {
    outputPending = false;
  }
}

let lastAppended = '';

/* If something must be done after a particular edit, use the onAppended callback. */
export function append(text: string, onAppended?: OnAppendedCallback): void {
  lastAppended = text;
  resultsBuffer.push({ text, onAppended });
  void flushOutput();
}

export function appendLine(text = '', onAppended?: OnAppendedCallback): void {
  append(`${text}\n`, onAppended);
}

export function discardPendingPrints(): void {
  resultsBuffer = [];
  output.replWindowAppendPrompt();
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
  const prompt = getPrompt();
  if (!lastAppended.trimEnd().endsWith(prompt.trimEnd())) {
    appendLine(getPrompt(), onAppended);
  } else if (onAppended) {
    // Resolve promise though no append is actually needed
    onAppended(undefined);
  }
}

export function forceAppendPrompt(onAppended?: OnAppendedCallback) {
  appendLine(getPrompt(), onAppended);
}

function getUriForCurrentNamespace(): Promise<vscode.Uri> {
  return namespace.getUriForNamespace(getSession(), getNs());
}
