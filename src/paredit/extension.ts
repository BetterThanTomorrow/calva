'use strict';
import { StatusBar } from './statusbar';
import * as vscode from 'vscode';
import { commands, window, ExtensionContext, workspace, ConfigurationChangeEvent } from 'vscode';
import { activeReplWindow } from '../repl-window';
import { Event, EventEmitter } from 'vscode';
import * as paredit from '../cursor-doc/paredit';
import * as docMirror from '../doc-mirror';
import { EditableDocument } from '../cursor-doc/model';

let onPareditKeyMapChangedEmitter = new EventEmitter<String>();

const languages = new Set(["clojure", "lisp", "scheme"]);
let enabled = true;

const pareditCommands: [string, Function][] = [
    // NAVIGATING
    ['paredit.forwardSexp', (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardSexp(doc)) }],
    ['paredit.backwardSexp', (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardSexp(doc)) }],
    ['paredit.forwardDownSexp', (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardDownList(doc)) }],
    ['paredit.backwardDownSexp', (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardDownList(doc)) }],
    ['paredit.forwardUpSexp', (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardUpList(doc)) }],
    ['paredit.backwardUpSexp', (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardUpList(doc)) }],
    ['paredit.closeList', (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardList(doc)) }],
    ['paredit.openList', (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardList(doc)) }],

    // SELECTING
    ['paredit.rangeForDefun', (doc: EditableDocument) => { paredit.selectRange(doc, paredit.rangeForDefun(doc)) }],
    ['paredit.sexpRangeExpansion', paredit.growSelection], // TODO: Inside string should first select contents
    ['paredit.sexpRangeContraction', paredit.shrinkSelection],

    ['paredit.selectForwardSexp', (doc: EditableDocument) => {
        paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardSexp(doc, doc.selectionEnd))
    }],
    ['paredit.selectBackwardSexp', (doc: EditableDocument) => {
        paredit.selectRange(doc, paredit.rangeToBackwardSexp(doc))
    }],
    ['paredit.selectForwardDownSexp', (doc: EditableDocument) => {
        paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardDownList(doc, doc.selectionEnd))
    }],
    ['paredit.selectBackwardDownSexp', (doc: EditableDocument) => {
        paredit.selectRange(doc, paredit.rangeToBackwardDownList(doc))
    }],
    ['paredit.selectForwardUpSexp', (doc: EditableDocument) => {
        paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardUpList(doc, doc.selectionEnd))
    }],
    ['paredit.selectBackwardUpSexp', (doc: EditableDocument) => {
        paredit.selectRange(doc, paredit.rangeToBackwardUpList(doc))
    }],
    ['paredit.selectCloseList', (doc: EditableDocument) => {
        paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardList(doc, doc.selectionEnd))
    }],
    ['paredit.selectOpenList', (doc: EditableDocument) => {
        paredit.selectRange(doc, paredit.rangeToBackwardList(doc))
    }],

    // EDITING
    ['paredit.slurpSexpForward', paredit.forwardSlurpSexp],
    ['paredit.barfSexpForward', paredit.forwardBarfSexp],
    ['paredit.slurpSexpBackward', paredit.backwardSlurpSexp],
    ['paredit.barfSexpBackward', paredit.backwardBarfSexp],
    ['paredit.splitSexp', paredit.splitSexp],
    ['paredit.spliceSexp', paredit.spliceSexp],
    // ['paredit.transpose', ], // TODO: Not yet implemented
    ['paredit.raiseSexp', paredit.raiseSexp],
    ['paredit.convolute', paredit.convolute],
    ['paredit.killSexpForward', (doc: EditableDocument) => { paredit.killRange(doc, paredit.rangeToForwardSexp(doc)) }],
    ['paredit.killSexpBackward', (doc: EditableDocument) => { paredit.killRange(doc, paredit.rangeToBackwardSexp(doc)) }],
    ['paredit.killListForward', paredit.killForwardList], // TODO: Implement with killRange
    ['paredit.killListBackward', paredit.killBackwardList], // TODO: Implement with killRange
    ['paredit.spliceSexpKillForward', paredit.spliceSexpKillingForward],
    ['paredit.spliceSexpKillBackward', paredit.spliceSexpKillingBackward],
    ['paredit.wrapAroundParens', (doc: EditableDocument) => { paredit.wrapSexpr(doc, '(', ')') }],
    ['paredit.wrapAroundSquare', (doc: EditableDocument) => { paredit.wrapSexpr(doc, '[', ']') }],
    ['paredit.wrapAroundCurly', (doc: EditableDocument) => { paredit.wrapSexpr(doc, '{', '}') }],
    ['paredit.deleteForward', paredit.deleteForward], // TODO: Strict mode not working
    ['paredit.deleteBackward', paredit.backspace],

];

function wrapPareditCommand(command: string, fn: Function) {
    return () => {
        try {
            let repl = activeReplWindow();

            if (repl) {
                repl.executeCommand(toConsoleCommand[command])
            } else {
                const textEditor = window.activeTextEditor,
                    mDoc: EditableDocument = docMirror.getDocument(textEditor.document);
                if (!enabled || !languages.has(textEditor.document.languageId)) return;
                fn(mDoc);
            }
        } catch (e) {
            console.error(e.message)
        }
    }
}

export function getKeyMapConf(): String {
    let keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
    return (String(keyMap));
}

function setKeyMapConf() {
    let keyMap = workspace.getConfiguration().get('calva.paredit.defaultKeyMap');
    commands.executeCommand('setContext', 'paredit:keyMap', keyMap);
    onPareditKeyMapChangedEmitter.fire(String(keyMap));
}
setKeyMapConf();

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
    'paredit.backwardSexp': "backward-sexp",
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
            if (keyMap == 'original') {
                workspace.getConfiguration().update('calva.paredit.defaultKeyMap', 'strict', vscode.ConfigurationTarget.Global);
            } else if (keyMap == 'strict') {
                workspace.getConfiguration().update('calva.paredit.defaultKeyMap', 'original', vscode.ConfigurationTarget.Global);
            }
        }),
        window.onDidChangeActiveTextEditor((e) => e && e.document && languages.has(e.document.languageId)),
        workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('calva.paredit.defaultKeyMap')) {
                setKeyMapConf();
            }
        }),
        ...pareditCommands
            .map(([command, fn]) => commands.registerCommand(command, wrapPareditCommand(command, fn))));
    commands.executeCommand("setContext", "calva:pareditValid", true);
}

export function deactivate() {
}

export const onPareditKeyMapChanged: Event<String> = onPareditKeyMapChangedEmitter.event;
