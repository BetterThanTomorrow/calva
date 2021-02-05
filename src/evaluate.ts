import * as vscode from 'vscode';
import * as state from './state';
import annotations from './providers/annotations';
import * as path from 'path';
import select from './select';
import * as util from './utilities';
import { NReplSession, NReplEvaluation } from './nrepl';
import statusbar from './statusbar';
import { PrettyPrintingOptions } from './printer';
import * as outputWindow from './results-output/results-doc';
import { DEBUG_ANALYTICS } from './debugger/calva-debug';
import * as namespace from './namespace';
import * as replHistory from './results-output/repl-history';
import { formatAsLineComments } from './results-output/util';
import * as fs from 'fs';

function interruptAllEvaluations() {
    if (util.getConnectedState()) {
        let msgs: string[] = [];
        let nums = NReplEvaluation.interruptAll((msg) => {
            msgs.push(msg);
        })
        if (msgs.length) {
            outputWindow.append(normalizeNewLinesAndJoin(msgs));
        }
        NReplSession.getInstances().forEach((session, _index) => {
            session.interruptAll();
        });
        if (nums > 0) {
            vscode.window.showInformationMessage(`Interrupted ${nums} running evaluation(s).`);
        } else {
            vscode.window.showInformationMessage('Interruption command finished (unknown results)');
        }
        return;
    }
    vscode.window.showInformationMessage("Not connected to a REPL server");
}

function addAsComment(c: number, result: string, codeSelection: vscode.Selection, editor: vscode.TextEditor, selection: vscode.Selection) {
    const indent = `${' '.repeat(c)}`, output = result.replace(/\n\r?$/, "").split(/\n\r?/).join(`\n${indent};;    `), edit = vscode.TextEdit.insert(codeSelection.end, `\n${indent};; => ${output}\n`), wsEdit = new vscode.WorkspaceEdit();
    wsEdit.set(editor.document.uri, [edit]);
    vscode.workspace.applyEdit(wsEdit).then((_v) => {
        editor.selection = selection;
    });
}

async function evaluateCode(code: string, options, selection?: vscode.Selection): Promise<void> {
    const pprintOptions = options.pprintOptions || state.config().prettyPrintingOptions;
    const line = options.line;
    const column = options.column;
    const filePath = options.filePath;
    const session: NReplSession = options.session;
    const ns = options.ns;

    if (code.length > 0) {
        let err: string[] = [];

        if (outputWindow.getNs() !== ns) {
            await session.eval("(in-ns '" + ns + ")", session.client.ns).value;
        }

        let context: NReplEvaluation = session.eval(code, ns, {
            file: filePath,
            line: line + 1,
            column: column + 1,
            stdout: (m) => {
                outputWindow.append(normalizeNewLines(m));
            },
            stderr: m => err.push(m),
            pprintOptions: pprintOptions
        });

        try {
            let value = await context.value;
            value = util.stripAnsi(context.pprintOut || value);
            outputWindow.append(value, (resultLocation) => {
                if (selection) {
                    const c = selection.start.character;
                    const editor = vscode.window.activeTextEditor;
                    if (options.replace) {
                        const indent = `${' '.repeat(c)}`,
                            edit = vscode.TextEdit.replace(selection, value.replace(/\n/gm, "\n" + indent)),
                            wsEdit = new vscode.WorkspaceEdit();
                        wsEdit.set(editor.document.uri, [edit]);
                        vscode.workspace.applyEdit(wsEdit);
                    } else if (options.comment) {
                        addAsComment(c, value, selection, editor, selection);
                    } else {
                        if (!outputWindow.isResultsDoc(editor.document)) {
                            annotations.decorateSelection(value, selection, editor, editor.selection.active, resultLocation, annotations.AnnotationStatus.SUCCESS);
                            annotations.decorateResults(value, false, selection, editor);
                        }
                    }
                }
            });
            // May need to move this inside of onResultsAppended callback above, depending on desired ordering of appended results
            if (err.length > 0) {
                const errMsg = `; ${normalizeNewLinesAndJoin(err, true)}`
                if (context.stacktrace) {
                    outputWindow.saveStacktrace(context.stacktrace);
                    outputWindow.append(errMsg, (_, afterResultLocation) => {
                        outputWindow.markLastStacktraceRange(afterResultLocation);
                    });
                } else {
                    outputWindow.append(errMsg);
                }
            }
        } catch (e) {
            const outputWindowError = err.length ? `; ${normalizeNewLinesAndJoin(err, true)}` : formatAsLineComments(e);
            outputWindow.append(outputWindowError, async (resultLocation, afterResultLocation) => {
                if (selection) {
                    const editor = vscode.window.activeTextEditor;
                    const editorError = util.stripAnsi(err.length ? err.join("\n") : e);
                    const currentCursorPos = editor.selection.active;
                    if (!outputWindow.isResultsDoc(editor.document)) {
                        annotations.decorateSelection(editorError, selection, editor, currentCursorPos, resultLocation, annotations.AnnotationStatus.ERROR);
                        annotations.decorateResults(editorError, true, selection, editor);
                    }
                    if (options.asComment) {
                        addAsComment(selection.start.character, editorError, selection, editor, selection);
                    }
                }
                if (context.stacktrace && context.stacktrace.stacktrace) {
                    outputWindow.markLastStacktraceRange(afterResultLocation);
                }
            });
            if (context.stacktrace && context.stacktrace.stacktrace) {
                outputWindow.saveStacktrace(context.stacktrace.stacktrace);
            }
        }
        outputWindow.setSession(session, context.ns || ns);
        namespace.updateREPLSessionType();
    }
}

async function evaluateSelection(document: {}, options) {
    const current = state.deref();
    const doc = util.getDocument(document);
    const topLevel = options.topLevel || false;

    if (current.get('connected')) {
        const editor = vscode.window.activeTextEditor;
        const selection = editor.selection;
        let code = "";
        let codeSelection: vscode.Selection;
        if (selection.isEmpty || topLevel) {
            state.analytics().logEvent("Evaluation", topLevel ? "TopLevel" : "CurrentForm").send();
            codeSelection = select.getFormSelection(doc, selection.active, topLevel);
            code = doc.getText(codeSelection);
        } else {
            state.analytics().logEvent("Evaluation", "Selection").send();
            codeSelection = selection;
            code = doc.getText(selection);
        }
        const ns = namespace.getNamespace(doc);
        const line = codeSelection.start.line;
        const column = codeSelection.start.character;
        const filePath = doc.fileName;
        const session = namespace.getSession(util.getFileType(doc));

        if (outputWindow.isResultsDoc(doc)) {
            replHistory.addToReplHistory(session.replType, code);
            replHistory.resetState();
        }

        if (code.length > 0) {
            if (options.debug) {
                code = '#dbg\n' + code;
            }
            annotations.decorateSelection("", codeSelection, editor, undefined, undefined, annotations.AnnotationStatus.PENDING);
            await evaluateCode(code, { ...options, ns, line, column, filePath, session }, codeSelection);
            outputWindow.appendPrompt();
        }
    } else {
        vscode.window.showErrorMessage("Not connected to a REPL");
    }
}

function printWarningForError(e: any) {
    console.warn(`Unhandled error: ${e.message}`);
}

function normalizeNewLines(str: string, asLineComment = false): string {
    const s = str.replace(/\n\r?$/, "");
    return asLineComment ? s.replace(/\n\r?/, "\n; ") : s;
}

function normalizeNewLinesAndJoin(strings: string[], asLineComment = false): string {
    return strings.map((s) => normalizeNewLines(s, asLineComment), asLineComment).join(`\n${asLineComment ? '; ' : ''}`);
}

function evaluateSelectionReplace(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { replace: true, pprintOptions: state.config().prettyPrintingOptions }))
        .catch(printWarningForError);
}

function evaluateSelectionAsComment(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { comment: true, pprintOptions: state.config().prettyPrintingOptions }))
        .catch(printWarningForError);
}

function evaluateTopLevelFormAsComment(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { comment: true, topLevel: true, pprintOptions: state.config().prettyPrintingOptions }))
        .catch(printWarningForError);
}

function evaluateTopLevelForm(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { topLevel: true, pprintOptions: state.config().prettyPrintingOptions }))
        .catch(printWarningForError);
}

function evaluateCurrentForm(document = {}, options = {}) {
    evaluateSelection(document, Object.assign({}, options, { pprintOptions: state.config().prettyPrintingOptions }))
        .catch(printWarningForError);
}

async function loadFile(document, pprintOptions: PrettyPrintingOptions) {
    const current = state.deref();
    const doc = util.getDocument(document);
    const fileType = util.getFileType(doc);
    const ns = namespace.getNamespace(doc);
    const session = namespace.getSession(util.getFileType(doc));

    if (doc && doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        state.analytics().logEvent("Evaluation", "LoadFile").send();
        const docUri = outputWindow.isResultsDoc(doc) ?
            await outputWindow.getUriForCurrentNamespace() :
            doc.uri;
        const fileName = path.basename(docUri.path);
        const fileContents = await util.getFileContents(docUri.path);

        outputWindow.append("; Evaluating file: " + fileName);

        await session.eval("(in-ns '" + ns + ")", session.client.ns).value;

        const res = session.loadFile(fileContents, {
            fileName,
            filePath: docUri.path,
            stdout: m => outputWindow.append(normalizeNewLines(m)),
            stderr: m => outputWindow.append('; ' + normalizeNewLines(m, true)),
            pprintOptions: pprintOptions
        });
        try {
            const value = await res.value;
            if (value) {
                outputWindow.append(value);
            } else {
                outputWindow.append("; No results from file evaluation.");
            }
        } catch (e) {
            outputWindow.append(`; Evaluation of file ${fileName} failed: ${e}`);
            if (res.stacktrace) {
                outputWindow.saveStacktrace(res.stacktrace);
                outputWindow.printLastStacktrace();
            }
        }
        outputWindow.setSession(session, res.ns || ns);
        namespace.updateREPLSessionType();
    }
}

async function evaluateUser(code: string) {
    const fileType = util.getFileType(util.getDocument({})),
        session = namespace.getSession(fileType);
    if (session) {
        try {
            await session.eval(code, session.client.ns).value;
        } catch (e) {
            const chan = state.outputChannel();
            chan.appendLine(`Eval failure: ${e}`);
        }
    } else {
        vscode.window.showInformationMessage("Not connected to a REPL server");
    }
}

async function requireREPLUtilitiesCommand() {

    if (util.getConnectedState()) {
        const chan = state.outputChannel(),
            ns = namespace.getDocumentNamespace(util.getDocument({})),
            CLJS_FORM = "(use '[cljs.repl :only [apropos dir doc find-doc print-doc pst source]])",
            CLJ_FORM = "(clojure.core/apply clojure.core/require clojure.main/repl-requires)",
            sessionType = namespace.getREPLSessionType(),
            form = sessionType == "cljs" ? CLJS_FORM : CLJ_FORM,
            fileType = util.getFileType(util.getDocument({})),
            session = namespace.getSession(fileType);

        if (session) {
            try {
                await namespace.createNamespaceFromDocumentIfNotExists(util.getDocument({}));
                await session.eval("(in-ns '" + ns + ")", session.client.ns).value;
                await session.eval(form, ns).value;
                chan.appendLine(`REPL utilities are now available in namespace ${ns}.`);
            } catch (e) {
                chan.appendLine(`REPL utilities could not be acquired for namespace ${ns}: ${e}`);
            }
        }
    } else {
        vscode.window.showInformationMessage("Not connected to a REPL server");
    }
}

async function copyLastResultCommand() {
    let chan = state.outputChannel();
    let session = namespace.getSession(util.getFileType(util.getDocument({})));

    let value = await session.eval("*1", session.client.ns).value;
    if (value !== null) {
        vscode.env.clipboard.writeText(value);
        vscode.window.showInformationMessage("Results copied to the clipboard.");
    }
    else
        chan.appendLine("Nothing to copy");
}

async function togglePrettyPrint() {
    const config = vscode.workspace.getConfiguration('calva'),
        pprintConfigKey = 'prettyPrintingOptions',
        pprintOptions = config.get(pprintConfigKey) as PrettyPrintingOptions;
    pprintOptions.enabled = !pprintOptions.enabled;
    await config.update(pprintConfigKey, pprintOptions, vscode.ConfigurationTarget.Global);
    statusbar.update();
};

async function instrumentTopLevelForm() {
    evaluateSelection({}, { topLevel: true, pprintOptions: state.config().prettyPrintingOptions, debug: true })
        .catch(printWarningForError);
    state.analytics().logEvent(DEBUG_ANALYTICS.CATEGORY, DEBUG_ANALYTICS.EVENT_ACTIONS.INSTRUMENT_FORM).send();
}

export async function evaluateInOutputWindow(code: string, sessionType: string, ns: string) {
    const outputDocument = await outputWindow.openResultsDoc();
    const evalPos = outputDocument.positionAt(outputDocument.getText().length);
    try {
        const session = namespace.getSession(sessionType);
        outputWindow.setSession(session, ns);
        namespace.updateREPLSessionType();
        outputWindow.append(code);
        await evaluateCode(code, {
            filePath: outputDocument.fileName,
            session,
            ns,
            line: evalPos.line,
            column: evalPos.character
        });
    }
    catch (e) {
        outputWindow.append("; Evaluation failed.");
    }
}

export type customREPLCommandSnippet = {
    name: string,
    key?: string,
    snippet: string,
    repl?: string,
    ns?: string
};

export default {
    interruptAllEvaluations,
    loadFile,
    evaluateCurrentForm,
    evaluateTopLevelForm,
    evaluateSelectionReplace,
    evaluateSelectionAsComment,
    evaluateTopLevelFormAsComment,
    evaluateCode,
    evaluateUser,
    copyLastResultCommand,
    requireREPLUtilitiesCommand,
    togglePrettyPrint,
    instrumentTopLevelForm,
    evaluateInOutputWindow
};
