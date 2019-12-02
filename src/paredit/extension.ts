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
    replWindowCommand?: string
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
        replWindowCommand: "backward-down-list"
    },
    {
        command: 'paredit.forwardUpSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardUpList(doc)) },
        replWindowCommand: "up-list"
    },
    {
        command: 'paredit.backwardUpSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardUpList(doc)) },
        replWindowCommand: "backward-up-list"
    },
    {
        command: 'paredit.closeList',
        handler: (doc: EditableDocument) => { paredit.moveToRangeEnd(doc, paredit.rangeToForwardList(doc)) },
        replWindowCommand: "close-list"
    },
    {
        command: 'paredit.openList',
        handler: (doc: EditableDocument) => { paredit.moveToRangeStart(doc, paredit.rangeToBackwardList(doc)) },
        replWindowCommand: "open-list"
    },

    // SELECTING
    {
        command: 'paredit.rangeForDefun',
        handler: (doc: EditableDocument) => { paredit.selectRange(doc, paredit.rangeForDefun(doc)) },
        replWindowCommand: "select-defun"
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
        replWindowCommand: "select-forward-sexp"
    },
    {
        command: 'paredit.selectBackwardSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardSexp(doc))
        },
        replWindowCommand: "select-backward-sexp"
    },
    {
        command: 'paredit.selectForwardDownSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardDownList(doc, doc.selectionEnd))
        },
        replWindowCommand: "select-forward-down-sexp"
    },
    {
        command: 'paredit.selectBackwardDownSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardDownList(doc))
        },
        replWindowCommand: "select-backward-down-sexp"
    },
    {
        command: 'paredit.selectForwardUpSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardUpList(doc, doc.selectionEnd))
        },
        replWindowCommand: "select-forward-up-sexp"
    },
    {
        command: 'paredit.selectBackwardUpSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardUpList(doc))
        },
        replWindowCommand: "select-backward-up-sexp"
    },
    {
        command: 'paredit.selectCloseList',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionStart(doc, paredit.rangeToForwardList(doc, doc.selectionEnd))
        },
        replWindowCommand: "select-close-list"
    },
    {
        command: 'paredit.selectOpenList',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionEnd(doc, paredit.rangeToBackwardList(doc))
        },
        replWindowCommand: "select-open-list"
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
        replWindowCommand: "split-sexp"
    },
    {
        command: 'paredit.joinSexp',
        handler: paredit.joinSexp,
        replWindowCommand: "join-sexp"
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
        replWindowCommand: "raise-sexp"
    },
    {
        command: 'paredit.transpose',
        handler: paredit.transpose,
        replWindowCommand: "transpose-sexps"
    },
    {
        command: 'paredit.pushSexprLeft',
        handler: paredit.pushSexprLeft,
        replWindowCommand: "push-sexp-left"
    },
    {
        command: 'paredit.pushSexprRight',
        handler: paredit.pushSexprRight,
        replWindowCommand: "push-sexp-right"
    },
    {
        command: 'paredit.convolute',
        handler: paredit.convolute,
        replWindowCommand: "convolute-sexp"
    },
    {
        command: 'paredit.killSexpForward',
        handler: (doc: EditableDocument) => { paredit.killRange(doc, paredit.rangeToForwardSexp(doc)) },
        replWindowCommand: "kill-forward-sexp"
    },
    {
        command: 'paredit.killSexpBackward',
        handler: (doc: EditableDocument) => { paredit.killRange(doc, paredit.rangeToBackwardSexp(doc)) },
        replWindowCommand: "kill-backward-sexp"
    },
    {
        command: 'paredit.killListForward',
        handler: paredit.killForwardList,
        replWindowCommand: "kill-close-list"
    }, // TODO: Implement with killRange
    {
        command: 'paredit.killListBackward',
        handler: paredit.killBackwardList,
        replWindowCommand: "kill-open-list"
    }, // TODO: Implement with killRange
    {
        command: 'paredit.spliceSexpKillForward',
        handler: (doc: EditableDocument) => {
            paredit.killForwardList(doc).then((isFulfilled) => {
                return paredit.spliceSexp(doc, doc.selectionEnd, false);
            });
        },
        replWindowCommand: "splice-sexp-killing-forwards"
    },
    {
        command: 'paredit.spliceSexpKillBackward',
        handler: (doc: EditableDocument) => {
            paredit.killBackwardList(doc).then((isFulfilled) => {
                return paredit.spliceSexp(doc, doc.selectionEnd, false);
            })
        },
        replWindowCommand: "splice-sexp-killing-backwards"
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
        command: 'paredit.wrapAroundQuote',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '"', '"') },
        replWindowCommand: "wrap-quote"
    },
    {
        command: 'paredit.rewrapParens',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '(', ')') },
        replWindowCommand: "rewrap-round"
    },
    {
        command: 'paredit.rewrapSquare',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '[', ']') },
        replWindowCommand: "rewrap-square"
    },
    {
        command: 'paredit.rewrapCurly',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '{', '}') },
        replWindowCommand: "rewrap-curly"
    },
    {
        command: 'paredit.rewrapQuote',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '"', '"') },
        replWindowCommand: "rewrap-quote"
    },
    {
        command: 'paredit.deleteForward',
        handler: paredit.deleteForward,
        replWindowCommand: 'delete'
    },
    {
        command: 'paredit.deleteBackward',
        handler: paredit.backspace,
        replWindowCommand: 'backspace'
    },
    {
        command: 'paredit.forceDeleteForward',
        handler: () => { vscode.commands.executeCommand('deleteRight') },
        replWindowCommand: 'force-delete'
    },
    {
        command: 'paredit.forceDeleteBackward',
        handler: () => { vscode.commands.executeCommand('deleteLeft') },
        replWindowCommand: 'force-backspace'
    }
];

function wrapPareditCommand(command: PareditCommand) {
    return () => {
        try {
            let repl = activeReplWindow();

            if (repl && command.replWindowCommand) {
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
}

export function deactivate() {
}

export const onPareditKeyMapChanged: Event<String> = onPareditKeyMapChangedEmitter.event;
