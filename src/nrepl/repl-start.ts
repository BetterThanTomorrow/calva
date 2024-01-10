import * as vscode from 'vscode';
import * as path from 'path';
import * as state from '../state';
import eval from '../evaluate';
import * as utilities from '../utilities';
import * as sequence from './connectSequence';
import * as jackIn from './jack-in';
import * as outputWindow from '../results-output/results-doc';
import { getConfig } from '../config';
import * as replSession from './repl-session';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import { ReplConnectSequence } from './connectSequence';
import * as fiddleFiles from '../fiddle-files';

const TEMPLATES_SUB_DIR = 'bundled';
const DRAM_BASE_URL = 'https://raw.githubusercontent.com/BetterThanTomorrow/dram';

type DramFile = { path: string; 'open?': boolean };

type DramConfig = {
  name: string;
  files: DramFile[];
};

type DramTemplate = {
  config: DramConfig | string;
  connectSequence: ReplConnectSequence;
};

export const USER_TEMPLATE: DramTemplate = {
  config: {
    name: 'Standalone REPL',
    files: [{ path: 'user.clj', 'open?': true }],
  },
  connectSequence: sequence.genericDefaults[0],
};

export const HELLO_TEMPLATE: DramTemplate = {
  config: 'calva_getting_started',
  connectSequence: sequence.genericDefaults[0],
};

export const HELLO_CLJS_BROWSER_TEMPLATE: DramTemplate = {
  config: 'calva_cljs_browser_quick_start',
  connectSequence: sequence.cljDefaults[3],
};

export const HELLO_CLJS_NODE_TEMPLATE: DramTemplate = {
  config: 'calva_cljs_node_quick_start',
  connectSequence: sequence.cljDefaults[4],
};

const calculateBranch = () => {
  const calva = vscode.extensions.getExtension('betterthantomorrow.calva');
  const calvaVersion = calva.packageJSON.version;
  const isDebug = process.env['IS_DEBUG'] === 'true';
  return isDebug || calvaVersion.match(/-.+$/) ? 'dev' : 'published';
};

const dramsBaseUrl = () => {
  return `${DRAM_BASE_URL}/${calculateBranch()}/drams`;
};

async function fetchConfig(configName: string): Promise<DramConfig> {
  const configEdn = await utilities.fetchFromUrl(`${dramsBaseUrl()}/${configName}/dram.edn`);
  const config: DramConfig = cljsLib.parseEdn(configEdn);
  return config;
}

async function downloadDram(storageUri: vscode.Uri, configPath: string, filePath: string) {
  const downloadUrl = `${dramsBaseUrl()}/${configPath}/${filePath}`;
  const directoryPath = path.dirname(filePath).split(/\//);
  const dirUri = vscode.Uri.joinPath(storageUri, ...directoryPath);
  await vscode.workspace.fs.createDirectory(dirUri);
  const storeFileUri = vscode.Uri.joinPath(storageUri, path.join(...filePath.split(/\//)));
  return await utilities.downloadFromUrl(downloadUrl, storeFileUri.fsPath).catch((err) => {
    console.error(`Error downloading ${filePath}: ${err.message}`);
  });
}

export async function downloadDrams(
  storageUri: vscode.Uri,
  configPath: string,
  filePaths: string[]
) {
  await Promise.all(
    filePaths.map(async (filePath) => {
      await downloadDram(storageUri, configPath, filePath).then(() => {
        console.log(`Downloaded ${filePath}`);
      });
    })
  );
}

async function openStoredDoc(
  storageUri: vscode.Uri,
  tempDirUri: vscode.Uri,
  dramFile: DramFile
): Promise<[vscode.TextDocument, vscode.TextEditor] | undefined> {
  const sourceUri = vscode.Uri.file(path.join(storageUri.fsPath, dramFile.path));
  const destUri = vscode.Uri.file(path.join(tempDirUri.fsPath, dramFile.path));
  try {
    await vscode.workspace.fs.copy(sourceUri, destUri, {
      overwrite: false,
    });
  } catch (e) {
    if (e instanceof vscode.FileSystemError && e.code === 'FileExists') {
      console.info(`File ${dramFile.path} already exists in temp dir, skipping copy.`);
    } else {
      console.log('Unexpected error:', e);
    }
  }
  if (dramFile['open?']) {
    const doc = await vscode.workspace.openTextDocument(destUri);
    const editor = await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: true,
    });
    return [doc, editor];
  }
}

async function extractBundledFiles(
  context: vscode.ExtensionContext,
  storageUri: vscode.Uri,
  docNames: string[]
) {
  await Promise.all(
    docNames.map(async (docName) => {
      const docUri: vscode.Uri = vscode.Uri.file(path.join(storageUri.fsPath, docName));
      const templateUri = vscode.Uri.file(
        path.join(context.extensionPath, TEMPLATES_SUB_DIR, docName)
      );
      try {
        await vscode.workspace.fs.copy(templateUri, docUri, {
          overwrite: true,
        });
      } catch {
        // continue regardless of error
      }
    })
  );
}

// Connected menu items
const RE_JACK_IN_OPTION = 'Restart the Project REPL (a.k.a. Re-jack-in)';
const RE_JACK_IN_COMMAND = 'calva.jackIn';
const JACK_OUT_OPTION = 'Stop/Kill the Project REPL started by Calva (a.k.a. Jack-out)';
const JACK_OUT_COMMAND = 'calva.jackOut';
const INTERRUPT_OPTION = 'Interrupt running Evaluations';
const INTERRUPT_COMMAND = 'calva.interruptAllEvaluations';
const DISCONNECT_OPTION = 'Disconnect from the REPL';
const DISCONNECT_COMMAND = 'calva.disconnect';
const OPEN_WINDOW_OPTION = 'Open the Output Window';
const OPEN_WINDOW_COMMAND = 'calva.showOutputWindow';
const OPEN_FIDDLE_OPTION = 'Open Fiddle for Current File';
const OPEN_FIDDLE_COMMAND = 'calva.openFiddleForSourceFile';
const EVALUATE_FIDDLE_OPTION = 'Evaluate Fiddle for Current File';
const EVALUATE_FIDDLE_COMMAND = 'calva.evaluateFiddleForSourceFile';
const OPEN_SOURCE_FOR_FIDDLE_OPTION = 'Open Source File for Current Fiddle';
const OPEN_SOURCE_FOR_FIDDLE_COMMAND = 'calva.openSourceFileForFiddle';

// Disconnected menu items
const JACK_IN_OPTION = 'Start your project with a REPL and connect (a.k.a. Jack-in)';
const JACK_IN_COMMAND = 'calva.jackIn';
const START_REPL_OPTION = 'Start a standalone REPL';
const START_REPL_COMMAND = 'calva.startStandaloneRepl';
const START_JOYRIDE_REPL_OPTION = 'Start a Joyride REPL and Connect';
const START_JOYRIDE_REPL_COMMAND = 'calva.startJoyrideReplAndConnect';
const START_HELLO_REPL_OPTION = 'Fire up the ”Getting Started” REPL';
const START_HELLO_REPL_COMMAND = 'calva.startStandaloneHelloRepl';
const START_HELLO_CLJS_BROWSER_OPTION = 'Fire up the ”ClojureScript Quick Start” Browser REPL';
const START_HELLO_CLJS_BROWSER_COMMAND = 'calva.startStandaloneCljsBrowserRepl';
const START_HELLO_CLJS_NODE_OPTION = 'Fire up the ”ClojureScript Quick Start” Node REPL';
const START_HELLO_CLJS_NODE_COMMAND = 'calva.startStandaloneCljsNodeRepl';
const CONNECT_PROJECT_OPTION = 'Connect to a running REPL in your project';
const CONNECT_PROJECT_COMMAND = 'calva.connect';
const CONNECT_STANDALONE_OPTION = 'Connect to a running REPL, not in your project';
const CONNECT_STANDALONE_COMMAND = 'calva.connectNonProjectREPL';

const DRAM_TEMPLATE_TO_MENU_OPTION: { [key: string]: string } = {};

DRAM_TEMPLATE_TO_MENU_OPTION[(USER_TEMPLATE.config as DramConfig).name] = START_REPL_OPTION;
DRAM_TEMPLATE_TO_MENU_OPTION[HELLO_TEMPLATE.config as string] = START_HELLO_REPL_OPTION;
DRAM_TEMPLATE_TO_MENU_OPTION[HELLO_CLJS_BROWSER_TEMPLATE.config as string] =
  START_HELLO_CLJS_BROWSER_COMMAND;
DRAM_TEMPLATE_TO_MENU_OPTION[HELLO_CLJS_NODE_TEMPLATE.config as string] =
  START_HELLO_CLJS_NODE_COMMAND;

function menuSlugForProjectRoot(): MenuSlug {
  const prefix = state.getProjectRootUri() ? state.getProjectRootUri().toString() : 'no-folder';
  const suffix = shouldShowConnectedMenu()
    ? 'connect-repl-menu-connected'
    : 'connect-repl-menu-not-connected';
  return { prefix, suffix };
}

export async function startStandaloneRepl(
  context: vscode.ExtensionContext,
  dramTemplate: DramTemplate,
  areBundled: boolean
) {
  // This is so that we can update the REPL Menu “command palette”
  // with the default reconnect option, based on dram template used
  // See end of this function for the other place where we update this,
  // That's because the dram content is opened in a temp dir, making
  // the project root different for the dram files than for the main
  // window.
  // TODO: The code can probably express it better than it currently does.
  const { prefix, suffix } = menuSlugForProjectRoot();
  const lastMenuSlug = { prefix, suffix };
  const dramTemplateName =
    typeof dramTemplate.config === 'string' ? dramTemplate.config : dramTemplate.config.name;
  await state.extensionContext.workspaceState.update(
    `qps-${prefix}/${suffix}`,
    DRAM_TEMPLATE_TO_MENU_OPTION[dramTemplateName]
  );

  const config =
    typeof dramTemplate.config === 'string'
      ? await fetchConfig(dramTemplate.config)
      : dramTemplate.config;
  const docNames = config.files.map((f) => f.path);
  const tempDirUri = await state.setOrCreateNonProjectRoot(context);

  const storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'drams');

  await vscode.workspace.fs.createDirectory(storageUri);
  await vscode.workspace.fs.createDirectory(tempDirUri);
  if (areBundled) {
    await extractBundledFiles(context, storageUri, docNames);
  } else {
    await downloadDrams(storageUri, dramTemplate.config as string, docNames).catch((err) => {
      console.error(`Error downloading drams: ${err.message}`);
      void vscode.window.showWarningMessage(`Error downloading files: ${err.message}`);
    });
  }

  const [mainDoc, mainEditor] = await openStoredDoc(storageUri, tempDirUri, config.files[0]);
  for (const file of config.files.slice(1)) {
    await openStoredDoc(storageUri, tempDirUri, file);
  }

  // We now have the proper project root for the REPL Menu “command palette”
  const newMenuSlug = menuSlugForProjectRoot();
  await state.extensionContext.workspaceState.update(
    `qps-${newMenuSlug.prefix}/${lastMenuSlug.suffix}`,
    DRAM_TEMPLATE_TO_MENU_OPTION[dramTemplateName]
  );

  const firstPos = mainEditor.document.positionAt(0);
  mainEditor.selection = new vscode.Selection(firstPos, firstPos);
  mainEditor.revealRange(new vscode.Range(firstPos, firstPos));
  await vscode.window.showTextDocument(mainDoc, {
    preview: false,
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
  });

  return jackIn.jackIn(dramTemplate.connectSequence, false, async () => {
    await vscode.window.showTextDocument(mainDoc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    await eval.loadDocument({}, getConfig().prettyPrintingOptions);
    outputWindow.appendPrompt();
  });
}

function composeConnectedMenu() {
  const PREFERRED_ORDER = [
    INTERRUPT_OPTION,
    OPEN_WINDOW_OPTION,
    RE_JACK_IN_OPTION,
    DISCONNECT_OPTION,
    JACK_OUT_OPTION,
    OPEN_FIDDLE_OPTION,
    EVALUATE_FIDDLE_OPTION,
    OPEN_SOURCE_FOR_FIDDLE_OPTION,
  ];

  const commands = {};
  if (fiddleFiles.activeEditorIsFiddle) {
    commands[OPEN_SOURCE_FOR_FIDDLE_OPTION] = OPEN_SOURCE_FOR_FIDDLE_COMMAND;
  } else {
    commands[OPEN_FIDDLE_OPTION] = OPEN_FIDDLE_COMMAND;
  }
  commands[INTERRUPT_OPTION] = INTERRUPT_COMMAND;
  commands[DISCONNECT_OPTION] = DISCONNECT_COMMAND;
  if (replSession.getSession('clj')) {
    commands[OPEN_WINDOW_OPTION] = OPEN_WINDOW_COMMAND;
  }
  if (utilities.getJackedInState()) {
    commands[RE_JACK_IN_OPTION] = RE_JACK_IN_COMMAND;
    commands[JACK_OUT_OPTION] = JACK_OUT_COMMAND;
  }
  if (!fiddleFiles.activeEditorIsFiddle) {
    commands[EVALUATE_FIDDLE_OPTION] = EVALUATE_FIDDLE_COMMAND;
  }
  return { commands, PREFERRED_ORDER };
}

function composeDisconnectedMenu() {
  const PREFERRED_ORDER = [
    JACK_IN_OPTION,
    CONNECT_PROJECT_OPTION,
    START_REPL_OPTION,
    START_JOYRIDE_REPL_OPTION,
    CONNECT_STANDALONE_OPTION,
    START_HELLO_REPL_OPTION,
    START_HELLO_CLJS_BROWSER_OPTION,
    START_HELLO_CLJS_NODE_OPTION,
  ];

  const commands = {};
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    if (vscode.workspace.workspaceFolders[0].uri.scheme != 'vsls') {
      commands[JACK_IN_OPTION] = JACK_IN_COMMAND;
      commands[CONNECT_STANDALONE_OPTION] = CONNECT_STANDALONE_COMMAND;
    }
    commands[CONNECT_PROJECT_OPTION] = CONNECT_PROJECT_COMMAND;
  } else {
    commands[CONNECT_STANDALONE_OPTION] = CONNECT_STANDALONE_COMMAND;
    commands[START_REPL_OPTION] = START_REPL_COMMAND;
  }
  commands[START_JOYRIDE_REPL_OPTION] = START_JOYRIDE_REPL_COMMAND;
  commands[START_HELLO_REPL_OPTION] = START_HELLO_REPL_COMMAND;
  commands[START_HELLO_CLJS_BROWSER_OPTION] = START_HELLO_CLJS_BROWSER_COMMAND;
  commands[START_HELLO_CLJS_NODE_OPTION] = START_HELLO_CLJS_NODE_COMMAND;
  return { commands, PREFERRED_ORDER };
}

type MenuSlug = { prefix: string; suffix: string };

function shouldShowConnectedMenu() {
  return (
    utilities.getConnectedState() || utilities.getConnectingState() || utilities.getLaunchingState()
  );
}

export async function startOrConnectRepl() {
  const { commands, PREFERRED_ORDER } = shouldShowConnectedMenu()
    ? composeConnectedMenu()
    : composeDisconnectedMenu();

  const { prefix, suffix } = menuSlugForProjectRoot();
  const sortedCommands = utilities.sortByPresetOrder(Object.keys(commands), PREFERRED_ORDER);
  const command_key = await utilities.quickPickSingle({
    values: sortedCommands.map((a) => ({ label: a })),
    saveAs: `${prefix}/${suffix}`,
    placeHolder: 'Start or Connect a REPL',
  });
  if (command_key) {
    await vscode.commands.executeCommand(commands[command_key]);
  }
}
