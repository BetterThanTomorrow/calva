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
import * as resultsOutput from './result-output';
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

async function evaluateCode(code: string, options) {
    const pprintOptions = options.pprintOptions || state.config().prettyPrintingOptions;
    const line = options.line;
    const column = options.column;
    const filePath = options.filePath;
    const session: NReplSession = options.session;
    const ns = options.ns;

    if (code.length > 0) {
        let err: string[] = [], out: string[] = [];

        await session.eval("(in-ns '" + ns + ")", session.client.ns).value;

        let context: NReplEvaluation = session.eval(code, ns, {
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
        try {
            let value = await context.value;
            value = util.stripAnsi(context.pprintOut || value);
            resultsOutput.appendToResultsDoc(value);
            resultsOutput.setSession(session, context.ns);
            util.updateREPLSessionType();

            if (err.length > 0) {
                await resultsOutput.appendToResultsDoc(`; ${normalizeNewLinesAndJoin(err, true)}`);
                if (context.stacktrace) {
                    await resultsOutput.printStacktrace(context.stacktrace);
                }
            }
            return value;
        } catch (e) {
            if (!err.length) { // venantius/ultra outputs errors on stdout, it seems.
                err = out;
            }
            if (err.length > 0) {
                await resultsOutput.appendToResultsDoc(`; ${normalizeNewLinesAndJoin(err, true)}`);
                if (context.stacktrace) {
                    await resultsOutput.printStacktrace(context.stacktrace);
                }
                resultsOutput.setSession(session, context.ns);
                util.updateREPLSessionType();
            }
            throw new Error(util.stripAnsi(err.join("\n")));
        }
    }
}

async function evaluateSelection(document: {}, options) {
    const current = state.deref();
    const doc = util.getDocument(document);
    const topLevel = options.topLevel || false;
    const replace = options.replace || false;
    const asComment = options.comment || false;

    if (current.get('connected')) {
        const editor = vscode.window.activeTextEditor;
        const selection = editor.selection;
        let code = "";
        let codeSelection: vscode.Selection;
        if (selection.isEmpty) {
            state.analytics().logEvent("Evaluation", topLevel ? "TopLevel" : "CurrentForm").send();
            codeSelection = select.getFormSelection(doc, selection.active, topLevel);
            code = doc.getText(codeSelection);
        } else {
            state.analytics().logEvent("Evaluation", "Selection").send();
            codeSelection = selection;
            code = doc.getText(selection);
        }
        const ns = util.getNamespace(doc);
        const line = codeSelection.start.line;
        const column = codeSelection.start.character;
        const filePath = doc.fileName;
        const session = util.getSession(util.getFileType(doc));
        if (code.length > 0) {
            if (options.debug) {
                code = '#dbg\n' + code;
            }
            annotations.decorateSelection("", codeSelection, editor, annotations.AnnotationStatus.PENDING);
            let c = codeSelection.start.character

            try {
                const value = await evaluateCode(code, { ...options, ns, line, column, filePath, session });

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
            }
            catch (e) {
                annotations.decorateSelection(e, codeSelection, editor, annotations.AnnotationStatus.ERROR);
                annotations.decorateResults(e, true, codeSelection, editor);
                if (asComment) {
                    addAsComment(c, e, codeSelection, editor, selection);
                }
            }
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

async function loadFile(document, callback: () => { }, pprintOptions: PrettyPrintingOptions) {
    let current = state.deref(),
        doc = util.getDocument(document),
        fileName = util.getFileName(doc),
        fileType = util.getFileType(doc),
        client = util.getSession(util.getFileType(doc)),
        chan = state.outputChannel(),
        shortFileName = path.basename(fileName),
        dirName = path.dirname(fileName);

    if (doc && !resultsOutput.isResultsDoc(doc) && doc.languageId == "clojure" && fileType != "edn" && current.get('connected')) {
        state.analytics().logEvent("Evaluation", "LoadFile").send();
        resultsOutput.appendToResultsDoc("; Evaluating file: " + fileName);

        let res = client.loadFile(doc.getText(), {
            fileName: fileName,
            filePath: doc.fileName,
            stdout: m => resultsOutput.appendToResultsDoc(normalizeNewLines(m.indexOf(dirName) < 0 ? m.replace(shortFileName, fileName) : m)),
            stderr: m => resultsOutput.appendToResultsDoc('; ' + normalizeNewLines(m.indexOf(dirName) < 0 ? m.replace(shortFileName, fileName) : m, true)),
            pprintOptions: pprintOptions
        })
        await res.value.then((value) => {
            if (value) {
                resultsOutput.appendToResultsDoc(value);
            } else {
                resultsOutput.appendToResultsDoc("; No results from file evaluation.");
            }
        }).catch(async (e) => {
            await resultsOutput.openResultsDoc();
            await resultsOutput.appendToResultsDoc(`; Evaluation of file ${fileName} failed: ${e}`);
            if (res.stacktrace) {
                await resultsOutput.printStacktrace(res.stacktrace);
            }
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

async function evaluateUser(code: string) {
    const fileType = util.getFileType(util.getDocument({})),
        session = util.getSession(fileType);
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

async function evaluateInOutputWindow(code: string, sessionType: string, ns: string) {
    const outputDocument = await resultsOutput.openResultsDoc();
    const evalPos = outputDocument.positionAt(outputDocument.getText().length);
    try {
        const session = util.getSession(sessionType);
        await resultsOutput.setSession(session, ns);
        util.updateREPLSessionType();
        await resultsOutput.appendToResultsDoc(code);
        await evaluateCode(code, {
            filePath: outputDocument.fileName,
            session,
            ns,
            line: evalPos.line,
            column: evalPos.character
        });
    }
    catch (e) {
        resultsOutput.appendToResultsDoc("; Evaluation failed.")
    }
}

export type customREPLCommandSnippet = { name: string, snippet: string, repl: string, ns?: string };

function evaluateCustomCommandSnippetCommand() {
    let pickCounter = 1,
        configErrors: { "name": string, "keys": string[] }[] = [];
    const snippets = state.config().customREPLCommandSnippets as customREPLCommandSnippet[],
        snippetPicks = _.map(snippets, (c: customREPLCommandSnippet) => {
            const undefs = ["name", "snippet", "repl"].filter(k => {
                return !c[k];
            })
            if (undefs.length > 0) {
                configErrors.push({ "name": c.name, "keys": undefs });
            }
            return `${pickCounter++}: ${c.name} (${c.repl})`;
        }),
        snippetsDict = {};
    pickCounter = 1;

    if (configErrors.length > 0) {
        vscode.window.showErrorMessage("Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: " + JSON.stringify(configErrors), "OK");
        return;
    }
    snippets.forEach((c: customREPLCommandSnippet) => {
        snippetsDict[`${pickCounter++}: ${c.name} (${c.repl})`] = c;
    });

    if (snippets && snippets.length > 0) {
        util.quickPickSingle({
            values: snippetPicks,
            placeHolder: "Choose a command to run at the REPL",
            saveAs: "runCustomREPLCommand"
        }).then(async (pick) => {
            if (pick && snippetsDict[pick] && snippetsDict[pick].snippet) {
                const command = snippetsDict[pick].snippet,
                    editor = vscode.window.activeTextEditor,
                    editorNS = editor && editor.document && editor.document.languageId === 'clojure' ? util.getNamespace(editor.document) : undefined,
                    ns = snippetsDict[pick].ns ? snippetsDict[pick].ns : editorNS,
                    repl = snippetsDict[pick].repl ? snippetsDict[pick].repl : "clj";
                evaluateInOutputWindow(command, repl ? repl : "clj", ns);
            }
        }).catch(() => { });
    } else {
        vscode.window.showInformationMessage("No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.", ...["OK"]);
    }
}


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
    evaluateInOutputWindow,
    evaluateCustomCommandSnippetCommand
};
