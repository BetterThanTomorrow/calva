import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as util from './utilities';
import * as namespace from './namespace';
import * as outputWindow from './results-output/results-doc'
import { customREPLCommandSnippet, evaluateInOutputWindow } from './evaluate';
import { getWorkspaceConfig } from './config';

export async function evaluateCustomCodeSnippetCommand(codeOrKey?: string) {
    await evaluateCustomCodeSnippet(codeOrKey);
};

async function evaluateCustomCodeSnippet(codeOrKey?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const currentLine = editor.selection.active.line;
    const currentColumn = editor.selection.active.character;
    const currentFilename = editor.document.fileName;
    let pickCounter = 0;
    let configErrors: { "name": string; "keys": string[]; }[] = [];
    const globalSnippets = getWorkspaceConfig().customREPLCommandSnippetsGlobal as customREPLCommandSnippet[];
    const workspaceSnippets = getWorkspaceConfig().customREPLCommandSnippetsWorkspace as customREPLCommandSnippet[];
    const workspaceFolderSnippets = getWorkspaceConfig().customREPLCommandSnippetsWorkspaceFolder as customREPLCommandSnippet[];
    let snippets = [
        ...(globalSnippets ? globalSnippets : []),
        ...(workspaceSnippets ? workspaceSnippets : []),
        ...(workspaceFolderSnippets ? workspaceFolderSnippets : [])];
    if (snippets.length < 1) {
        snippets = getWorkspaceConfig().customREPLCommandSnippets;
    }
    const snippetsDict = {};
    const snippetsKeyDict = {};
    const snippetsMenuItems: string[] = [];
    const editorNS = editor && editor.document &&
        editor.document.languageId === 'clojure' ? namespace.getNamespace(editor.document) : undefined;
    const editorRepl = editor && editor.document &&
        editor.document.languageId === 'clojure' ? namespace.getREPLSessionType() : "clj";
    snippets.forEach((c: customREPLCommandSnippet) => {
        const undefs = ["name", "snippet"].filter(k => {
            return !c[k];
        });
        if (undefs.length > 0) {
            configErrors.push({ "name": c.name, "keys": undefs });
        }
        const entry = { ...c };
        entry.ns = entry.ns ? entry.ns : editorNS;
        entry.repl = entry.repl ? entry.repl : editorRepl;
        pickCounter++;
        const prefix = entry.key !== undefined ? entry.key : pickCounter;
        const item = `${prefix}: ${entry.name} (${entry.repl})`;
        snippetsMenuItems.push(item);
        snippetsDict[item] = entry;
        snippetsKeyDict[entry.key] = item;
    });

    if (configErrors.length > 0) {
        vscode.window.showErrorMessage("Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: " + JSON.stringify(configErrors), "OK");
        return;
    }

    let pick: string;
    if (codeOrKey === undefined) { // Without codeOrKey always show snippets menu
        if (snippetsMenuItems.length > 0) {
            try {
                pick = await util.quickPickSingle({
                    values: snippetsMenuItems,
                    placeHolder: "Choose a command to run at the REPL",
                    saveAs: "runCustomREPLCommand"
                });
                if (pick === undefined || pick.length < 1) {
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        }
        if (pick === undefined) {
            outputWindow.append("; No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.");
            return;
        }
    }
    if (pick === undefined) { // still no pick, but codeOrKey might be one
        pick = snippetsKeyDict[codeOrKey];
    }
    const code = pick !== undefined ? snippetsDict[pick].snippet : codeOrKey;
    const ns = pick !== undefined ? snippetsDict[pick].ns : editorNS;
    const repl = pick !== undefined ? snippetsDict[pick].repl : editorRepl;
    const interpolatedCode = code.
        replace("$line", currentLine).
        replace("$column", currentColumn).
        replace("$file", currentFilename).
        replace("$ns", ns).
        replace("$current-form", util.currentFormText(editor, false)).
        replace("$top-level-form", util.currentFormText(editor, true)).
        replace("$current-fn", util.currentFunction(editor)).
        replace("$top-level-defined-symbol", util.currentTopLevelFunction(editor));
    await evaluateInOutputWindow(interpolatedCode, repl, ns);
    outputWindow.appendPrompt();
}