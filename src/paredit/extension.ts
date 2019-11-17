'use strict';
import * as utils from './utils';
import { StatusBar } from './statusbar';
import * as vscode from 'vscode';
import { commands, window, ExtensionContext, workspace, ConfigurationChangeEvent } from 'vscode';
import { activeReplWindow } from '../repl-window';
import { Event, EventEmitter } from 'vscode';
import * as newParedit from '../webview/paredit';
import * as docMirror from '../calva-fmt/src/docmirror';
import { ReplReadline } from '../webview/readline';
import { LineInputModel } from '../webview/model';
import { ModelDocument } from '../webview/model-document';

let paredit = require('paredit.js');


let onPareditKeyMapChangedEmitter = new EventEmitter<String>();

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
        .then((applied?) => utils.undoStop(textEditor)).catch(() => {});
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
                        if(!opts["_skipSelect"]) {
                            utils.select(textEditor, res.newIndex);
                        }
                        if (!opts["_skipIndent"]) {
                            indent({
                                textEditor: textEditor,
                                selection: sel
                            });
                        }
                    }).catch(() => {});
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
    'forwardUpSexp': paredit.navigator.forwardUpSexp,
    'closeList': paredit.navigator.closeList
};

const pareditCommands: [string, Function][] = [

    // SELECTING
    //['paredit.sexpRangeExpansion', navigateExpandSelecion(paredit.navigator.sexpRangeExpansion)],
    ['paredit.sexpRangeContraction', navigateContractSelecion],

    // NAVIGATION, COPY, CUT
    // (Happens in createNavigationCopyCutCommands())

    // EDITING
    //['paredit.slurpSexpForward', edit(paredit.editor.slurpSexp, { 'backward': false })],
    ['paredit.slurpSexpBackward', edit(paredit.editor.slurpSexp, { 'backward': true })],
    //['paredit.barfSexpForward', edit(paredit.editor.barfSexp, { 'backward': false })],
    ['paredit.barfSexpBackward', edit(paredit.editor.barfSexp, { 'backward': true })],
    ['paredit.spliceSexp', edit(paredit.editor.spliceSexp)],
    ['paredit.splitSexp', edit(paredit.editor.splitSexp)],
    ['paredit.killSexpForward', edit(paredit.editor.killSexp, { 'backward': false })],
    ['paredit.killSexpBackward', edit(paredit.editor.killSexp, { 'backward': true })],
    ['paredit.spliceSexpKillForward', edit(paredit.editor.spliceSexpKill, { 'backward': false })],
    ['paredit.spliceSexpKillBackward', edit(paredit.editor.spliceSexpKill, { 'backward': true })],
    ['paredit.deleteForward', edit(paredit.editor.delete, { 'backward': false, '_skipIndent': true })],
    ['paredit.deleteBackward', edit(paredit.editor.delete, { 'backward': true, '_skipIndent': true, '_skipSelect': true })],
    ['paredit.wrapAroundParens', edit(wrapAround, { opening: '(', closing: ')' })],
    ['paredit.wrapAroundSquare', edit(wrapAround, { opening: '[', closing: ']' })],
    ['paredit.wrapAroundCurly', edit(wrapAround, { opening: '{', closing: '}' })],
    ['paredit.indentRange', indent],
    ['paredit.transpose', edit(paredit.editor.transpose)]
];

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

const newPareditCommands: [string, Function][] = [
    ['paredit.sexpRangeExpansion', newParedit.growSelection],
    ['paredit.slurpSexpForward', newParedit.forwardSlurpSexp],
    ['paredit.barfSexpForward', newParedit.forwardBarfSexp],
];


function wrapNewPareditCommand(command: string, fn) {
    return () => {
        try {
            let repl = activeReplWindow();

            if (repl) {
                repl.executeCommand(toConsoleCommand[command])
            } else {
                const textEditor = window.activeTextEditor,
                    mDoc = docMirror.getDocument(textEditor.document);
                if (!enabled || !languages.has(textEditor.document.languageId)) return;
                fn(mDoc);
            }
        } catch (e) {
            console.error(e.message)
         }
    }
}


export function getKeyMapConf() :String {
    let keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
    return(String(keyMap));
}

function setKeyMapConf() {
    let keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
    commands.executeCommand('setContext', 'paredit:keyMap', keyMap);
    onPareditKeyMapChangedEmitter.fire(String(keyMap));
}
setKeyMapConf();

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
    'paredit.forwardUpSexp': "forward-up-list",
    'paredit.deleteBackward': "backspace",
    'paredit.deleteForward': "delete",
}

export function activate(context: ExtensionContext) {

    let statusBar = new StatusBar(getKeyMapConf());

    context.subscriptions.push(
        statusBar,
        commands.registerCommand('paredit.togglemode', () => { 
            let keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
            keyMap = String(keyMap).trim().toLowerCase();
            if(keyMap == 'original') {
                workspace.getConfiguration().update('calva.paredit.defaultKeyMap', 'strict', vscode.ConfigurationTarget.Global); 
            } else if(keyMap == 'strict') {
                workspace.getConfiguration().update('calva.paredit.defaultKeyMap', 'original', vscode.ConfigurationTarget.Global); 
            }
        }),
        window.onDidChangeActiveTextEditor((e) => e.document && languages.has(e.document.languageId)),
        workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('calva.paredit.defaultKeyMap')) {
                setKeyMapConf();
            }
        }),

        ...createNavigationCopyCutCommands(navCopyCutcommands)
            .map(([command, fn]) => commands.registerCommand(command, wrapPareditCommand(command, fn))),
        ...pareditCommands
            .map(([command, fn]) => commands.registerCommand(command, wrapPareditCommand(command, fn))),
        ...newPareditCommands
            .map(([command, fn]) => commands.registerCommand(command, wrapNewPareditCommand(command, fn))));
    commands.executeCommand("setContext", "calva:pareditValid", true);
}

export function deactivate() {
}

export const onPareditKeyMapChanged: Event<String> = onPareditKeyMapChangedEmitter.event;
