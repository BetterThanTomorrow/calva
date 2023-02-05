import vscode from 'vscode';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { customREPLCommandSnippet } from './evaluate';
import { ReplConnectSequence } from './nrepl/connectSequence';
import { PrettyPrintingOptions } from './printer';
import { readConfigEdn } from './cljs-lib/out/cljs-lib';
import state from './state';
import _ from 'lodash';
import { isDefined } from './utilities';

const REPL_FILE_EXT = 'calva-repl';
const KEYBINDINGS_ENABLED_CONFIG_KEY = 'calva.keybindingsEnabled';
const KEYBINDINGS_ENABLED_CONTEXT_KEY = 'calva:keybindingsEnabled';

type ReplSessionType = 'clj' | 'cljs';

// include the 'file' and 'untitled' to the
// document selector. All other schemes are
// not known and therefore not supported.
const documentSelector = [
  { scheme: 'file', language: 'clojure' },
  { scheme: 'jar', language: 'clojure' },
  { scheme: 'untitled', language: 'clojure' },
];

/**
 * Trims EDN alias and profile names from any surrounding whitespace or `:` characters.
 * This in order to free the user from having to figure out how the name should be entered.
 * @param  {string} name
 * @return {string} The trimmed name
 */
function _trimAliasName(name: string): string {
  return name.replace(/^[\s,:]*/, '').replace(/[\s,:]*$/, '');
}

const userConfigFileUri = vscode.Uri.joinPath(
  vscode.Uri.file(os.homedir()),
  '.config',
  'calva',
  'config.edn'
);

async function openCalvaConfigEdn() {
  return fs.promises
    .access(userConfigFileUri.fsPath, fs.constants.F_OK)
    .then(async () => await vscode.window.showTextDocument(userConfigFileUri))
    .catch(async (error) => {
      if (error.code === 'ENOENT') {
        try {
          await fs.promises.mkdir(path.dirname(userConfigFileUri.fsPath), { recursive: true });
          await fs.promises.writeFile(
            userConfigFileUri.fsPath,
            '{:customREPLHoverSnippets []\n :customREPLCommandSnippets []}'
          );
          await vscode.window.showTextDocument(userConfigFileUri);
        } catch (error) {
          console.error('Error creating user config.edn', error);
        }
      } else {
        void vscode.window.showErrorMessage('Could not open user config.edn. ' + error.message);
      }
    });
}

async function updateCalvaConfigFromUserConfigEdn(onDemand = true) {
  return fs.promises
    .access(userConfigFileUri.fsPath, fs.constants.F_OK)
    .then(async () => await updateCalvaConfigFromEdn(userConfigFileUri))
    .catch((error) => {
      if (error.code === 'ENOENT') {
        console.log('No user config.edn found');
        if (onDemand) {
          void vscode.window
            .showInformationMessage(
              'User config.edn file does not exist. Create one and open it?',
              'Yes, please'
            )
            .then((choice) => {
              if (choice === 'Yes, please') {
                void openCalvaConfigEdn();
              }
            });
        }
      } else {
        console.error('Error reading user config.edn' + error);
      }
    });
}

async function updateCalvaConfigFromEdn(uri?: vscode.Uri) {
  try {
    let resolvedUri: vscode.Uri;
    const configPath = state.resolvePath('.calva/config.edn');

    if (isDefined(uri)) {
      resolvedUri = uri;
    } else if (isDefined(configPath)) {
      resolvedUri = configPath;
    } else {
      throw new Error('Expected a uri to be passed in or a config to exist at .calva/config.edn');
    }
    const data = await vscode.workspace.fs.readFile(resolvedUri);
    return addEdnConfig(new TextDecoder('utf-8').decode(data));
  } catch (error) {
    return error;
  }
}

function mergeSnippets(
  oldSnippets: customREPLCommandSnippet[],
  newSnippets: customREPLCommandSnippet[]
): customREPLCommandSnippet[] {
  return newSnippets.concat(
    _.reject(
      oldSnippets,
      (item) => _.findIndex(newSnippets, (newItem) => item.name === newItem.name) !== -1
    )
  );
}

/**
 * Saves the EDN config in the state to be merged into the actual vsconfig.
 * Currently only `:customREPLCommandSnippets` and `customREPLHoverSnippets` are supported.
 * @param {string} data a string representation of a clojure map
 * @returns an error of one was thrown
 */
function addEdnConfig(data: string) {
  try {
    const parsed = readConfigEdn(data);
    const old = state.getProjectConfig();

    state.setProjectConfig({
      customREPLCommandSnippets: mergeSnippets(
        old?.customREPLCommandSnippets ?? [],
        parsed?.customREPLCommandSnippets ?? []
      ),
      customREPLHoverSnippets: mergeSnippets(
        old?.customREPLHoverSnippets ?? [],
        parsed?.customREPLHoverSnippets ?? []
      ),
    });
  } catch (error) {
    return error;
  }
}
const watcher = vscode.workspace.createFileSystemWatcher(
  '**/.calva/**/config.edn',
  false,
  false,
  false
);

watcher.onDidChange((uri: vscode.Uri) => {
  void updateCalvaConfigFromEdn(uri);
});

// TODO find a way to validate the configs
function getConfig() {
  const configOptions = vscode.workspace.getConfiguration('calva');
  const pareditOptions = vscode.workspace.getConfiguration('calva.paredit');

  const commands = (
    configOptions.inspect<customREPLCommandSnippet[]>('customREPLCommandSnippets')
      ?.workspaceValue ?? []
  ).concat(
    (state.getProjectConfig()?.customREPLCommandSnippets as customREPLCommandSnippet[]) ?? []
  );
  const hoverSnippets = (
    configOptions.inspect<customREPLCommandSnippet[]>('customREPLHoverSnippets')?.workspaceValue ??
    []
  ).concat((state.getProjectConfig()?.customREPLHoverSnippets as customREPLCommandSnippet[]) ?? []);

  return {
    formatOnSave: configOptions.get('formatOnSave'),
    evalOnSave: configOptions.get('evalOnSave'),
    testOnSave: configOptions.get('testOnSave'),
    showDocstringInParameterHelp: configOptions.get<boolean>('showDocstringInParameterHelp'),
    jackInEnv: configOptions.get('jackInEnv'),
    jackInDependencyVersions: configOptions.get<{
      JackInDependency: string;
    }>('jackInDependencyVersions'),
    clojureLspVersion: configOptions.get<string>('clojureLspVersion'),
    clojureLspPath: configOptions.get<string>('clojureLspPath'),
    openBrowserWhenFigwheelStarted: configOptions.get<boolean>('openBrowserWhenFigwheelStarted'),
    customCljsRepl: configOptions.get('customCljsRepl', null),
    replConnectSequences: configOptions.get<ReplConnectSequence[]>('replConnectSequences'),
    myLeinProfiles: configOptions.get<string[]>('myLeinProfiles', []).map(_trimAliasName),
    myCljAliases: configOptions.get<string[]>('myCljAliases', []).map(_trimAliasName),
    asyncOutputDestination: configOptions.get<string>('sendAsyncOutputTo'),
    customREPLCommandSnippets: configOptions.get<customREPLCommandSnippet[]>(
      'customREPLCommandSnippets',
      []
    ),
    customREPLCommandSnippetsGlobal:
      configOptions.inspect<customREPLCommandSnippet[]>('customREPLCommandSnippets')?.globalValue ??
      [],
    customREPLCommandSnippetsWorkspace: commands,
    customREPLCommandSnippetsWorkspaceFolder:
      configOptions.inspect<customREPLCommandSnippet[]>('customREPLCommandSnippets')
        ?.workspaceFolderValue ?? [],
    customREPLHoverSnippets: hoverSnippets,
    prettyPrintingOptions: configOptions.get<PrettyPrintingOptions>('prettyPrintingOptions'),
    evaluationSendCodeToOutputWindow: configOptions.get<boolean>(
      'evaluationSendCodeToOutputWindow'
    ),
    enableJSCompletions: configOptions.get<boolean>('enableJSCompletions'),
    autoOpenREPLWindow: configOptions.get<boolean>('autoOpenREPLWindow'),
    autoOpenJackInTerminal: configOptions.get('autoOpenJackInTerminal'),
    referencesCodeLensEnabled: configOptions.get<boolean>('referencesCodeLens.enabled'),
    hideReplUi: configOptions.get<boolean>('hideReplUi'),
    strictPreventUnmatchedClosingBracket: pareditOptions.get<boolean>(
      'strictPreventUnmatchedClosingBracket'
    ),
    showCalvaSaysOnStart: configOptions.get<boolean>('showCalvaSaysOnStart'),
    jackIn: {
      useDeprecatedAliasFlag: configOptions.get<boolean>('jackIn.useDeprecatedAliasFlag'),
    },
    enableClojureLspOnStart: configOptions.get<boolean>('enableClojureLspOnStart'),
    projectRootsSearchExclude: configOptions.get<string[]>('projectRootsSearchExclude', []),
    useLiveShare: configOptions.get<boolean>('useLiveShare'),
    definitionProviderPriority: configOptions.get<string[]>('definitionProviderPriority'),
    depsEdnJackInExecutable: configOptions.get<string>('depsEdnJackInExecutable'),
    depsCljPath: configOptions.get<string>('depsCljPath'),
  };
}

export {
  updateCalvaConfigFromEdn,
  updateCalvaConfigFromUserConfigEdn,
  openCalvaConfigEdn,
  addEdnConfig,
  REPL_FILE_EXT,
  KEYBINDINGS_ENABLED_CONFIG_KEY,
  KEYBINDINGS_ENABLED_CONTEXT_KEY,
  documentSelector,
  ReplSessionType,
  getConfig,
};
