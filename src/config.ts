import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type * as customSnippets from './custom-snippets';
import type * as connectSequence from './nrepl/connectSequence';
import type * as printer from './printer';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as fiddleFilesUtil from './util/fiddle-files';
import * as state from './state';
import _ = require('lodash');
import * as utilities from './utilities';
import * as converters from './converters';
import * as nreplUtil from './nrepl/util';
import * as output from './results-output/output';
import * as jackInDependencyVersions from './nrepl/jack-in-dependency-versions';
import type * as pareditConfig from './cursor-doc/paredit-config';

const REPL_FILE_EXT = 'calva-repl';
const FIDDLE_FILE_EXT = 'fiddle';
const KEYBINDINGS_ENABLED_CONFIG_KEY = 'calva.keybindingsEnabled';
const KEYBINDINGS_ENABLED_CONTEXT_KEY = 'calva:keybindingsEnabled';

type ReplSessionType = string;

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

    if (utilities.isDefined(uri)) {
      resolvedUri = uri;
    } else if (utilities.isDefined(configPath)) {
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
  oldSnippets: customSnippets.CustomREPLCommandSnippet[],
  newSnippets: customSnippets.CustomREPLCommandSnippet[]
): customSnippets.CustomREPLCommandSnippet[] {
  return newSnippets.concat(
    _.reject(
      oldSnippets,
      (item) => _.findIndex(newSnippets, (newItem) => item.name === newItem.name) !== -1
    )
  );
}

/**
 * Merges two threading macro configurations by concatenating their arrays.
 */
function mergeThreadingMacros(
  a: Partial<pareditConfig.ThreadingMacrosConfig>,
  b: Partial<pareditConfig.ThreadingMacrosConfig>
): Partial<pareditConfig.ThreadingMacrosConfig> {
  return {
    firstArg: [...(a.firstArg ?? []), ...(b.firstArg ?? [])],
    lastArg: [...(a.lastArg ?? []), ...(b.lastArg ?? [])],
  };
}

/**
 * Saves the EDN config in the state to be merged into the actual vsconfig.
 * Currently supports: `:customREPLCommandSnippets`, `customREPLHoverSnippets`,
 * `:customPairForms`, and `:customThreadingMacros`.
 * @param {string} data a string representation of a clojure map
 * @returns an error of one was thrown
 */
function addEdnConfig(data: string) {
  try {
    const parsed = cljsLib.readConfigEdn(data);
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
      customPairForms: parsed?.customPairForms ?? [],
      customThreadingMacros: parsed?.customThreadingMacros ?? {},
      aliasMap: parsed?.aliasMap ?? {},
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
    configOptions.inspect<customSnippets.CustomREPLCommandSnippet[]>('customREPLCommandSnippets')
      ?.workspaceValue ?? []
  ).concat(
    (state.getProjectConfig()
      ?.customREPLCommandSnippets as customSnippets.CustomREPLCommandSnippet[]) ?? []
  );
  const hoverSnippets = (
    configOptions.inspect<customSnippets.CustomREPLCommandSnippet[]>('customREPLHoverSnippets')
      ?.workspaceValue ?? []
  ).concat(
    (state.getProjectConfig()
      ?.customREPLHoverSnippets as customSnippets.CustomREPLCommandSnippet[]) ?? []
  );

  const autoEvaluateCode =
    configOptions.inspect<nreplUtil.AutoEvaluateCodeConfig>('autoEvaluateCode');

  const replConnectSequencesConfig =
    configOptions.inspect<connectSequence.ReplConnectSequence[]>('replConnectSequences');
  const normalizeAfterMainReplCode = (code: string | string[] | undefined): string | undefined => {
    if (Array.isArray(code)) {
      return code.join('\n');
    }
    return code;
  };

  const replConnectSequences = [
    ...(replConnectSequencesConfig.workspaceFolderValue ?? []),
    ...(replConnectSequencesConfig.workspaceValue ?? []),
    ...(replConnectSequencesConfig.globalValue ?? []),
  ].map((sequence) => {
    const normalizedCode =
      normalizeAfterMainReplCode(
        sequence.afterPrimaryReplConnectedCode as string | string[] | undefined
      ) ??
      normalizeAfterMainReplCode(sequence.afterCLJReplJackInCode as string | string[] | undefined);

    if (normalizedCode !== undefined) {
      return {
        ...sequence,
        afterPrimaryReplConnectedCode: normalizedCode,
      };
    }

    return sequence;
  });

  return {
    formatOnSave: configOptions.get('formatOnSave'),
    evalOnSave: configOptions.get('evalOnSave'),
    testOnSave: configOptions.get('testOnSave'),
    showDocstringInParameterHelp: configOptions.get<boolean>('showDocstringInParameterHelp'),
    jackInEnv: configOptions.get('jackInEnv'),
    jackInDependencyVersions: jackInDependencyVersions.getEffectiveJackInDependencyVersions(),
    clojureLspVersion: configOptions.get<string>('clojureLspVersion'),
    clojureLspPath: configOptions.get<string>('clojureLspPath'),
    openBrowserWhenFigwheelStarted: configOptions.get<boolean>('openBrowserWhenFigwheelStarted'),
    customCljsRepl: configOptions.get('customCljsRepl', null),
    replConnectSequences,
    myLeinProfiles: configOptions.get<string[]>('myLeinProfiles', []).map(_trimAliasName),
    myCljAliases: configOptions.get<string[]>('myCljAliases', []).map(_trimAliasName),
    asyncOutputDestination: configOptions.get<string>('sendAsyncOutputTo'),
    customREPLCommandSnippets: configOptions.get<customSnippets.CustomREPLCommandSnippet[]>(
      'customREPLCommandSnippets',
      []
    ),
    customREPLCommandSnippetsGlobal:
      configOptions.inspect<customSnippets.CustomREPLCommandSnippet[]>('customREPLCommandSnippets')
        ?.globalValue ?? [],
    customREPLCommandSnippetsWorkspace: commands,
    customREPLCommandSnippetsWorkspaceFolder:
      configOptions.inspect<customSnippets.CustomREPLCommandSnippet[]>('customREPLCommandSnippets')
        ?.workspaceFolderValue ?? [],
    customREPLHoverSnippets: hoverSnippets,
    prettyPrintingOptions:
      configOptions.get<printer.PrettyPrintingOptions>('prettyPrintingOptions'),
    evaluationSendCodeToOutputWindow: configOptions.get<boolean>(
      'evaluationSendCodeToOutputWindow'
    ),
    enableJSCompletions: configOptions.get<boolean>('enableJSCompletions'),
    autoOpenREPLWindow: configOptions.get<boolean>('autoOpenREPLWindow'),
    autoOpenJackInTerminal: configOptions.get('autoOpenJackInTerminal'),
    autoOpenResultOutputDestination: configOptions.get('autoOpenResultOutputDestination'),
    autoOpenInspector: configOptions.get<boolean>('autoOpenInspector'),
    enableInspectorRainbow: configOptions.get<boolean>('enableInspectorRainbow'),
    referencesCodeLensEnabled: configOptions.get<boolean>('referencesCodeLens.enabled'),
    showCalvaSaysOnStart: configOptions.get<boolean>('showCalvaSaysOnStart'),
    enableClojureLspOnStart: configOptions.get<boolean>('enableClojureLspOnStart'),
    projectRootsSearchExclude: configOptions.get<string[]>('projectRootsSearchExclude', []),
    useLiveShare: configOptions.get<boolean>('useLiveShare'),
    definitionProviderPriority: configOptions.get<string[]>('definitionProviderPriority'),
    depsEdnJackInExecutable: configOptions.get<string>('depsEdnJackInExecutable'),
    depsCljPath: configOptions.get<string>('depsCljPath'),
    autoSelectNReplPortFromPortFile: configOptions.get<boolean>('autoSelectNReplPortFromPortFile'),
    autoConnectRepl: configOptions.get<boolean>('autoConnectRepl'),
    autoStartRepl: configOptions.get<boolean>('autoStartRepl'),
    html2HiccupOptions: configOptions.get<converters.HiccupOptions>('html2HiccupOptions'),
    autoEvaluateCode: nreplUtil.mergeAutoEvaluateConfigs(
      [
        autoEvaluateCode.globalValue,
        autoEvaluateCode.workspaceValue,
        autoEvaluateCode.workspaceFolderValue,
      ],
      autoEvaluateCode.defaultValue
    ),
    redirectServerOutputToRepl: configOptions.get<boolean>('redirectServerOutputToRepl'),
    fiddleFilePaths: configOptions.get<fiddleFilesUtil.FiddleFilePaths>('fiddleFilePaths'),
    outputDestinations:
      configOptions.get<output.OutputDestinationConfiguration>('outputDestinations'),
    legacyPrintBareReplWindowOutput: configOptions.get<boolean>('legacyPrintBareReplWindowOutput'),
    basilispPath: configOptions.get<string>('basilispPath'),
    refreshNssBeforeFn: configOptions.get<string>('refreshNssBeforeFn'),
    refreshNssAfterFn: configOptions.get<string>('refreshNssAfterFn'),
    customPairForms: pareditOptions
      .get<pareditConfig.PairFormConfig[]>('customPairForms', [])
      .concat(state.getProjectConfig()?.customPairForms ?? []),
    customThreadingMacros: mergeThreadingMacros(
      pareditOptions.get<Partial<pareditConfig.ThreadingMacrosConfig>>('customThreadingMacros', {}),
      state.getProjectConfig()?.customThreadingMacros ?? {}
    ),
    customCommentForms: configOptions.get<string[]>('customCommentForms', []),
    aliasMap: {
      ...(pareditOptions.get<{ [alias: string]: string }>('aliasMap') ?? {}),
      ...(state.getProjectConfig()?.aliasMap ?? {}),
    },
  };
}

export type Config = ReturnType<typeof getConfig>;

async function updateWorkspaceConfig<T extends keyof Config>(section: T, value: Config[T]) {
  return vscode.workspace.getConfiguration('calva').update(section, value);
}

export {
  updateCalvaConfigFromEdn,
  updateCalvaConfigFromUserConfigEdn,
  openCalvaConfigEdn,
  addEdnConfig,
  REPL_FILE_EXT,
  FIDDLE_FILE_EXT,
  KEYBINDINGS_ENABLED_CONFIG_KEY,
  KEYBINDINGS_ENABLED_CONTEXT_KEY,
  documentSelector,
  ReplSessionType,
  getConfig,
  updateWorkspaceConfig,
};
