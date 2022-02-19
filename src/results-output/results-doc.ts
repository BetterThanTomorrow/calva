import * as path from 'path';
import * as vscode from 'vscode';
import * as state from '../state';
import { highlight } from '../highlight/src/extension';
import { NReplSession } from '../nrepl';
import * as util from '../utilities';
import select from '../select';
import { formatCode } from '../calva-fmt/src/format';
import * as namespace from '../namespace';
import * as config from '../config';
import type { ReplSessionType } from '../config';
import * as replHistory from './repl-history';
import * as docMirror from '../doc-mirror/index';
import { PrintStackTraceCodelensProvider } from '../providers/codelense';
import * as replSession from '../nrepl/repl-session';
import { splitEditQueueForTextBatching } from './util';

const RESULTS_DOC_NAME = `output.${config.REPL_FILE_EXT}`;

const PROMPT_HINT = '; Use `alt+enter` to evaluate';

const START_GREETINGS =
    '; This is the Calva evaluation results output window.\n\
; TIPS: The keyboard shortcut `ctrl+alt+o o` shows and focuses this window\n\
;   when connected to a REPL session.\n\
; Please see https://calva.io/output/ for more info.\n\
; Happy coding! ♥️';

export const CLJ_CONNECT_GREETINGS =
    '; TIPS: \n\
;   - You can edit the contents here. Use it as a REPL if you like.\n\
;   - `alt+enter` evaluates the current top level form.\n\
;   - `ctrl+enter` evaluates the current form.\n\
;   - `alt+up` and `alt+down` traverse up and down the REPL command history\n\
;      when the cursor is after the last contents at the prompt\n\
;   - Clojure lines in stack traces are peekable and clickable.';

export const CLJS_CONNECT_GREETINGS =
    '; TIPS: You can choose which REPL to use (clj or cljs):\n\
;    *Calva: Toggle REPL connection*\n\
;    (There is a button in the status bar for this)';

function outputFileDir() {
    const projectRoot = state.getProjectRootUri();
    try {
        return vscode.Uri.joinPath(projectRoot, '.calva', 'output-window');
    } catch {
        return vscode.Uri.file(
            path.join(projectRoot.fsPath, '.calva', 'output-window')
        );
    }
}

const DOC_URI = () => {
    return vscode.Uri.joinPath(outputFileDir(), RESULTS_DOC_NAME);
};

let _sessionType: ReplSessionType = 'clj';
const _sessionInfo: { [id: string]: { ns?: string; session?: NReplSession } } =
    {
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
        prompt = `${prompt} ${PROMPT_HINT}`;
    }
    return prompt;
}

export function getNs(): string {
    return _sessionInfo[_sessionType].ns;
}

export function getSessionType(): ReplSessionType {
    return _sessionType;
}

export function getSession(): NReplSession {
    return _sessionInfo[_sessionType].session;
}

export function setSession(session: NReplSession, newNs: string): void {
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

export function isResultsDoc(doc: vscode.TextDocument): boolean {
    return doc && path.basename(doc.fileName) === RESULTS_DOC_NAME;
}

function getViewColumn(): vscode.ViewColumn {
    const column: vscode.ViewColumn = state.extensionContext.workspaceState.get(
        `outputWindowViewColumn`
    );
    return column ? column : vscode.ViewColumn.Two;
}

function setViewColumn(column: vscode.ViewColumn) {
    return state.extensionContext.workspaceState.update(
        `outputWindowViewColumn`,
        column
    );
}

export function setContextForOutputWindowActive(isActive: boolean): void {
    state.extensionContext.workspaceState.update(
        `outputWindowActive`,
        isActive
    );
    vscode.commands.executeCommand(
        'setContext',
        'calva:outputWindowActive',
        isActive
    );
}

export async function initResultsDoc(): Promise<vscode.TextDocument> {
    await vscode.workspace.fs.createDirectory(outputFileDir());
    let resultsDoc: vscode.TextDocument;
    try {
        resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
    } catch (e) {
        await util.writeTextToFile(DOC_URI(), '');
        resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
    }
    const greetings = `${START_GREETINGS}\n\n`;
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        resultsDoc.positionAt(0),
        resultsDoc.positionAt(Infinity)
    );
    edit.replace(DOC_URI(), fullRange, greetings);
    await vscode.workspace.applyEdit(edit);
    resultsDoc.save();

    if (config.getConfig().autoOpenREPLWindow) {
        const resultsEditor = await vscode.window.showTextDocument(
            resultsDoc,
            getViewColumn(),
            true
        );
        const firstPos = resultsEditor.document.positionAt(0);
        const lastPos = resultsDoc.positionAt(Infinity);
        resultsEditor.selection = new vscode.Selection(lastPos, lastPos);
        resultsEditor.revealRange(new vscode.Range(firstPos, firstPos));
    }
    // For some reason onDidChangeTextEditorViewColumn won't fire
    state.extensionContext.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((event) => {
            if (event) {
                const isOutputWindow = isResultsDoc(event.document);
                setContextForOutputWindowActive(isOutputWindow);
                if (isOutputWindow) {
                    setViewColumn(event.viewColumn);
                }
            }
        })
    );
    state.extensionContext.subscriptions.push(
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
                        } while (
                            promptCursor.getPrevToken().type !== 'prompt' &&
                            !promptCursor.atStart()
                        );
                        const submitRange =
                            selectionCursor.rangeForCurrentForm(idx);
                        submitOnEnter =
                            submitRange &&
                            submitRange[1] > promptCursor.offsetStart;
                    }
                }
            }
            vscode.commands.executeCommand(
                'setContext',
                'calva:outputWindowSubmitOnEnter',
                submitOnEnter
            );
        })
    );
    vscode.languages.registerCodeLensProvider(
        config.documentSelector,
        new PrintStackTraceCodelensProvider()
    );

    // If the output window is active when initResultsDoc is run, these contexts won't be set properly without the below
    // until the next time it's focused
    if (
        vscode.window.activeTextEditor &&
        isResultsDoc(vscode.window.activeTextEditor.document)
    ) {
        setContextForOutputWindowActive(true);
        replHistory.setReplHistoryCommandsActiveContext(
            vscode.window.activeTextEditor
        );
    }
    replHistory.resetState();
    return resultsDoc;
}

export async function openResultsDoc(): Promise<vscode.TextDocument> {
    const resultsDoc = await vscode.workspace.openTextDocument(DOC_URI());
    return resultsDoc;
}

export function revealResultsDoc(preserveFocus: boolean = true) {
    openResultsDoc().then((doc) => {
        vscode.window.showTextDocument(doc, getViewColumn(), preserveFocus);
    });
}

export async function revealDocForCurrentNS(preserveFocus: boolean = true) {
    const uri = await getUriForCurrentNamespace();
    vscode.workspace.openTextDocument(uri).then((doc) =>
        vscode.window.showTextDocument(doc, {
            preserveFocus,
        })
    );
}

export async function setNamespaceFromCurrentFile() {
    const session = replSession.getSession();
    const ns = namespace.getNamespace(util.getDocument({}));
    if (getNs() !== ns) {
        await session.eval("(in-ns '" + ns + ')', session.client.ns).value;
    }
    setSession(session, ns);
    replSession.updateReplSessionType();
}

async function appendFormGrabbingSessionAndNS(topLevel: boolean) {
    const session = replSession.getSession();
    const ns = namespace.getNamespace(util.getDocument({}));
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const selection = editor.selection;
    let code = '';
    if (selection.isEmpty) {
        const formSelection = select.getFormSelection(
            doc,
            selection.active,
            topLevel
        );
        code = formatCode(doc.getText(formSelection), doc.eol);
    } else {
        code = formatCode(doc.getText(selection), doc.eol);
    }
    if (code != '') {
        if (getNs() !== ns) {
            await session.eval("(in-ns '" + ns + ')', session.client.ns).value;
        }
        setSession(session, ns);
        append(code, (_) => revealResultsDoc(false));
    }
}

export function appendCurrentForm() {
    appendFormGrabbingSessionAndNS(false);
}

export function appendCurrentTopLevelForm() {
    appendFormGrabbingSessionAndNS(true);
}

let scrollToBottomSub: vscode.Disposable;
export interface OnAppendedCallback {
    (insertLocation: vscode.Location, newPosition?: vscode.Location): any;
}
let editQueue: [string, OnAppendedCallback][] = [];
let applyingEdit = false;
/* Because this function can be called several times asynchronously by the handling of incoming nrepl messages,
   we should never await it, because that await could possibly not return until way later, after edits that came in from elsewhere
   are also applied, causing it to wait for several edits after the one awaited. This is due to the recursion and edit queue, which help
   apply edits one after another without issues.

   If something must be done after a particular edit, use the onAppended callback. */
export function append(text: string, onAppended?: OnAppendedCallback): void {
    let insertPosition: vscode.Position;
    if (applyingEdit) {
        editQueue.push([text, onAppended]);
    } else {
        applyingEdit = true;
        vscode.workspace.openTextDocument(DOC_URI()).then((doc) => {
            const ansiStrippedText = util.stripAnsi(text);
            if (doc) {
                const edit = new vscode.WorkspaceEdit();
                const currentContent = doc.getText();
                const lastLineEmpty =
                    currentContent.match(/\n$/) || currentContent === '';
                const appendText = `${
                    lastLineEmpty ? '' : '\n'
                }${ansiStrippedText}\n`;
                insertPosition = doc.positionAt(Infinity);
                edit.insert(DOC_URI(), insertPosition, `${appendText}`);
                if (scrollToBottomSub) {
                    scrollToBottomSub.dispose();
                }
                const visibleResultsEditors: vscode.TextEditor[] = [];
                vscode.window.visibleTextEditors.forEach((editor) => {
                    if (isResultsDoc(editor.document)) {
                        visibleResultsEditors.push(editor);
                    }
                });
                if (visibleResultsEditors.length == 0) {
                    scrollToBottomSub =
                        vscode.window.onDidChangeActiveTextEditor((editor) => {
                            if (isResultsDoc(editor.document)) {
                                util.scrollToBottom(editor);
                                scrollToBottomSub.dispose();
                            }
                        });
                    state.extensionContext.subscriptions.push(
                        scrollToBottomSub
                    );
                }

                vscode.workspace.applyEdit(edit).then((success) => {
                    applyingEdit = false;
                    doc.save();
                    if (success) {
                        if (visibleResultsEditors.length > 0) {
                            visibleResultsEditors.forEach((editor) => {
                                util.scrollToBottom(editor);
                                highlight(editor);
                            });
                        }
                    }
                    if (onAppended) {
                        onAppended(
                            new vscode.Location(DOC_URI(), insertPosition),
                            new vscode.Location(
                                DOC_URI(),
                                doc.positionAt(Infinity)
                            )
                        );
                    }

                    if (editQueue.length > 0) {
                        const [textBatch, remainingEditQueue] =
                            splitEditQueueForTextBatching(editQueue, 1000);
                        if (textBatch.length > 0) {
                            editQueue = remainingEditQueue;
                            return append(textBatch.join('\n'));
                        } else {
                            return append(...editQueue.shift());
                        }
                    }
                });
            }
        });
    }
}

export function discardPendingPrints(): void {
    editQueue = [];
    appendPrompt();
}

export type OutputStacktraceEntry = { uri: vscode.Uri; line: number };

let _lastStacktrace: any[] = [];
let _lastStackTraceRange: vscode.Range;
const _stacktraceEntries = {} as OutputStacktraceEntry;

export function getStacktraceEntryForKey(key: string): OutputStacktraceEntry {
    return _stacktraceEntries[key];
}

function stackEntryString(entry: any): string {
    const type = entry.type;
    const name = entry.var || entry.name;
    return `${name} (${entry.file}:${entry.line})`;
}

export async function saveStacktrace(stacktrace: any[]): Promise<void> {
    _lastStacktrace = [];
    stacktrace
        .filter((entry) => {
            return (
                !entry.flags.includes('dup') &&
                !['clojure.lang.RestFn', 'clojure.lang.AFn'].includes(
                    entry.class
                )
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

export function getLastStackTraceRange(): vscode.Range {
    return _lastStackTraceRange;
}

export function printLastStacktrace(): void {
    const text = _lastStacktrace.map((entry) => entry.string).join('\n');
    append(text, (_location) => {
        _lastStackTraceRange = undefined;
    });
    append(getPrompt());
}

export function appendPrompt(onAppended?: OnAppendedCallback) {
    append(getPrompt(), onAppended);
}

function getUriForCurrentNamespace(): Promise<vscode.Uri> {
    return namespace.getUriForNamespace(getSession(), getNs());
}
