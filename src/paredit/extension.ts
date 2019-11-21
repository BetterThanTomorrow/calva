'use strict';
import { StatusBar } from './statusbar';
import * as vscode from 'vscode';
import { commands, window, ExtensionContext, workspace, ConfigurationChangeEvent } from 'vscode';
import { activeReplWindow } from '../repl-window';
import { Event, EventEmitter } from 'vscode';
import * as newParedit from '../cursor-doc/paredit';
import * as docMirror from '../doc-mirror';
import { EditableDocument } from '../cursor-doc/model';

let paredit = require('paredit.js');

let onPareditKeyMapChangedEmitter = new EventEmitter<String>();

const languages = new Set(["clojure", "lisp", "scheme"]);
let enabled = true;

const newPareditCommands: [string, Function][] = [
    // NAVIGATING
    ['paredit.forwardSexp', (doc: EditableDocument) => { newParedit.moveToRangeEnd(doc, newParedit.rangeToForwardSexp(doc)) }],
    ['paredit.backwardSexp', (doc: EditableDocument) => { newParedit.moveToRangeStart(doc, newParedit.rangeToBackwardSexp(doc)) }],
    ['paredit.forwardDownSexp', (doc: EditableDocument) => { newParedit.moveToRangeEnd(doc, newParedit.rangeToForwardDownList(doc)) }],
    ['paredit.backwardDownSexp', (doc: EditableDocument) => { newParedit.moveToRangeStart(doc, newParedit.rangeToBackwardDownList(doc)) }],
    ['paredit.forwardUpSexp', (doc: EditableDocument) => { newParedit.moveToRangeEnd(doc, newParedit.rangeToForwardUpList(doc)) }],
    ['paredit.backwardUpSexp', (doc: EditableDocument) => { newParedit.moveToRangeStart(doc, newParedit.rangeToBackwardUpList(doc)) }],
    ['paredit.closeList', (doc: EditableDocument) => { newParedit.moveToRangeEnd(doc, newParedit.rangeToForwardList(doc)) }],
    ['paredit.openList', (doc: EditableDocument) => { newParedit.moveToRangeStart(doc, newParedit.rangeToBackwardList(doc)) }],
    
    // SELECTING
    ['paredit.rangeForDefun', (doc: EditableDocument) => { newParedit.selectRange(doc, newParedit.rangeForDefun(doc)) }],
    ['paredit.sexpRangeExpansion', newParedit.growSelection], // TODO: Inside string should first select contents
    ['paredit.sexpRangeContraction', newParedit.shrinkSelection],

    // EDITING
    ['paredit.slurpSexpForward', newParedit.forwardSlurpSexp],
    ['paredit.barfSexpForward', newParedit.forwardBarfSexp],
    ['paredit.slurpSexpBackward', newParedit.backwardSlurpSexp],
    ['paredit.barfSexpBackward', newParedit.backwardBarfSexp],
    ['paredit.splitSexp', newParedit.splitSexp],
    ['paredit.spliceSexp', newParedit.spliceSexp],
    // ['paredit.transpose', ], // TODO: Not yet implemented
    ['paredit.raiseSexp', newParedit.raiseSexp],
    ['paredit.convolute', newParedit.convolute],
    ['paredit.killSexpForward', (doc: EditableDocument) => { newParedit.killRange(doc, newParedit.rangeToForwardSexp(doc)) }],
    ['paredit.killSexpBackward', (doc: EditableDocument) => { newParedit.killRange(doc, newParedit.rangeToBackwardSexp(doc)) }],
    ['paredit.killListForward', newParedit.killForwardList], // TODO: Implement with killRange
    ['paredit.killListBackward', newParedit.killBackwardList], // TODO: Implement with killRange
    ['paredit.spliceSexpKillForward', newParedit.spliceSexpKillingForward],
    ['paredit.spliceSexpKillBackward', newParedit.spliceSexpKillingBackward],
    ['paredit.wrapAroundParens', (doc: EditableDocument) => { newParedit.wrapSexpr(doc, '(', ')') }],
    ['paredit.wrapAroundSquare', (doc: EditableDocument) => { newParedit.wrapSexpr(doc, '[', ']') }],
    ['paredit.wrapAroundCurly', (doc: EditableDocument) => { newParedit.wrapSexpr(doc, '{', '}') }],
    ['paredit.deleteForward', newParedit.deleteForward], // TODO: Strict mode not working
    ['paredit.deleteBackward', newParedit.backspace],

];

function wrapNewPareditCommand(command: string, fn: Function) {
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
            if(keyMap == 'original') {
                workspace.getConfiguration().update('calva.paredit.defaultKeyMap', 'strict', vscode.ConfigurationTarget.Global); 
            } else if(keyMap == 'strict') {
                workspace.getConfiguration().update('calva.paredit.defaultKeyMap', 'original', vscode.ConfigurationTarget.Global); 
            }
        }),
        window.onDidChangeActiveTextEditor((e) => e && e.document && languages.has(e.document.languageId)),
        workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('calva.paredit.defaultKeyMap')) {
                setKeyMapConf();
            }
        }),
        ...newPareditCommands
            .map(([command, fn]) => commands.registerCommand(command, wrapNewPareditCommand(command, fn))));
    commands.executeCommand("setContext", "calva:pareditValid", true);
}

export function deactivate() {
}

export const onPareditKeyMapChanged: Event<String> = onPareditKeyMapChangedEmitter.event;
