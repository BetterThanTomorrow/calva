'use strict';
import { StatusBar } from './status_bar';
import * as utils from './utils';
import { commands, window, ExtensionContext, workspace, ConfigurationChangeEvent } from 'vscode';
import { activeReplWindow } from '../repl-window';
import * as state from "../state";

let paredit = require('paredit.js');

const languages = new Set(["clojure", "lisp", "scheme"]);
let enabled = true,
    expandState = { range: null, prev: null };

const navigate = (fn, ...args) =>
    ({ textEditor, ast, selection }) => {
        let res = fn(ast, selection.cursor, ...args);
        utils.select(textEditor, res);
    }

const yank = (fn, ...args) =>
    ({ textEditor, ast, selection }) => {
        let res = fn(ast, selection.cursor, ...args),
            positions = typeof (res) === "number" ? [selection.cursor, res] : res;
        utils.copy(textEditor, positions);
    }

const cut = (fn, ...args) =>
    ({ textEditor, ast, selection }) => {
        let res = fn(ast, selection.cursor, ...args),
            positions = typeof (res) === "number" ? [selection.cursor, res] : res;
        utils.cut(textEditor, positions);
    }

const navigateExpandSelecion = (fn, ...args) =>
    ({ textEditor, ast, selection }) => {
        let range = textEditor.selection,
            res = fn(ast, selection.start, selection.end, ...args);
        if (expandState.prev == null || !range.contains(expandState.prev.range)) {
            expandState = { range: range, prev: null };
        }
        expandState = { range: utils.select(textEditor, res), prev: expandState };
    }

function navigateContractSelecion({ textEditor, selection }) {
    let range = textEditor.selection;
    if (expandState.prev && expandState.prev.range && range.contains(expandState.prev.range)) {
        textEditor.selection = expandState.prev.range;
        expandState = expandState.prev;
    }
}

function indent({ textEditor, selection }) {
    let src = textEditor.document.getText(),
        ast = paredit.parse(src),
        res = paredit.editor.indentRange(ast, src, selection.start, selection.end);

    utils
        .edit(textEditor, utils.commands(res))
        .then((applied?) => utils.undoStop(textEditor));
}

const wrapAround = (ast, src, start, { opening, closing }) => paredit.editor.wrapAround(ast, src, start, opening, closing);

const edit = (fn, opts = {}) =>
    ({ textEditor, src, ast, selection }) => {
        let { start, end } = selection;
        let res = fn(ast, src, selection.start, { ...opts, endIdx: start === end ? undefined : end });

        if (res)
            if (res.changes.length > 0) {
                let cmd = utils.commands(res),
                    sel = {
                        start: Math.min(...cmd.map(c => c.start)),
                        end: Math.max(...cmd.map(utils.end))
                    };

                utils
                    .edit(textEditor, cmd)
                    .then((applied?) => {
                        utils.select(textEditor, res.newIndex);
                        if (!opts["_skipIndent"]) {
                            indent({
                                textEditor: textEditor,
                                selection: sel
                            });
                        }
                    });
            }
            else
                utils.select(textEditor, res.newIndex);
    }

const createNavigationCopyCutCommands = (commands) => {
    const capitalizeFirstLetter = (s) => { return s.charAt(0).toUpperCase() + s.slice(1); }

    let result: [string, Function][] = new Array<[string, Function]>();
    Object.keys(commands).forEach((c) => {
        result.push([`paredit.${c}`, navigate(commands[c])]);
        result.push([`paredit.yank${capitalizeFirstLetter(c)}`, yank(commands[c])]);
        result.push([`paredit.cut${capitalizeFirstLetter(c)}`, cut(commands[c])]);
    });
    return result;
}

const navCopyCutcommands = {
    'rangeForDefun': paredit.navigator.rangeForDefun,
    'forwardSexp': paredit.navigator.forwardSexp,
    'backwardSexp': paredit.navigator.backwardSexp,
    'forwardDownSexp': paredit.navigator.forwardDownSexp,
    'backwardUpSexp': paredit.navigator.backwardUpSexp,
    'closeList': paredit.navigator.closeList
};

const pareditCommands: [string, Function][] = [

    // SELECTING
    ['paredit.sexpRangeExpansion', navigateExpandSelecion(paredit.navigator.sexpRangeExpansion)],
    ['paredit.sexpRangeContraction', navigateContractSelecion],

    // NAVIGATION, COPY, CUT
    // (Happens in createNavigationCopyCutCommands())

    // EDITING
    ['paredit.slurpSexpForward', edit(paredit.editor.slurpSexp, { 'backward': false })],
    ['paredit.slurpSexpBackward', edit(paredit.editor.slurpSexp, { 'backward': true })],
    ['paredit.barfSexpForward', edit(paredit.editor.barfSexp, { 'backward': false })],
    ['paredit.barfSexpBackward', edit(paredit.editor.barfSexp, { 'backward': true })],
    ['paredit.spliceSexp', edit(paredit.editor.spliceSexp)],
    ['paredit.splitSexp', edit(paredit.editor.splitSexp)],
    ['paredit.killSexpForward', edit(paredit.editor.killSexp, { 'backward': false })],
    ['paredit.killSexpBackward', edit(paredit.editor.killSexp, { 'backward': true })],
    ['paredit.spliceSexpKillForward', edit(paredit.editor.spliceSexpKill, { 'backward': false })],
    ['paredit.spliceSexpKillBackward', edit(paredit.editor.spliceSexpKill, { 'backward': true })],
    ['paredit.deleteForward', edit(paredit.editor.delete, { 'backward': false, '_skipIndent': true })],
    ['paredit.deleteBackward', edit(paredit.editor.delete, { 'backward': true, '_skipIndent': true })],
    ['paredit.wrapAroundParens', edit(wrapAround, { opening: '(', closing: ')' })],
    ['paredit.wrapAroundSquare', edit(wrapAround, { opening: '[', closing: ']' })],
    ['paredit.wrapAroundCurly', edit(wrapAround, { opening: '{', closing: '}' })],
    ['paredit.indentRange', indent],
    ['paredit.transpose', edit(paredit.editor.transpose)]];

function wrapPareditCommand(command: string, fn) {
    return () => {
        try {
            let repl = activeReplWindow();

            if (repl) {
                repl.executeCommand(toConsoleCommand[command])
            } else {
                let textEditor = window.activeTextEditor;
                let doc = textEditor.document;
                if (!enabled || !languages.has(doc.languageId)) return;

                let src = textEditor.document.getText();
                fn({
                    textEditor: textEditor,
                    src: src,
                    ast: paredit.parse(src),
                    selection: utils.getSelection(textEditor)
                });
            }
        } catch (e) {

        }
    }
}

function setKeyMapConf() {
    let keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
    commands.executeCommand('setContext', 'paredit:keyMap', keyMap);
}
setKeyMapConf();

/*
    ['paredit.killSexpForward', edit(paredit.editor.killSexp, { 'backward': false })],
    ['paredit.killSexpBackward', edit(paredit.editor.killSexp, { 'backward': true })],
    ['paredit.spliceSexpKillForward', edit(paredit.editor.spliceSexpKill, { 'backward': false })],
    ['paredit.spliceSexpKillBackward', edit(paredit.editor.spliceSexpKill, { 'backward': true })],
    ['paredit.deleteForward', edit(paredit.editor.delete, { 'backward': false, '_skipIndent': true })],
    ['paredit.deleteBackward', edit(paredit.editor.delete, { 'backward': true, '_skipIndent': true })],
    ['paredit.indentRange', indent],
    ['paredit.transpose', edit(paredit.editor.transpose)]];
*/

/*
    'rangeForDefun': paredit.navigator.rangeForDefun,
*/
const toConsoleCommand = {
    'paredit.sexpRangeExpansion': "grow-selection",
    'paredit.sexpRangeContraction': "shrink-selection",
    'paredit.slurpSexpForward': "forward-slurp-sexp",
    'paredit.slurpSexpBackward': "backward-slurp-sexp",
    'paredit.barfSexpForward': "forward-barf-sexp",
    'paredit.barfSexpBackward': "backward-barf-sexp",
    'paredit.spliceSexp': "splice-sexp",
    'paredit.splitSexp': "split-sexp",
    'paredit.spliceSexpKillForward': "splice-sexp-killing-forward",
    'paredit.spliceSexpKillBackward': "splice-sexp-killing-backward",
    'paredit.wrapAroundParens': "wrap-round",
    'paredit.wrapAroundSquare': "wrap-square",
    'paredit.wrapAroundCurly': "wrap-curly",
    'paredit.forwardSexp': "forward-sexp",
    'paredit.backwarddSexp': "backward-sexp",
    'paredit.forwardDownSexp': "down-list",
    'paredit.backwardUpSexp': "backward-up-list",
    'paredit.deleteBackward': "backspace",
    'paredit.deleteForward': "delete",
}

/*
"raise-sexp": () => void;
"convolute-sexp": () => void;
"force-backspace": () => void;
"force-delete": () => void;
"grow-selection": () => void;
"shrink-selection": () => void;
"up-list": () => void;
"select-all": () => void;
"undo": () => void;
"redo": () => void;
"join-sexp": () => void;
"cursor-left": () => void;
"cursor-select-left": () => void;
"cursor-right": () => void;
"cursor-select-right": () => void;
"splice-sexp-killing-backwards": () => void;
"cursor-up": () => void;
"cursor-select-up": () => void;
"splice-sexp-killing-forwards": () => void;
"cursor-down": () => void;
"cursor-select-down": () => void;
"backspace": () => void;
"cursor-home": () => void;
"cursor-select-home": () => void;
"cursor-home-all": () => void;
"cursor-select-home-all": () => void;
"cursor-end": () => void;
"cursor-select-end": () => void;
"cursor-end-all": () => void;
"cursor-select-end-all": () => void;
"delete": () => void;
"history-up": () => void;
"history-down": () => void;
*/
export function activate(context: ExtensionContext) {

    let statusBar = new StatusBar();

    context.subscriptions.push(

        statusBar,
        commands.registerCommand('paredit.toggle', () => { enabled = !enabled; statusBar.enabled = enabled; }),
        window.onDidChangeActiveTextEditor((e) => statusBar.visible = e && e.document && languages.has(e.document.languageId)),
        workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
            console.log(e);
            if (e.affectsConfiguration('calva.paredit.defaultKeyMap')) {
                setKeyMapConf();
            }
        }),

        ...createNavigationCopyCutCommands(navCopyCutcommands)
            .map(([command, fn]) => commands.registerCommand(command, wrapPareditCommand(command, fn))),
        ...pareditCommands
            .map(([command, fn]) => commands.registerCommand(command, wrapPareditCommand(command, fn))));
    updatePareditEnabled()
}

export function deactivate() {
}

export function updatePareditEnabled() {
    let enabled = activeReplWindow() || (window.activeTextEditor && window.activeTextEditor.document.languageId == "clojure");
    commands.executeCommand("setContext", "calva:pareditValid", enabled);
}