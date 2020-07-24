import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import annotations from './providers/annotations';
import * as path from 'path';
import select from './select';
import * as util from './utilities';
import { activeReplWindow } from './repl-window';
import { NReplSession, NReplEvaluation } from './nrepl';
import statusbar from './statusbar';
import { PrettyPrintingOptions } from './printer';
import * as resultsOutput from './result-output'
import { DEBUG_ANALYTICS } from './debugger/calva-debug';

function interruptAllEvaluations() {

    if (util.getConnectedState()) {
        let chan = state.outputChannel();
        let msgs: string[] = [];


        let nums = NReplEvaluation.interruptAll((msg) => {
            msgs.push(msg);
        })
        resultsOutput.appendToResultsDoc(normalizeNewLinesAndJoin(msgs));

        NReplSession.getInstances().forEach((session, index) => {
            session.interruptAll();
        });

        if (nums < 1) {
            vscode.window.showInformationMessage(`There are no running evaluations to interupt.`);
        } else {
            vscode.window.showInformationMessage(`Interupted ${nums} running evaluation(s).`);
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

async function evaluateSelection(document, options) {
    let current = state.deref(),
        chan = state.outputChannel(),
        doc = util.getDocument(document),
        pprintOptions = options.pprintOptions,
        replace = options.replace || false,
        topLevel = options.topLevel || false,
        asComment = options.comment || false;
    if (current.get('connected')) {
        let client = util.getSession(util.getFileType(doc));
        let editor = vscode.window.activeTextEditor,
            selection = editor.selection,
            codeSelection: vscode.Selection = null,
            code = "";

        if (selection.isEmpty) {
            state.analytics().logEvent("Evaluation", topLevel ? "TopLevel" : "CurrentForm").send();
            codeSelection = select.getFormSelection(doc, selection.active, topLevel);
            code = doc.getText(codeSelection);
        } else {
            state.analytics().logEvent("Evaluation", "Selection").send();
            codeSelection = selection;
            code = doc.getText(selection);
        }

        if (code.length > 0) {
            if (options.debug) {
                code = '#dbg\n' + code;
            }
            annotations.decorateSelection("", codeSelection, editor, annotations.AnnotationStatus.PENDING);
            let c = codeSelection.start.character

            let err: string[] = [], out: string[] = [];

            const ns = util.getNamespace(doc);
            await client.eval("(in-ns '" + ns + ")", client.client.ns).value;

            let context: NReplEvaluation;
            try {
                const line = codeSelection.start.line,
                    column = codeSelection.start.character,
                    filePath = doc.fileName;
                context = client.eval(code, ns, {
                    file: filePath,
                    line: line + 1,
                    column: column + 1,
                    stdout: (m) => {
                        out.push(m);
                        resultsOutput.appendToResultsDoc(normalizeNewLines(m));
                    },
                    stderr: m => err.push(m),
                    pprintOptions: pprintOptions
                });
                let value = await context.value;
                value = util.stripAnsi(context.pprintOut || value);

                if (replace) {
                    const indent = `${' '.repeat(c)}`,
                        edit = vscode.TextEdit.replace(codeSelection, value.replace(/\n/gm, "\n" + indent)),
                        wsEdit = new vscode.WorkspaceEdit();
                    wsEdit.set(editor.document.uri, [edit]);
                    vscode.workspace.applyEdit(wsEdit);
                } else if (asComment) {
                    addAsComment(c, value, codeSelection, editor, selection);
                } else {
                    annotations.decorateSelection(value, codeSelection, editor, annotations.AnnotationStatus.SUCCESS);
                    annotations.decorateResults(value, false, codeSelection, editor);
                }

                if (!asComment) {
                    resultsOutput.appendToResultsDoc(value);
                }

                if (err.length > 0) {
                    console.log(context.stacktrace);
                    resultsOutput.appendToResultsDoc(`;${normalizeNewLinesAndJoin(err, true)}`);
                    if (context.stacktrace) {
                        resultsOutput.printStacktrace(context.stacktrace);
                    }
                }
                resultsOutput.setSession(client, context.ns);
                util.updateREPLSessionType();
            } catch (e) {
                if (!err.length) { // venantius/ultra outputs errors on stdout, it seems.
                    err = out;
                }
                if (err.length > 0) {
                    resultsOutput.appendToResultsDoc(`;${normalizeNewLinesAndJoin(err, true)}`);
                    if (context.stacktrace) {
                        resultsOutput.printStacktrace(context.stacktrace);
                    }
                    resultsOutput.setSession(client, context.ns);
                    util.updateREPLSessionType();
                }

                const message = util.stripAnsi(err.join("\n"));
                annotations.decorateSelection(message, codeSelection, editor, annotations.AnnotationStatus.ERROR);
                annotations.decorateResults(message, true, codeSelection, editor);
                if (asComment) {
                    addAsComment(c, message, codeSelection, editor, selection);
                }
            }
        }
    } else
        vscode.window.showErrorMessage("Not connected to a REPL");
}

function printWarningForError(e: any) {
    console.warn(`Unhandled error: ${e.message}`);
}

function normalizeNewLines(str: string, asLineComment = false): string {
    const s = str.replace(/\n\r?$/, "");
    return asLineComment ? s.replace(/\n\r?/, "\n;") : s;
}

function normalizeNewLinesAndJoin(strings: string[], asLineComment = false): string {
    return strings.map((s) => normalizeNewLines(s, asLineComment), asLineComment).join(`\n${asLineComment ? ';' : ''}`);
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

async function loadFile(document, callback: () => { }, pprintOptions: PrettyPrintingOptions) {
    let current = state.deref(),
        doc = util.getDocument(document),
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        client = util.getSession(util.getFileType(doc)),
        chan = state.outputChannel(),
        shortFileName = path.basename(fileName),
        dirName = path.dirname(fileName);

    if (doc && doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        state.analytics().logEvent("Evaluation", "LoadFile").send();
        resultsOutput.appendToResultsDoc(";Evaluating file: " + fileName);

        let res = client.loadFile(doc.getText(), {
            fileName: fileName,
            filePath: doc.fileName,
            stdout: m => chan.appendLine(m.indexOf(dirName) < 0 ? m.replace(shortFileName, fileName) : m),
            stderr: m => chan.appendLine(m.indexOf(dirName) < 0 ? m.replace(shortFileName, fileName) : m),
            pprintOptions: pprintOptions
        })
        await res.value.then((value) => {
            if (value) {
                resultsOutput.appendToResultsDoc(value);
            } else {
                resultsOutput.appendToResultsDoc(";No results from file evaluation.");
            }
        }).catch((e) => {
            resultsOutput.appendToResultsDoc(`;Evaluation of file ${fileName} failed: ${e}`);
        });
        resultsOutput.setSession(client, res.ns);
        util.updateREPLSessionType();
    }
    if (callback) {
        try {
            callback();
        } catch (e) {
            chan.appendLine(`After evaluation callback for file ${fileName} failed: ${e}`);
        };
    }
}

async function requireREPLUtilitiesCommand() {

    if (util.getConnectedState()) {
        const chan = state.outputChannel(),
            ns = util.getDocumentNamespace(util.getDocument({})),
            CLJS_FORM = "(use '[cljs.repl :only [apropos dir doc find-doc print-doc pst source]])",
            CLJ_FORM = "(clojure.core/apply clojure.core/require clojure.main/repl-requires)",
            sessionType = util.getREPLSessionType(),
            form = sessionType == "cljs" ? CLJS_FORM : CLJ_FORM,
            fileType = util.getFileType(util.getDocument({})),
            session = util.getSession(fileType);

        if (session) {
            try {
                await util.createNamespaceFromDocumentIfNotExists(util.getDocument({}));
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
    const replWindow = activeReplWindow();
    let client = replWindow ? replWindow.session : util.getSession(util.getFileType(util.getDocument({})));

    let value = await client.eval("*1", client.client.ns).value;
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
    evaluateSelection({}, {topLevel: true, pprintOptions: state.config().prettyPrintingOptions, debug: true})
        .catch(printWarningForError);
    state.analytics().logEvent(DEBUG_ANALYTICS.CATEGORY, DEBUG_ANALYTICS.EVENT_ACTIONS.INSTRUMENT_FORM).send();
}

export default {
    interruptAllEvaluations,
    loadFile,
    evaluateCurrentForm,
    evaluateTopLevelForm,
    evaluateSelectionReplace,
    evaluateSelectionAsComment,
    evaluateTopLevelFormAsComment,
    copyLastResultCommand,
    requireREPLUtilitiesCommand,
    togglePrettyPrint,
    instrumentTopLevelForm
};
