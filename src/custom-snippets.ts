import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
import * as namespace from './namespace';
import { customREPLCommandSnippet, evaluateInOutputWindow } from './evaluate';

export async function evaluateCustomCommandSnippetCommand(): Promise<void> {
    let pickCounter = 1;
    let configErrors: { "name": string; "keys": string[]; }[] = [];
    const snippets = state.config().customREPLCommandSnippets as customREPLCommandSnippet[];
    const snippetPicks = _.map(snippets, (c: customREPLCommandSnippet) => {
        const undefs = ["name", "snippet", "repl"].filter(k => {
            return !c[k];
        });
        if (undefs.length > 0) {
            configErrors.push({ "name": c.name, "keys": undefs });
        }
        return `${pickCounter++}: ${c.name} (${c.repl})`;
    });
    const snippetsDict = {};
    pickCounter = 1;

    if (configErrors.length > 0) {
        vscode.window.showErrorMessage("Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: " + JSON.stringify(configErrors), "OK");
        return;
    }
    snippets.forEach((c: customREPLCommandSnippet) => {
        snippetsDict[`${pickCounter++}: ${c.name} (${c.repl})`] = c;
    });

    if (snippets && snippets.length > 0) {
        try {
            const pick = await util.quickPickSingle({
                values: snippetPicks,
                placeHolder: "Choose a command to run at the REPL",
                saveAs: "runCustomREPLCommand"
            });
            if (pick && snippetsDict[pick] && snippetsDict[pick].snippet) {
                const editor = vscode.window.activeTextEditor;
                const currentLine = editor.selection.active.line;
                const currentColumn = editor.selection.active.character;
                const currentFilename = editor.document.fileName;
                const editorNS = editor && editor.document && editor.document.languageId === 'clojure' ? namespace.getNamespace(editor.document) : undefined;
                const ns = snippetsDict[pick].ns ? snippetsDict[pick].ns : editorNS;
                const repl = snippetsDict[pick].repl ? snippetsDict[pick].repl : "clj";
                const command = snippetsDict[pick].snippet.
                    replace("$line", currentLine).
                    replace("$column", currentColumn).
                    replace("$file", currentFilename).
                    replace("$ns", ns).
                    replace("$current-form", util.currentFormText(editor, false)).
                    replace("$top-level-form", util.currentFormText(editor, true)).
                    replace("$current-fn", util.currentFunction(editor)).
                    replace("$top-level-defined-symbol", util.currentTopLevelFunction(editor));
                await evaluateInOutputWindow(command, repl ? repl : "clj", ns);
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        vscode.window.showInformationMessage("No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.", ...["OK"]);
    }
}