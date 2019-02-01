import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import evaluate from './repl/middleware/evaluate';
import annotations from './providers/annotations';
import select from './repl/middleware/select';
import * as shadow from './shadow';
import { openReplWindow } from './repl-window';

const CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL = 'npx shadow-cljs clj-repl';
const CONNECT_SHADOW_CLJS_CLJS_BUILD_REPL = 'npx shadow-cljs cljs-repl';
const CONNECT_SHADOW_CLJS_CLJS_NODE_REPL = 'npx shadow-cljs node-repl';

function terminalSlug(sessionSlug) {
    return sessionSlug + '-terminal';
}

function createREPLTerminal(sessionType, shadowBuild: string, outputChan) {
    let current = state.deref(),
        slug = terminalSlug(sessionType),
        terminalName = (sessionType === 'clj' ? 'Clojure' : 'ClojureScript') + ' REPL',
        terminal = null;

    if (current.get(slug)) {
        current.get(slug).dispose();
    }
    terminal = vscode.window.createTerminal(terminalName);

    if (terminal) {
        state.cursor.set(slug, terminal);
        let connectCommand = shadow.isShadowCljs() ?
            (sessionType === 'cljs' ?
                (shadowBuild.startsWith(":") ?
                    `${CONNECT_SHADOW_CLJS_CLJS_BUILD_REPL} ${shadowBuild}` :
                    CONNECT_SHADOW_CLJS_CLJS_NODE_REPL) :
                CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL) :
            state.config().connectREPLCommand + " " + current.get('hostname') + ':' + current.get('port');
        terminal.sendText(connectCommand);
        if (!shadowBuild && sessionType === 'cljs') {
            terminal.sendText(util.getCljsReplStartCode());
        }
        outputChan.appendLine('Terminal created for: ' + terminalName);
    }
}

function openREPLTerminal() {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        sessionType = util.getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.show(true);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function openREPLTerminalCommand() {
    openREPLTerminal();
}

function loadNamespace() {
    setREPLNamespace(true);
}

function loadNamespaceCommand(focus = true) {
    loadNamespace();
}

function setREPLNamespaceCommand() {
    setREPLNamespace(false);
}

async function sendTextToREPLTerminal(text, ns?: string) {
    let wnd = await openReplWindow(util.getREPLSessionType());
    if(wnd) {
        let oldNs = wnd.ns;
        if(ns && ns != oldNs)
        await wnd.session.eval("(in-ns '"+ns+")").value;
        try {
            wnd.evaluate(ns || oldNs, text);
            await wnd.replEval(text, oldNs);
        } finally {
            if(ns && ns != oldNs) {
                await wnd.session.eval("(in-ns '"+oldNs+")").value;
            }
        }
    }
}

async function setREPLNamespace(reload = false) {
    let nameSpace = util.getDocumentNamespace();

    if (reload) {
        evaluate.evaluateFile();
    }
    let wnd = await openReplWindow(util.getREPLSessionType());
    if(wnd) {
        await wnd.session.eval("(in-ns '"+nameSpace+")").value;
        wnd.setNamespace(nameSpace);
    }
}


function evalCurrentFormInREPLTerminal(topLevel = false) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";
        
    if (selection.isEmpty) {
        codeSelection = select.getFormSelection(doc, selection.active, topLevel);
        annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.TERMINAL);
        code = doc.getText(codeSelection);
    } else {
        codeSelection = selection;
        code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLTerminal(code, util.getNamespace(doc.getText()))
    }
    openREPLTerminal();
}

function evalCurrentFormInREPLTerminalCommand() {
    evalCurrentFormInREPLTerminal(false);
}

function evalCurrentTopLevelFormInREPLTerminalCommand() {
    evalCurrentFormInREPLTerminal(true);
}

export default {
    createREPLTerminal,
    openREPLTerminal,
    openREPLTerminalCommand,
    loadNamespace,
    loadNamespaceCommand,
    setREPLNamespaceCommand,
    setREPLNamespace,
    evalCurrentFormInREPLTerminal,
    evalCurrentFormInREPLTerminalCommand,
    evalCurrentTopLevelFormInREPLTerminalCommand
};
