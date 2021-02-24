'use strict';
import { StatusBar } from './statusbar';
import * as vscode from 'vscode';
import { commands, window, ExtensionContext, workspace, ConfigurationChangeEvent } from 'vscode';
import { Event, EventEmitter } from 'vscode';
import * as paredit from '../cursor-doc/paredit';
import * as docMirror from '../doc-mirror/index';
import { EditableDocument } from '../cursor-doc/model';

let onPareditKeyMapChangedEmitter = new EventEmitter<String>();

const languages = new Set(["clojure", "lisp", "scheme"]);
let enabled = true;

type PareditCommand = {
    command: string,
    handler: (doc: EditableDocument) => void
}

const pareditCommands: PareditCommand[] = [
    // NAVIGATING
    {
        command: 'paredit.forwardSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeRight(doc, paredit.forwardSexpRange(doc)) }
    },
    {
        command: 'paredit.backwardSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeLeft(doc, paredit.backwardSexpRange(doc)) }
    },
    {
        command: 'paredit.forwardDownSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeRight(doc, paredit.rangeToForwardDownList(doc)) }
    },
    {
        command: 'paredit.backwardDownSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeLeft(doc, paredit.rangeToBackwardDownList(doc)) }
    },
    {
        command: 'paredit.forwardUpSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeRight(doc, paredit.rangeToForwardUpList(doc)) }
    },
    {
        command: 'paredit.backwardUpSexp',
        handler: (doc: EditableDocument) => { paredit.moveToRangeLeft(doc, paredit.rangeToBackwardUpList(doc)) }
    },
    {
        command: 'paredit.closeList',
        handler: (doc: EditableDocument) => { paredit.moveToRangeRight(doc, paredit.rangeToForwardList(doc)) }
    },
    {
        command: 'paredit.openList',
        handler: (doc: EditableDocument) => { paredit.moveToRangeLeft(doc, paredit.rangeToBackwardList(doc)) }
    },

    // SELECTING
    {
        command: 'paredit.rangeForDefun',
        handler: (doc: EditableDocument) => { paredit.selectRange(doc, paredit.rangeForDefun(doc)) }
    },
    {
        command: 'paredit.sexpRangeExpansion',
        handler: paredit.growSelection
    }, // TODO: Inside string should first select contents
    {
        command: 'paredit.sexpRangeContraction',
        handler: paredit.shrinkSelection
    },

    {
        command: 'paredit.selectForwardSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionLeft(doc, paredit.forwardSexpRange(doc))
        }
    },
    {
        command: 'paredit.selectBackwardSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionRight(doc, paredit.backwardSexpRange(doc))
        }
    },
    {
        command: 'paredit.selectForwardDownSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionLeft(doc, paredit.rangeToForwardDownList(doc, doc.selectionRight))
        }
    },
    {
        command: 'paredit.selectBackwardDownSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionRight(doc, paredit.rangeToBackwardDownList(doc))
        }
    },
    {
        command: 'paredit.selectForwardUpSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionLeft(doc, paredit.rangeToForwardUpList(doc, doc.selectionRight))
        }
    },
    {
        command: 'paredit.selectBackwardUpSexp',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionRight(doc, paredit.rangeToBackwardUpList(doc))
        }
    },
    {
        command: 'paredit.selectCloseList',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionLeft(doc, paredit.rangeToForwardList(doc, doc.selectionRight))
        }
    },
    {
        command: 'paredit.selectOpenList',
        handler: (doc: EditableDocument) => {
            paredit.selectRangeFromSelectionRight(doc, paredit.rangeToBackwardList(doc))
        }
    },

    // EDITING
    {
        command: 'paredit.slurpSexpForward',
        handler: paredit.forwardSlurpSexp
    },
    {
        command: 'paredit.barfSexpForward',
        handler: paredit.forwardBarfSexp
    },
    {
        command: 'paredit.slurpSexpBackward',
        handler: paredit.backwardSlurpSexp
    },
    {
        command: 'paredit.barfSexpBackward',
        handler: paredit.backwardBarfSexp
    },
    {
        command: 'paredit.splitSexp',
        handler: paredit.splitSexp
    },
    {
        command: 'paredit.joinSexp',
        handler: paredit.joinSexp
    },
    {
        command: 'paredit.spliceSexp',
        handler: paredit.spliceSexp
    },
    // ['paredit.transpose', ], // TODO: Not yet implemented
    {
        command: 'paredit.raiseSexp',
        handler: paredit.raiseSexp
    },
    {
        command: 'paredit.transpose',
        handler: paredit.transpose
    },
    {
        command: 'paredit.dragSexprBackward',
        handler: paredit.dragSexprBackward
    },
    {
        command: 'paredit.dragSexprForward',
        handler: paredit.dragSexprForward
    },
    {
        command: 'paredit.dragSexprBackwardUp',
        handler: paredit.dragSexprBackwardUp
    },
    {
        command: 'paredit.dragSexprForwardDown',
        handler: paredit.dragSexprForwardDown
    },
    {
        command: 'paredit.dragSexprForwardUp',
        handler: paredit.dragSexprForwardUp
    },
    {
        command: 'paredit.dragSexprBackwardDown',
        handler: paredit.dragSexprBackwardDown
    },
    {
        command: 'paredit.convolute',
        handler: paredit.convolute
    },
    {
        command: 'paredit.killSexpForward',
        handler: (doc: EditableDocument) => { paredit.killRange(doc, paredit.forwardSexpRange(doc)) }
    },
    {
        command: 'paredit.killSexpBackward',
        handler: (doc: EditableDocument) => { paredit.killRange(doc, paredit.backwardSexpRange(doc)) }
    },
    {
        command: 'paredit.killListForward',
        handler: paredit.killForwardList
    }, // TODO: Implement with killRange
    {
        command: 'paredit.killListBackward',
        handler: paredit.killBackwardList
    }, // TODO: Implement with killRange
    {
        command: 'paredit.spliceSexpKillForward',
        handler: (doc: EditableDocument) => {
            paredit.killForwardList(doc).then((isFulfilled) => {
                return paredit.spliceSexp(doc, doc.selectionRight, false);
            });
        }
    },
    {
        command: 'paredit.spliceSexpKillBackward',
        handler: (doc: EditableDocument) => {
            paredit.killBackwardList(doc).then((isFulfilled) => {
                return paredit.spliceSexp(doc, doc.selectionRight, false);
            })
        }
    },
    {
        command: 'paredit.wrapAroundParens',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '(', ')') }
    },
    {
        command: 'paredit.wrapAroundSquare',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '[', ']') }
    },
    {
        command: 'paredit.wrapAroundCurly',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '{', '}') }
    },
    {
        command: 'paredit.wrapAroundQuote',
        handler: (doc: EditableDocument) => { paredit.wrapSexpr(doc, '"', '"') }
    },
    {
        command: 'paredit.rewrapParens',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '(', ')') }
    },
    {
        command: 'paredit.rewrapSquare',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '[', ']') }
    },
    {
        command: 'paredit.rewrapCurly',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '{', '}') }
    },
    {
        command: 'paredit.rewrapQuote',
        handler: (doc: EditableDocument) => { paredit.rewrapSexpr(doc, '"', '"') }
    },
    {
        command: 'paredit.deleteForward',
        handler: paredit.deleteForward
    },
    {
        command: 'paredit.deleteBackward',
        handler: paredit.backspace
    },
    {
        command: 'paredit.forceDeleteForward',
        handler: () => { vscode.commands.executeCommand('deleteRight') }
    },
    {
        command: 'paredit.forceDeleteBackward',
        handler: () => { vscode.commands.executeCommand('deleteLeft') }
    }
];

function wrapPareditCommand(command: PareditCommand) {
    return () => {
        try {
            const textEditor = window.activeTextEditor,
                mDoc: EditableDocument = docMirror.getDocument(textEditor.document);
            if (!enabled || !languages.has(textEditor.document.languageId)) return;
            command.handler(mDoc);
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
