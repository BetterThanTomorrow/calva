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


function loadNamespace() {
    setREPLNamespace(true);
}

function loadNamespaceCommand(focus = true) {
    loadNamespace();
}

function setREPLNamespaceCommand() {
    setREPLNamespace(false);
}

async function sendTextToREPLWindow(text, ns?: string) {
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


function evalCurrentFormInREPLWindow(topLevel = false) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";
        
    if (selection.isEmpty) {
        codeSelection = select.getFormSelection(doc, selection.active, topLevel);
        annotations.decorateSelection(codeSelection, editor, annotations.AnnotationStatus.REPL_WINDOW);
        code = doc.getText(codeSelection);
    } else {
        codeSelection = selection;
        code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLWindow(code, util.getNamespace(doc.getText()))
    }
    openReplWindow();
}

function evalCurrentFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(false);
}

function evalCurrentTopLevelFormInREPLWindowCommand() {
    evalCurrentFormInREPLWindow(true);
}

export default {
    loadNamespace,
    loadNamespaceCommand,
    setREPLNamespaceCommand,
    setREPLNamespace,
    evalCurrentFormInREPLWindow,
    evalCurrentFormInREPLWindowCommand,
    evalCurrentTopLevelFormInREPLWindowCommand
};
