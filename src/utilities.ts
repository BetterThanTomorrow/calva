import * as vscode from 'vscode';
import { https } from 'follow-redirects';
import * as _ from 'lodash';
import * as state from './state';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as JSZip from 'jszip';
import * as outputWindow from './results-output/results-doc';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as url from 'url';
import { isUndefined } from 'lodash';
import { isNullOrUndefined } from 'util';

const specialWords = ['-', '+', '/', '*']; //TODO: Add more here
const syntaxQuoteSymbol = '`';

export function capitalize(str: string) {
  return str.length === 0 ? str : str[0].toUpperCase() + str.substring(1);
}

export function stripAnsi(str: string) {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g,
    ''
  );
}

export const isDefined = <T>(value: T | undefined | null): value is T => {
  return !isNullOrUndefined(value);
};

// This needs to be a function and not an arrow function
// because assertion types are special.
export function assertIsDefined<T>(
  value: T | undefined | null,
  message: string | (() => string)
): asserts value is T {
  if (isNullOrUndefined(value)) {
    throw new Error(typeof message === 'string' ? message : message());
  }
}

export function escapeStringRegexp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isNonEmptyString(value: any): boolean {
  return typeof value == 'string' && value.length > 0;
}

async function quickPickSingle(opts: {
  title?: string;
  values: string[];
  saveAs: string;
  default?: string;
  placeHolder: string;
  autoSelect?: boolean;
}) {
  if (opts.values.length == 0) {
    return;
  }
  const saveAs = `qps-${opts.saveAs}`;
  const selected = opts.default ?? state.extensionContext.workspaceState.get<string>(saveAs);

  let result;
  if (opts.autoSelect && opts.values.length == 1) {
    result = opts.values[0];
  } else {
    result = await quickPick(opts.values, selected ? [selected] : [], [], {
      title: opts.title,
      placeHolder: opts.placeHolder,
      ignoreFocusOut: true,
    });
  }
  void state.extensionContext.workspaceState.update(saveAs, result);
  return result;
}

async function quickPickMulti(opts: { values: string[]; saveAs: string; placeHolder: string }) {
  const saveAs = `qps-${opts.saveAs}`;
  const selected = state.extensionContext.workspaceState.get<string[]>(saveAs) || [];
  const result = await quickPick(opts.values, [], selected, {
    placeHolder: opts.placeHolder,
    canPickMany: true,
    ignoreFocusOut: true,
  });
  void state.extensionContext.workspaceState.update(saveAs, result);
  return result;
}

// Testing facility.
// Recreated every time we create a new quickPick
let quickPickActive: Promise<void>;

function quickPick(
  itemsToPick: string[],
  active: string[],
  selected: string[],
  options: vscode.QuickPickOptions & { canPickMany: true }
): Promise<string[]>;
function quickPick(
  itemsToPick: string[],
  active: string[],
  selected: string[],
  options: vscode.QuickPickOptions
): Promise<string>;

async function quickPick(
  itemsToPick: string[],
  active: string[],
  selected: string[],
  options: vscode.QuickPickOptions
): Promise<string[] | string | undefined> {
  const items = itemsToPick.map((x) => ({ label: x }));

  const qp = vscode.window.createQuickPick();
  quickPickActive = new Promise<void>((resolve) => qp.onDidChangeActive((e) => resolve()));
  qp.canSelectMany = !!options.canPickMany;
  qp.title = options.title;
  qp.placeholder = options.placeHolder;
  qp.ignoreFocusOut = !!options.ignoreFocusOut;
  qp.matchOnDescription = !!options.matchOnDescription;
  qp.matchOnDetail = !!options.matchOnDetail;
  qp.items = items;
  qp.activeItems = items.filter((x) => active.indexOf(x.label) != -1);
  qp.selectedItems = items.filter((x) => selected.indexOf(x.label) != -1);
  return new Promise<string[] | string | undefined>((resolve, reject) => {
    qp.show();
    qp.onDidAccept(() => {
      if (qp.canSelectMany) {
        resolve(qp.selectedItems.map((x) => x.label));
      } else if (qp.selectedItems.length) {
        resolve(qp.selectedItems[0].label);
      } else {
        resolve(undefined);
      }
      qp.hide();
      quickPickActive = undefined;
    });
    qp.onDidHide(() => {
      resolve([]);
      qp.hide();
      quickPickActive = undefined;
    });
  });
}

function getCljsReplStartCode() {
  return vscode.workspace.getConfiguration('calva').startCLJSREPLCommand;
}

function getShadowCljsReplStartCode(build) {
  return '(shadow.cljs.devtools.api/nrepl-select ' + build + ')';
}

function getActualWord(document, position, selected, word) {
  if (selected === undefined) {
    const selectedChar = document
        .lineAt(position.line)
        .text.slice(position.character, position.character + 1),
      isFn =
        document.lineAt(position.line).text.slice(position.character - 1, position.character) ===
        '(';
    if (selectedChar !== undefined && specialWords.indexOf(selectedChar) !== -1 && isFn) {
      return selectedChar;
    } else {
      return '';
    }
  } else {
    return word && word.startsWith(syntaxQuoteSymbol) ? word.substr(1) : word;
  }
}

function getWordAtPosition(document, position) {
  const selected = document.getWordRangeAtPosition(position),
    selectedText =
      selected !== undefined
        ? document.getText(new vscode.Range(selected.start, selected.end))
        : '',
    text = getActualWord(document, position, selected, selectedText);
  return text;
}

function tryToGetDocument(
  document: vscode.TextDocument | Record<string, never> | undefined
): vscode.TextDocument | undefined {
  const activeTextEditor = tryToGetActiveTextEditor();
  if (document && Object.prototype.hasOwnProperty.call(document, 'fileName')) {
    return document as vscode.TextDocument;
  } else if (activeTextEditor?.document && activeTextEditor.document.languageId !== 'Log') {
    return activeTextEditor.document;
  } else if (vscode.window.visibleTextEditors.length > 0) {
    const editor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document && editor.document.languageId !== 'Log'
    );
    return editor?.document;
  }
}

function getDocument(document: vscode.TextDocument | Record<string, never>): vscode.TextDocument {
  const doc = tryToGetDocument(document);

  if (isUndefined(doc)) {
    throw new Error('Expected an activeTextEditor with a document!');
  }

  return doc;
}

function getFileType(document: vscode.TextDocument | Record<string, never> | undefined) {
  const doc = tryToGetDocument(document);

  if (doc) {
    return path.extname(doc.fileName).replace(/^\./, '');
  } else {
    return 'clj';
  }
}

function getLaunchingState() {
  return cljsLib.getStateValue('launching');
}

function setLaunchingState(value: any) {
  void vscode.commands.executeCommand('setContext', 'calva:launching', Boolean(value));
  cljsLib.setStateValue('launching', value);
}

function getConnectedState() {
  return cljsLib.getStateValue('connected');
}

function setConnectedState(value: boolean) {
  void vscode.commands.executeCommand('setContext', 'calva:connected', value);
  cljsLib.setStateValue('connected', value);
}

function getConnectingState() {
  return cljsLib.getStateValue('connecting');
}

function setConnectingState(value: boolean) {
  if (value) {
    void vscode.commands.executeCommand('setContext', 'calva:connecting', true);
    cljsLib.setStateValue('connecting', true);
  } else {
    void vscode.commands.executeCommand('setContext', 'calva:connecting', false);
    cljsLib.setStateValue('connecting', false);
  }
}

// ERROR HELPERS
const ERROR_TYPE = {
  WARNING: 'warning',
  ERROR: 'error',
};

function logSuccess(results) {
  const chan = state.outputChannel();
  chan.appendLine('Evaluation completed successfully');
  _.each(results, (r) => {
    const value = Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null;
    const out = Object.prototype.hasOwnProperty.call(r, 'out') ? r.out : null;
    if (value !== null) {
      chan.appendLine('=>\n' + value);
    }
    if (out !== null) {
      chan.appendLine('out:\n' + out);
    }
  });
}

function logError(error) {
  outputWindow.append('; ' + error.reason);
  if (
    error.line !== undefined &&
    error.line !== null &&
    error.column !== undefined &&
    error.column !== null
  ) {
    outputWindow.append(';   at line: ' + error.line + ' and column: ' + error.column);
  }
}

function markError(error) {
  if (error.line === null) {
    error.line = 0;
  }
  if (error.column === null) {
    error.column = 0;
  }

  const diagnostic = cljsLib.getStateValue('diagnosticCollection'),
    editor = getActiveTextEditor();

  //editor.selection = new vscode.Selection(position, position);
  const line = error.line - 1,
    column = error.column,
    lineLength = editor.document.lineAt(line).text.length,
    lineText = editor.document.lineAt(line).text.substring(column, lineLength),
    firstWordStart = column + lineText.indexOf(' '),
    existing = diagnostic.get(editor.document.uri),
    err = new vscode.Diagnostic(
      new vscode.Range(line, column, line, firstWordStart),
      error.reason,
      vscode.DiagnosticSeverity.Error
    );

  const errors = existing !== undefined && existing.length > 0 ? [...existing, err] : [err];
  diagnostic.set(editor.document.uri, errors);
}

function logWarning(warning) {
  outputWindow.append('; ' + warning.reason);
  if (warning.line !== null) {
    if (warning.column !== null) {
      outputWindow.append(';   at line: ' + warning.line + ' and column: ' + warning.column);
    } else {
      outputWindow.append(';   at line: ' + warning.line);
    }
  }
}

function markWarning(warning) {
  if (warning.line === null) {
    warning.line = 0;
  }
  if (warning.column === null) {
    warning.column = 0;
  }

  const diagnostic = cljsLib.getStateValue('diagnosticCollection'),
    editor = getActiveTextEditor();

  //editor.selection = new vscode.Selection(position, position);
  const line = Math.max(0, warning.line - 1),
    column = warning.column,
    lineLength = editor.document.lineAt(line).text.length,
    existing = diagnostic.get(editor.document.uri),
    warn = new vscode.Diagnostic(
      new vscode.Range(line, column, line, lineLength),
      warning.reason,
      vscode.DiagnosticSeverity.Warning
    );

  const warnings = existing !== undefined && existing.length > 0 ? [...existing, warn] : [warn];
  diagnostic.set(editor.document.uri, warnings);
}

async function promptForUserInputString(prompt: string): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: prompt,
    ignoreFocusOut: true,
  });
}

function filterVisibleRanges(
  editor: vscode.TextEditor,
  ranges: vscode.Range[],
  combine = true
): vscode.Range[] {
  let filtered: vscode.Range[] = [];
  editor.visibleRanges.forEach((visibleRange) => {
    const visibles = ranges.filter((r) => {
      return (
        visibleRange.contains(r.start) || visibleRange.contains(r.end) || r.contains(visibleRange)
      );
    });
    filtered = filtered.concat(
      combine ? [new vscode.Range(visibles[0].start, visibles[visibles.length - 1].end)] : visibles
    );
  });
  return filtered;
}

function scrollToBottom(editor: vscode.TextEditor) {
  const lastPos = editor.document.positionAt(Infinity);
  editor.selection = new vscode.Selection(lastPos, lastPos);
  editor.revealRange(new vscode.Range(lastPos, lastPos));
}

async function getFileContents(path: string) {
  const doc = vscode.workspace.textDocuments.find(
    (d) => d.uri.path === path && d.uri.scheme === 'file'
  );
  if (doc) {
    return doc.getText();
  }
  if (path.match(/jar!\//)) {
    return await getJarContents(path);
  }
  return fs.readFileSync(path).toString();
}

function jarFilePathComponents(uri: vscode.Uri | string) {
  const rawPath = typeof uri === 'string' ? uri : uri.path;
  const replaceRegex = os.platform() === 'win32' ? /file:\/*/ : /file:/;
  return rawPath.replace(replaceRegex, '').split('!/');
}

/**
 * Gets the contents of a file in a zip
 * @param uri url to jar file, followed by "!/" and than the url inside the jar
 * @returns contents of the file or an empty string
 */
async function getJarContents(uri: vscode.Uri | string) {
  return new Promise<string>((resolve, _reject) => {
    const [pathToJar, pathToFileInJar] = jarFilePathComponents(uri);

    fs.readFile(pathToJar, (err, data) => {
      const zip = new JSZip();
      zip
        .loadAsync(data)
        .then((new_zip) => {
          const fileInJar = new_zip.file(pathToFileInJar);

          if (fileInJar) {
            return fileInJar.async('string').then((value) => {
              resolve(value);
            });
          }

          return resolve('');
        })
        .catch((_) => {
          return resolve('');
        });
    });
  });
}

function sortByPresetOrder(arr: any[], presetOrder: any[]) {
  const result: any[] = [];
  presetOrder.forEach((preset) => {
    if (arr.indexOf(preset) != -1) {
      result.push(preset);
    }
  });
  return [...result, ...arr.filter((e) => !presetOrder.includes(e))];
}

function writeTextToFile(uri: vscode.Uri, text: string): Thenable<void> {
  const ab = new ArrayBuffer(text.length);
  const ui8a = new Uint8Array(ab);
  for (let i = 0, strLen = text.length; i < strLen; i++) {
    ui8a[i] = text.charCodeAt(i);
  }
  return vscode.workspace.fs.writeFile(uri, ui8a);
}

async function downloadFromUrl(url: string, savePath: string) {
  return new Promise((resolve, reject) => {
    const saveFile = fs.createWriteStream(savePath);
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        res.pipe(saveFile);
      } else {
        saveFile.close();
        reject(new Error(`Server responded with ${res.statusCode}: ${res.statusMessage}`));
      }
      res.on('end', () => {
        saveFile.close();
        resolve(true);
      });
      res.on('error', (err: any) => {
        console.error(`Error downloading file from ${url}: ${err.message}`);
        reject(err);
      });
    });
  });
}

async function fetchFromUrl(fullUrl: string): Promise<string> {
  const q = url.parse(fullUrl);
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          host: q.hostname,
          path: q.pathname,
          port: q.port,
          headers: { 'user-agent': 'node.js' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: any) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        }
      )
      .on('error', (err: any) => {
        console.error(`Error downloading file from ${url}: ${err.message}`);
        reject(err);
      });
  });
}

function randomSlug(length = 7) {
  return Math.random().toString(36).substring(7);
}

function calvaTmpDir() {
  return path.join(os.tmpdir(), 'betterthantomorrow.calva');
}

const isWindows = process.platform === 'win32';

export async function isDocumentWritable(document: vscode.TextDocument): Promise<boolean> {
  if (!vscode.workspace.fs.isWritableFileSystem(document.uri.scheme)) {
    return false;
  }
  const fileStat = await vscode.workspace.fs.stat(document.uri);

  // I'm not sure in which cases fileStat permissions can be missing
  // and so it's not clear what to do if it is. For the moment we can
  // ignore this to maintain current behavior.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
  return (fileStat.permissions! & vscode.FilePermission.Readonly) !== 1;
}

// Returns the elements of coll with duplicates removed
// (See clojure.core/distinct).
function distinct<T>(coll: T[]): T[] {
  return [...new Set(coll)];
}

function tryToGetActiveTextEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}

function getActiveTextEditor(): vscode.TextEditor {
  const editor = tryToGetActiveTextEditor();

  if (isUndefined(editor)) {
    throw new Error('Expected active text editor!');
  }

  return editor;
}

function pathExists(path: string): boolean {
  return fs.existsSync(path);
}

export {
  distinct,
  getWordAtPosition,
  tryToGetDocument,
  getDocument,
  getFileType,
  getLaunchingState,
  setLaunchingState,
  getConnectedState,
  setConnectedState,
  getConnectingState,
  setConnectingState,
  specialWords,
  ERROR_TYPE,
  logError,
  markError,
  logWarning,
  markWarning,
  logSuccess,
  getCljsReplStartCode,
  getShadowCljsReplStartCode,
  quickPickActive,
  quickPick,
  quickPickSingle,
  quickPickMulti,
  promptForUserInputString,
  filterVisibleRanges,
  scrollToBottom,
  getFileContents,
  jarFilePathComponents,
  getJarContents,
  sortByPresetOrder,
  writeTextToFile,
  downloadFromUrl,
  fetchFromUrl,
  cljsLib,
  randomSlug,
  isWindows,
  tryToGetActiveTextEditor,
  getActiveTextEditor,
  pathExists,
  calvaTmpDir,
};
