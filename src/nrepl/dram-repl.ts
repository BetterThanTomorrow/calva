import * as vscode from 'vscode';
import * as path from 'path';
import * as state from '../state';
import eval from '../evaluate';
import * as utilities from '../utilities';
import * as sequence from './connectSequence';
import * as jackIn from './jack-in';
import { getConfig } from '../config';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import { ReplConnectSequence } from './connectSequence';
import * as output from '../results-output/output';
import { ConnectType } from './connect-types';
import * as replStart from './repl-start';

const TEMPLATES_SUB_DIR = 'bundled';
const DRAM_BASE_URL = 'https://raw.githubusercontent.com/BetterThanTomorrow/dram';

type DramFile = { path: string; 'open?': boolean };

export type DramConfig = {
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
  connectSequence: sequence.cljDefaults[0],
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
  return `${DRAM_BASE_URL}/${calculateBranch()}/drams/v2`;
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
  projectRootUri: vscode.Uri,
  dramFile: DramFile
): Promise<[vscode.TextDocument, vscode.TextEditor] | undefined> {
  const destUri = vscode.Uri.file(path.join(projectRootUri.fsPath, dramFile.path));
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

async function putStoreDocInPlace(
  storageUri: vscode.Uri,
  projectRootUri: vscode.Uri,
  dramFile: DramFile
) {
  const sourceUri = vscode.Uri.file(path.join(storageUri.fsPath, dramFile.path));
  const destUri = vscode.Uri.file(path.join(projectRootUri.fsPath, dramFile.path));
  try {
    await vscode.workspace.fs.copy(sourceUri, destUri, {
      overwrite: false,
    });
  } catch (e) {
    if (e instanceof vscode.FileSystemError && e.code === 'FileExists') {
      console.info(`File ${dramFile.path} already exists in temp dir, skipping copy.`);
    } else {
      console.error('Unexpected error:', e);
    }
  }
  return destUri;
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

const DRAM_TEMPLATE_TO_MENU_OPTION: { [key: string]: string } = {};

DRAM_TEMPLATE_TO_MENU_OPTION[(USER_TEMPLATE.config as DramConfig).name] =
  replStart.START_REPL_OPTION;
DRAM_TEMPLATE_TO_MENU_OPTION[HELLO_TEMPLATE.config as string] = replStart.START_HELLO_REPL_OPTION;
DRAM_TEMPLATE_TO_MENU_OPTION[HELLO_CLJS_BROWSER_TEMPLATE.config as string] =
  replStart.START_HELLO_CLJS_BROWSER_COMMAND;
DRAM_TEMPLATE_TO_MENU_OPTION[HELLO_CLJS_NODE_TEMPLATE.config as string] =
  replStart.START_HELLO_CLJS_NODE_COMMAND;

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
  const { prefix, suffix } = replStart.menuSlugForProjectRoot();
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

  if (!config?.files) {
    console.error(`Error fetching configuration from dram repository`);
    void vscode.window.showErrorMessage(`Error fetching configuration from dram repository`);
    return;
  }

  const docNames = config.files.map((f) => f.path);

  const choice = await vscode.window.showInformationMessage(
    `${DRAM_TEMPLATE_TO_MENU_OPTION[dramTemplateName]}`,
    {
      modal: true,
      detail:
        'Next you will be asked to select a folder to create the project in. Creating a new project folder is recommended.',
    },
    'OK',
    'Use random temp directory'
  );

  if (choice === undefined) {
    return;
  }

  let projectRootUri: vscode.Uri;
  if (choice === 'Use random temp directory') {
    projectRootUri = await state.setOrCreateNonProjectRoot(context);
  } else {
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
    });

    if (folderUris && folderUris.length > 0) {
      projectRootUri = folderUris[0];
    }
  }

  if (!projectRootUri) {
    return;
  }

  const storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'drams');

  await vscode.workspace.fs.createDirectory(storageUri);
  await vscode.workspace.fs.createDirectory(projectRootUri);
  if (areBundled) {
    await extractBundledFiles(context, storageUri, docNames);
  } else {
    await downloadDrams(storageUri, dramTemplate.config as string, docNames).catch((err) => {
      console.error(`Error downloading drams: ${err.message}`);
      void vscode.window.showWarningMessage(`Error downloading files: ${err.message}`);
    });
  }

  const destUris = config.files.map((file) => putStoreDocInPlace(storageUri, projectRootUri, file));
  await Promise.all(destUris);

  await serializeDramReplStartConfig(projectRootUri, {
    config,
    lastMenuSlug,
    dramTemplateName,
    dramTemplate,
  });

  return vscode.commands.executeCommand('vscode.openFolder', projectRootUri, true);
}

type DramReplStartConfig = {
  config: DramConfig;
  lastMenuSlug: { prefix: string; suffix: string };
  dramTemplateName: string;
  dramTemplate: DramTemplate;
};

function ARGS_FILE_PATH(projectRootUri: vscode.Uri) {
  return vscode.Uri.joinPath(projectRootUri, '.calva', 'drams', 'repl-start-config.json');
}

async function serializeDramReplStartConfig(projectRootUri, args: DramReplStartConfig) {
  const data = new TextEncoder().encode(JSON.stringify(args));
  return vscode.workspace.fs.writeFile(ARGS_FILE_PATH(projectRootUri), data);
}

async function deserializeDramReplStartConfig(
  projectRootUri: vscode.Uri
): Promise<DramReplStartConfig> {
  const data = await vscode.workspace.fs.readFile(ARGS_FILE_PATH(projectRootUri));
  return JSON.parse(new TextDecoder().decode(data));
}

export async function dramReplStartConfigExists(): Promise<boolean> {
  const projectRootUri = state.getProjectRootUri();
  if (!projectRootUri) {
    return false;
  }
  return vscode.workspace.fs.stat(ARGS_FILE_PATH(projectRootUri)).then(
    () => true,
    () => false
  );
}

export async function maybeStartDramRepl() {
  if (await dramReplStartConfigExists()) {
    return startDramRepl();
  }
}

export async function startDramRepl() {
  const args = await deserializeDramReplStartConfig(state.getProjectRootUri());
  void vscode.workspace.fs.delete(ARGS_FILE_PATH(state.getProjectRootUri()));
  await state.initProjectDir(ConnectType.JackIn, args.dramTemplate.connectSequence, false);
  const projectRootUri = state.getProjectRootUri();
  const [mainDoc, mainEditor] = await openStoredDoc(projectRootUri, args.config.files[0]);
  for (const file of args.config.files.slice(1)) {
    await openStoredDoc(projectRootUri, file);
  }

  // We now have the proper project root for the REPL Menu “command palette”
  const newMenuSlug = replStart.menuSlugForProjectRoot();
  await state.extensionContext.workspaceState.update(
    `qps-${newMenuSlug.prefix}/${args.lastMenuSlug.suffix}`,
    replStart.JACK_IN_OPTION
  );

  const firstPos = mainEditor.document.positionAt(0);
  mainEditor.selections = [new vscode.Selection(firstPos, firstPos)];
  mainEditor.revealRange(new vscode.Range(firstPos, firstPos));
  await vscode.window.showTextDocument(mainDoc, {
    preview: false,
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
  });

  return jackIn.jackIn(args.dramTemplate.connectSequence, false, async () => {
    await vscode.window.showTextDocument(mainDoc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    await eval.loadDocument({}, getConfig().prettyPrintingOptions);
    output.replWindowAppendPrompt();
  });
}
