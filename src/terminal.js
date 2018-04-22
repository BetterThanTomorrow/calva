const vscode = require('vscode');
const _ = require('lodash');
const state = require('./state');
const util = require('./utilities');
const evaluate = require('./repl/middleware/evaluate');
const annotations = require('./providers/annotations');
const select = require('./repl/middleware/select');

const CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL = 'npx shadow-cljs clj-repl';
const CONNECT_SHADOW_CLJS_CLJS_REPL = 'npx shadow-cljs cljs-repl';

function terminalSlug(sessionSlug) {
    return sessionSlug + '-terminal';
}

function createREPLTerminal(sessionType, shadowBuild, outputChan) {
    let current = state.deref(),
        slug = terminalSlug(sessionType),
        terminalName = (sessionType === 'clj' ? 'Clojure' : 'CojureScript') + ' REPL',
        terminal = null;

    if (current.get(slug)) {
        current.get(slug).dispose();
    }
    terminal = vscode.window.createTerminal(terminalName);

    if (terminal) {
        state.cursor.set(slug, terminal);
        let connectCommand = shadowBuild ?
            (sessionType === 'cljs' ?
                CONNECT_SHADOW_CLJS_CLJS_REPL + ' ' + shadowBuild :
                CONNECT_SHADOW_CLJS_CLJ_SERVER_REPL) :
            state.config().connectREPLCommand + " " + current.get('hostname') + ':' + current.get('port');
        terminal.sendText(connectCommand);
        if (!shadowBuild && sessionType === 'cljs') {
            terminal.sendText(util.getCljsReplStartCode());
        }
        outputChan.appendLine('Terminal created for: ' + terminalName);
    }
}

function openREPLTerminal(keepFocus = true) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        sessionType = util.getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.show(keepFocus);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function openREPLTerminalCommand() {
    openREPLTerminal(false);
}

function loadNamespace() {
    setREPLNamespace(true, false);
}

function loadNamespaceCommand() {
    let terminal = state.deref().get(terminalSlug(util.getREPLSessionType()));
    if (terminal) {
        terminal.show();
        loadNamespace();
    }
}

function sendTextToREPLTerminal(text, addNewline = false) {
    let current = state.deref(),
        chan = current.get('outputChannel'),
        sessionType = util.getREPLSessionType(),
        terminal = current.get(terminalSlug(sessionType));

    if (terminal) {
        terminal.sendText(text, addNewline);
    }
    else {
        chan.appendLine("No REPL terminal found. Try reconnecting the REPL sessions.");
    }
}

function setREPLNamespace(load = false, keepFocus = true) {
    let nameSpace = util.getDocumentNamespace();

    if (load) {
        evaluate.evaluateFile();
    }
    sendTextToREPLTerminal("(in-ns '" + nameSpace + ")", true);
    openREPLTerminal(keepFocus);
}

function setREPLNamespaceCommand() {
    let terminal = state.deref().get(terminalSlug(util.getREPLSessionType()));
    if (terminal) {
        terminal.show();
        setREPLNamespace(false, false);
    }
}

function evalCurrentFormInREPLTerminal(keepFocus = true) {
    let editor = vscode.window.activeTextEditor,
        doc = util.getDocument({}),
        selection = editor.selection,
        codeSelection = null,
        code = "";

    annotations.clearEvaluationDecorations(editor);
    if (selection.isEmpty) {
        codeSelection = select.getFormSelection(doc, selection.active);
        annotations.decorateSelection(codeSelection, editor);
        code = doc.getText(codeSelection);
    } else {
        codeSelection = selection;
        code = doc.getText(selection);
    }
    if (code !== "") {
        sendTextToREPLTerminal(code, true)
    }
    openREPLTerminal(keepFocus);
}

function evalCurrentFormInREPLTerminalCommand() {
    evalCurrentFormInREPLTerminal(false);
}

/*
(defmacro with-ns
  "Evaluates body in another namespace. ns is either a namespace
   object or a symbol. This makes it possible to define functions in
   namespaces other than the current one."
  [ns & body]
  `(binding [*ns* (the-ns ~ns)]
     ~@(map (fn [form] `(eval '~form)) body)))
*/

function sendCustomCommandSnippetToREPLTerminalCommand() {
    let chan = state.deref().get('outputChannel'),
        commands = state.config().customCommandSnippets,
        commandPicks = _.map(commands, c => {
            return c.name + ": " + c.command;
        }),
        commandsDict = {};

    commands.forEach(c => {
        commandsDict[c.name + ": " + c.command] = c;
    });

    if (commands && commands.length > 0) {
        vscode.window.showQuickPick(commandPicks, {
            placeHolder: "Select command snippet",
            ignoreFocusOut: true
        }).then(pick => {
            if (pick && commandsDict[pick] && commandsDict[pick].command) {
                let command = commandsDict[pick].command,
                    ns = commandsDict[pick].ns;
                if (ns) {
                    command = "(with-bindings {#'*ns* '" + ns + "} '" + command + ")";
                }
                openREPLTerminal();
                sendTextToREPLTerminal(command, true)
            }
        });
    } else {
        chan.appendLine("No command snippets configured. Configure commands in calva.customCommandSnippets.");
    }
}

module.exports = {
    createREPLTerminal,
    openREPLTerminal,
    openREPLTerminalCommand,
    loadNamespace,
    loadNamespaceCommand,
    setREPLNamespace,
    setREPLNamespaceCommand,
    evalCurrentFormInREPLTerminal,
    evalCurrentFormInREPLTerminalCommand,
    sendCustomCommandSnippetToREPLTerminalCommand
}