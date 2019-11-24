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

type PareditCommand = {
    command: string,
    handler: (doc: EditableDocument) => void,
    replWindowCommand: string
}

const pareditCommands: PareditCommand[] = [
    // NAVIGATING
    {
        command: 'paredit.forwardSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardSexp(doc)) },
        replWindowCommand: "forward-sexp"
    },
    {
        command: 'paredit.backwardSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardSexp(doc)) },
        replWindowCommand: "backward-sexp"
    },
    {
        command: 'paredit.forwardDownSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardDownList(doc)) },
        replWindowCommand: "down-list"
    },
    {
        command: 'paredit.backwardDownSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardDownList(doc)) },
        replWindowCommand: ""
    },
    {
        command: 'paredit.forwardUpSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardUpList(doc)) },
        replWindowCommand: "forward-up-list"
    },
    {
        command: 'paredit.backwardUpSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardUpList(doc)) },
        replWindowCommand: "backward-up-list"
    },
    {
        command: 'paredit.closeList',
        handler: (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardList(doc)) },
        replWindowCommand: ""
    },
    {
        command: 'paredit.openList',
        handler: (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardList(doc)) },
        replWindowCommand: ""
    },

    // SELECTING
    {
        command: 'paredit.rangeForDefun',
        handler: (doc: EditableDocument) => { paredit.selectRange(doc, paredit.rangeForDefun(doc)) },
        replWindowCommand: ""
    },
    {
        command: 'paredit.sexpRangeExpansion',
        handler: paredit.growSelection,
        replWindowCommand: "grow-selection"
    }, // TODO: Inside string should first select contents
    {
        command: 'paredit.sexpRangeContraction',
        handler: paredit.shrinkSelection,
        replWindowCommand: "shrink-selection"
    },

    {
        command: 'paredit.selectForwardSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardSexp(doc, doc.selectionEnd))
        },
        replWindowCommand: ""
    },
    {
        command: 'paredit.selectBackwardSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardSexp(doc))
        },
        replWindowCommand: ""
    },
    {
        command: 'paredit.selectForwardDownSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardDownList(doc, doc.selectionEnd))
        },
        replWindowCommand: ""
    },
    {
        command: 'paredit.selectBackwardDownSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardDownList(doc))
        },
        replWindowCommand: ""
    },
    {
        command: 'paredit.selectForwardUpSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardUpList(doc, doc.selectionEnd))
        },
        replWindowCommand: ""
    },
    {
        command: 'paredit.selectBackwardUpSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardUpList(doc))
        },
        replWindowCommand: ""
    },
    {
        command: 'paredit.selectCloseList',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardList(doc, doc.selectionEnd))
        },
        replWindowCommand: ""
    },
    {
        command: 'paredit.selectOpenList',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardList(doc))
        },
        replWindowCommand: ""
    },

    // EDITING
    {
        command: 'paredit.slurpSexpForward',
        handler: paredit.forwardSlurpSexp,
        replWindowCommand: "forward-slurp-sexp"
    },
    {
        command: 'paredit.barfSexpForward',
        handler: paredit.forwardBarfSexp,
        replWindowCommand: "forward-barf-sexp"
    },
    {
        command: 'paredit.slurpSexpBackward',
        handler: paredit.backwardSlurpSexp,
        replWindowCommand: "backward-slurp-sexp"
    },
    {
        command: 'paredit.barfSexpBackward',
        handler: paredit.backwardBarfSexp,
        replWindowCommand: "backward-barf-sexp"
    },
    {
        command: 'paredit.splitSexp',
        handler: paredit.splitSexp,
        replWindowCommand: "split"
    },
    {
        command: 'paredit.spliceSexp',
        handler: paredit.spliceSexp,
        replWindowCommand: "splice-sexp"
    },
    // ['paredit.transpose', ], // TODO: Not yet implemented
    {
        command: 'paredit.raiseSexp',
        handler: paredit.raiseSexp,
        replWindowCommand: ""
    },
    {
        command: 'paredit.convolute',
        handler: paredit.convolute,
        replWindowCommand: ""
    },
    {
        command: 'paredit.killSexpForward',
        handler: (doc: EditableDocument) => { paredit.killRange(doc, paredit.rangeToForwardSexp(doc)) },
        replWindowCommand: ""
    },
    {
        command: 'paredit.killSexpBackward',
        handler: (doc: EditableDocument) => { paredit.killRange(doc, paredit.rangeToBackwardSexp(doc)) },
        replWindowCommand: ""
    },
    {
        command: 'paredit.killListForward',
        handler: paredit.killForwardList,
        replWindowCommand: ""
    }, // TODO: Implement with killRange
    {
        command: 'paredit.killListBackward',
        handler: paredit.killBackwardList,
        replWindowCommand: ""
    }, // TODO: Implement with killRange
    {
        command: 'paredit.spliceSexpKillForward',
        handler: paredit.spliceSexpKillingForward,
        replWindowCommand: "splice-sexp-killing-forward"
    },
    {
        command: 'paredit.spliceSexpKillBackward',
        handler: paredit.spliceSexpKillingBackward,
        replWindowCommand: "splice-sexp-killing-backward"
    },
    {
        command: 'paredit.wrapAroundParens',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '(', ')') },
        replWindowCommand: "wrap-round"
    },
    {
        command: 'paredit.wrapAroundSquare',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '[', ']') },
        replWindowCommand: "wrap-square"
    },
    {
        command: 'paredit.wrapAroundCurly',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '{', '}') },
        replWindowCommand: "wrap-curly"
    },
    {
        command: 'paredit.deleteForward',
        handler: paredit.deleteForward,
        replWindowCommand: "delete"
    },
    {
        command: 'paredit.deleteBackward',
        handler: paredit.backspace,
        replWindowCommand: "backspace"
    },

];

function wrapPareditCommand(command: PareditCommand) {
    return () => {
        try {
            let repl = activeReplWindow();

            if (repl) {
                repl.executeCommand(command.replWindowCommand)
            } else {
                const textEditor = window.activeTextEditor,
                    mDoc: EditableDocument = docMirror.getDocument(textEditor.document);
                if (!enabled || !languages.has(textEditor.document.languageId)) return;
                command.handler(mDoc);
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
            .map((command) => commands.registerCommand(command.command, wrapPareditCommand(command))));
    commands.executeCommand("setContext", "calva:pareditValid", true);
}

export function deactivate() {
}

export const onPareditKeyMapChanged: Event<String> = onPareditKeyMapChangedEmitter.event;
