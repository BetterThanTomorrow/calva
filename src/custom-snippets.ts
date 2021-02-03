import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
import * as namespace from './namespace';
import { customREPLCommandSnippet, evaluateInOutputWindow } from './evaluate';
import { forEach } from 'lodash';

export async function evaluateCustomCommandSnippetCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const currentLine = editor.selection.active.line;
    const currentColumn = editor.selection.active.character;
    const currentFilename = editor.document.fileName;
    let pickCounter = 0;
    let configErrors: { "name": string; "keys": string[]; }[] = [];
    const snippets = state.config().customREPLCommandSnippets as customREPLCommandSnippet[];
    const snippetsDict = {};
    const snippetsMenuItems: string[] = [];
    snippets.forEach((c: customREPLCommandSnippet) => {
        const undefs = ["name", "snippet"].filter(k => {
            return !c[k];
        });
        if (undefs.length > 0) {
            configErrors.push({ "name": c.name, "keys": undefs });
        }
        const entry = { ...c };
        const editorNS = editor && editor.document && editor.document.languageId === 'clojure' ? namespace.getNamespace(editor.document) : undefined;
        entry.ns = c.ns ? c.ns : editorNS;
        const editorRepl = editor && editor.document && editor.document.languageId === 'clojure' ? namespace.getREPLSessionType() : "clj";
        entry.repl = c.repl ? c.repl : editorRepl;
        pickCounter++;
        const prefix = c.key !== undefined ? c.key : pickCounter;
        const item = `${prefix}: ${entry.name} (${entry.repl})`;
        snippetsMenuItems.push(item);
        snippetsDict[item] = entry;
    });

    if (configErrors.length > 0) {
        vscode.window.showErrorMessage("Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: " + JSON.stringify(configErrors), "OK");
        return;
    }

    if (snippets && snippets.length > 0) {
        try {
            const pick = await util.quickPickSingle({
                values: snippetsMenuItems,
                placeHolder: "Choose a command to run at the REPL",
                saveAs: "runCustomREPLCommand"
            });
            if (pick && snippetsDict[pick] && snippetsDict[pick].snippet) {
                const command = snippetsDict[pick].snippet.
                    replace("$line", currentLine).
                    replace("$column", currentColumn).
                    replace("$file", currentFilename).
                    replace("$ns", snippetsDict[pick].ns).
                    replace("$current-form", util.currentFormText(editor, false)).
                    replace("$top-level-form", util.currentFormText(editor, true)).
                    replace("$current-fn", util.currentFunction(editor)).
                    replace("$top-level-defined-symbol", util.currentTopLevelFunction(editor));
                await evaluateInOutputWindow(command, snippetsDict[pick].repl, snippetsDict[pick].ns);
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        vscode.window.showInformationMessage("No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.", ...["OK"]);
    }
}