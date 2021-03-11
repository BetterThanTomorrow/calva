import * as vscode from 'vscode';
import { customREPLCommandSnippet } from './evaluate';
import { ReplConnectSequence } from './nrepl/connectSequence';
import { PrettyPrintingOptions } from './printer';

const REPL_FILE_EXT = 'calva-repl';
const KEYBINDINGS_ENABLED_CONFIG_KEY = 'calva.keybindingsEnabled';
const KEYBINDINGS_ENABLED_CONTEXT_KEY = 'calva:keybindingsEnabled';
const CLOJURE_LSP_VERSION = '2021.03.06-17.05.35';

type ReplSessionType = 'clj' | 'cljs';

// include the 'file' and 'untitled' to the
// document selector. All other schemes are
// not known and therefore not supported.
const documentSelector = [
    { scheme: 'file', language: 'clojure' },
    { scheme: 'jar', language: 'clojure' },
    { scheme: 'untitled', language: 'clojure' }
];

/**
 * Trims EDN alias and profile names from any surrounding whitespace or `:` characters.
 * This in order to free the user from having to figure out how the name should be entered.
 * @param  {string} name
 * @return {string} The trimmed name
 */
 function _trimAliasName(name: string): string {
    return name.replace(/^[\s,:]*/, "").replace(/[\s,:]*$/, "")
}

// TODO find a way to validate the configs
function getConfig() {
    const configOptions = vscode.workspace.getConfiguration('calva');
    return {
        format: configOptions.get("formatOnSave"),
        evaluate: configOptions.get("evalOnSave"),
        test: configOptions.get("testOnSave"),
        showDocstringInParameterHelp: configOptions.get("showDocstringInParameterHelp") as boolean,
        jackInEnv: configOptions.get("jackInEnv"),
        jackInDependencyVersions: configOptions.get("jackInDependencyVersions") as { JackInDependency: string },
        openBrowserWhenFigwheelStarted: configOptions.get("openBrowserWhenFigwheelStarted") as boolean,
        customCljsRepl: configOptions.get("customCljsRepl", null),
        replConnectSequences: configOptions.get("replConnectSequences") as ReplConnectSequence[],
        myLeinProfiles: configOptions.get("myLeinProfiles", []).map(_trimAliasName) as string[],
        myCljAliases: configOptions.get("myCljAliases", []).map(_trimAliasName) as string[],
        asyncOutputDestination: configOptions.get("sendAsyncOutputTo") as string,
        customREPLCommandSnippets: configOptions.get("customREPLCommandSnippets", []),
        customREPLCommandSnippetsGlobal: configOptions.inspect("customREPLCommandSnippets").globalValue as customREPLCommandSnippet[],
        customREPLCommandSnippetsWorkspace: configOptions.inspect("customREPLCommandSnippets").workspaceValue as customREPLCommandSnippet[],
        customREPLCommandSnippetsWorkspaceFolder: configOptions.inspect("customREPLCommandSnippets").workspaceFolderValue as customREPLCommandSnippet[],
        prettyPrintingOptions: configOptions.get("prettyPrintingOptions") as PrettyPrintingOptions,
        enableJSCompletions: configOptions.get("enableJSCompletions") as boolean,
        autoOpenREPLWindow: configOptions.get("autoOpenREPLWindow") as boolean,
        autoOpenJackInTerminal: configOptions.get("autoOpenJackInTerminal") as boolean,
        referencesCodeLensEnabled: configOptions.get('referencesCodeLens.enabled') as boolean,
        displayDiagnostics: configOptions.get('displayDiagnostics') as boolean,
        hideReplUi: configOptions.get('hideReplUi') as boolean
    };
}

export {
    REPL_FILE_EXT,
    KEYBINDINGS_ENABLED_CONFIG_KEY,
    KEYBINDINGS_ENABLED_CONTEXT_KEY,
    CLOJURE_LSP_VERSION,
    documentSelector,
    ReplSessionType,
    getConfig
}
