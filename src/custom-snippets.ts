import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as util from './utilities';
import * as getText from './util/get-text';
import * as namespace from './namespace';
import * as outputWindow from './results-output/results-doc';
import { customREPLCommandSnippet } from './evaluate';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import * as evaluate from './evaluate';
import * as state from './state';

export async function evaluateCustomCodeSnippetCommand(codeOrKey?: string) {
    await evaluateCustomCodeSnippet(codeOrKey);
}

async function evaluateCustomCodeSnippet(codeOrKey?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const currentLine = editor.selection.active.line;
    const currentColumn = editor.selection.active.character;
    const currentFilename = editor.document.fileName;
    let configErrors: { name: string; keys: string[] }[] = [];
    const globalSnippets = getConfig()
        .customREPLCommandSnippetsGlobal as customREPLCommandSnippet[];
    const workspaceSnippets = getConfig()
        .customREPLCommandSnippetsWorkspace as customREPLCommandSnippet[];
    const workspaceFolderSnippets = getConfig()
        .customREPLCommandSnippetsWorkspaceFolder as customREPLCommandSnippet[];
    let snippets = [
        ...(globalSnippets ? globalSnippets : []),
        ...(workspaceSnippets ? workspaceSnippets : []),
        ...(workspaceFolderSnippets ? workspaceFolderSnippets : []),
    ];
    if (snippets.length < 1) {
        snippets = getConfig().customREPLCommandSnippets;
    }
    const snippetsDict = {};
    const snippetsKeyDict = {};
    const snippetsMenuItems: string[] = [];
    const editorNS =
        editor && editor.document && editor.document.languageId === 'clojure'
            ? namespace.getNamespace(editor.document)
            : undefined;
    const editorRepl =
        editor && editor.document && editor.document.languageId === 'clojure'
            ? replSession.getReplSessionTypeFromState()
            : 'clj';
    snippets.forEach((c: customREPLCommandSnippet) => {
        const undefs = ['name', 'snippet'].filter((k) => {
            return !c[k];
        });
        if (undefs.length > 0) {
            configErrors.push({ name: c.name, keys: undefs });
        }
        const entry = { ...c };
        entry.ns = entry.ns ? entry.ns : editorNS;
        entry.repl = entry.repl ? entry.repl : editorRepl;
        const prefix = entry.key !== undefined ? `${entry.key}: ` : '';
        const item = `${prefix}${entry.name} (${entry.repl})`;
        snippetsMenuItems.push(item);
        snippetsDict[item] = entry;
        snippetsKeyDict[entry.key] = item;
    });

    if (configErrors.length > 0) {
        vscode.window.showErrorMessage(
            'Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: ' +
                JSON.stringify(configErrors),
            'OK'
        );
        return;
    }

    let pick: string;
    if (codeOrKey === undefined) {
        // Without codeOrKey always show snippets menu
        if (snippetsMenuItems.length > 0) {
            try {
                pick = await util.quickPickSingle({
                    values: snippetsMenuItems,
                    placeHolder: 'Choose a command to run at the REPL',
                    saveAs: 'runCustomREPLCommand',
                });
                if (pick === undefined || pick.length < 1) {
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        }
        if (pick === undefined) {
            outputWindow.append(
                '; No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.'
            );
            return;
        }
    }
    if (pick === undefined) {
        // still no pick, but codeOrKey might be one
        pick = snippetsKeyDict[codeOrKey];
    }
    const code = pick !== undefined ? snippetsDict[pick].snippet : codeOrKey;
    const ns = pick !== undefined ? snippetsDict[pick].ns : editorNS;
    const repl = pick !== undefined ? snippetsDict[pick].repl : editorRepl;
    const interpolatedCode = code
        .replace(/\$line/g, currentLine)
        .replace(/\$column/g, currentColumn)
        .replace(/\$file/g, currentFilename)
        .replace(/\$ns/g, ns)
        .replace(/\$selection/g, editor.document.getText(editor.selection))
        .replace(/\$current-form/g, getText.currentFormText(editor)[1])
        .replace(
            /\$enclosing-form/g,
            getText.currentEnclosingFormText(editor)[1]
        )
        .replace(
            /\$top-level-form/g,
            getText.currentTopLevelFormText(editor)[1]
        )
        .replace(/\$current-fn/g, getText.currentFunction(editor)[1])
        .replace(
            /\$top-level-defined-symbol/g,
            getText.currentTopLevelFunction(editor)[1]
        )
        .replace(/\$head/g, getText.toStartOfList(editor)[1])
        .replace(/\$tail/g, getText.toEndOfList(editor)[1]);

    const options = {};

    if (pick !== undefined) {
        options['evaluationSendCodeToOutputWindow'] =
            snippetsDict[pick].evaluationSendCodeToOutputWindow;
        // don't allow addToHistory if we don't show the code but are inside the repl
        options['addToHistory'] =
            state.extensionContext.workspaceState.get('outputWindowActive') &&
            !snippetsDict[pick].evaluationSendCodeToOutputWindow
                ? false
                : undefined;
    }

    await evaluate.evaluateInOutputWindow(interpolatedCode, repl, ns, options);
    outputWindow.appendPrompt();
}
