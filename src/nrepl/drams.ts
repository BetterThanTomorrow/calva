import * as vscode from 'vscode';
import * as path from 'path';
import * as state from '../state';
import * as utilities from '../utilities';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import { ConnectType } from './connect-types';
import * as replMenu from './repl-menu';

const DRAM_REPO_URL = 'https://raw.githubusercontent.com/BetterThanTomorrow/dram';

type DramFile = { path: string; 'open?': boolean };

export type DramConfig = {
  name: string;
  files: DramFile[];
};

export type DramStartConfig = {
  config: DramConfig;
};

function devBuild() {
  const calva = vscode.extensions.getExtension('betterthantomorrow.calva');
  const calvaVersion = calva.packageJSON.version;
  const isDevBuild = calvaVersion.match(/-.+$/);
  const isDebug = process.env['IS_DEBUG'] === 'true';
  return { isDevBuild, isDebug };
}

async function fetchConfig(dramSrc: string): Promise<DramConfig> {
  const configEdn = await utilities.fetchFromUrl(`${dramSrc}/dram.edn`);
  const config: DramConfig = cljsLib.parseEdn(configEdn);
  return config;
}

async function downloadDramFile(storageUri: vscode.Uri, src: string, filePath: string) {
  const directoryPath = path.dirname(filePath).split(/\//);
  const dirUri = vscode.Uri.joinPath(storageUri, ...directoryPath);
  await vscode.workspace.fs.createDirectory(dirUri);
  const storeFileUri = vscode.Uri.joinPath(storageUri, path.join(...filePath.split(/\//)));
  return await utilities.downloadFromUrl(`${src}/${filePath}`, storeFileUri.fsPath).catch((err) => {
    console.error(`Error downloading ${filePath}: ${err.message}`);
  });
}

export async function downloadDramFiles(storageUri: vscode.Uri, src: string, filePaths: string[]) {
  await Promise.all(
    filePaths.map(async (filePath) => {
      await downloadDramFile(storageUri, src, filePath).then(() => {
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

const dramsBasePath = () => {
  const calva = vscode.extensions.getExtension('betterthantomorrow.calva');
  return path.join(calva.extensionPath, 'bundled', 'drams-menu');
};

const dramsPath = () => {
  const { isDevBuild, isDebug } = devBuild();
  return path.join(
    dramsBasePath(),
    `drams-${isDebug ? 'local' : isDevBuild ? 'dev' : 'published'}.edn`
  );
};

export const dramBaseUrl = () => {
  const calva = vscode.extensions.getExtension('betterthantomorrow.calva');
  const { isDevBuild, isDebug } = devBuild();
  return isDebug
    ? `file://${path.join(calva.extensionPath)}/../dram/drams/v2`
    : `${DRAM_REPO_URL}/${isDevBuild ? 'dev' : 'published'}/drams/v2`;
};

export const dramUrl = (name: string) => {
  return `${dramBaseUrl()}/${name}`;
};

type DramMenuItemConfig = {
  title: string;
  src: string;
  description?: string;
  extraDetail?: string;
};

export function refreshDramConfigs() {
  for (const slug of ['local', 'dev', 'published']) {
    utilities
      .fetchFromUrl(`${dramBaseUrl()}/calva/drams-${slug}.edn`)
      .then(async (dramConfigs) => {
        await utilities.writeTextToFile(
          vscode.Uri.file(path.join(dramsBasePath(), `drams-${slug}.edn`)),
          dramConfigs
        );
      })
      .catch((err) => {
        console.error(`Error fetching dram configs: ${err.message}`);
      });
  }
}

async function readDramMenuConfig(filePath: string): Promise<DramMenuItemConfig[]> {
  const calva = vscode.extensions.getExtension('betterthantomorrow.calva');
  const configsEdn = await utilities.getFileContents(filePath);
  const config: DramMenuItemConfig[] = cljsLib.parseEdn(configsEdn);
  return config.map((c) => ({
    ...c,
    src: c.src.replace(/^LOCAL-REPO/, `file://${path.join(calva.extensionPath)}/../dram`),
  }));
}

export async function createProjectMenuItems(): Promise<replMenu.MenuItem[]> {
  try {
    return (await readDramMenuConfig(dramsPath())).map((config) => ({
      label: config.title,
      description: config.extraDetail,
      detail: config.description,
      command: 'calva.createAndOpenProjectFromDram',
      dramSrc: config.src,
    }));
  } catch (e) {
    console.error('Error reading dram configs:', e);
    return [];
  }
}

export async function createAndOpenDram(
  context: vscode.ExtensionContext,
  title: string,
  src: string
) {
  const config = await fetchConfig(src);

  if (!config?.files) {
    console.error(`Error fetching configuration from dram repository`);
    void vscode.window.showErrorMessage(`Error fetching configuration from dram repository`);
    return;
  }

  const docNames = config.files.map((f) => f.path);

  const choice = await vscode.window.showInformationMessage(
    `${title}`,
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
  await downloadDramFiles(storageUri, src, docNames).catch((err) => {
    console.error(`Error downloading drams: ${err.message}`);
    void vscode.window.showWarningMessage(`Error downloading files: ${err.message}`);
  });

  const destUris = config.files.map((file) => putStoreDocInPlace(storageUri, projectRootUri, file));
  await Promise.all(destUris);

  await serializeDramStartConfig(projectRootUri, { config });

  const currentWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (currentWorkspaceFolder && currentWorkspaceFolder.uri.fsPath === projectRootUri.fsPath) {
    await startDram();
    return vscode.commands.executeCommand('calva.jackIn');
  } else {
    return vscode.commands.executeCommand('vscode.openFolder', projectRootUri, true);
  }
}

function ARGS_FILE_PATH(projectRootUri: vscode.Uri) {
  return vscode.Uri.joinPath(projectRootUri, '.calva', 'drams', 'start-config.json');
}

async function serializeDramStartConfig(projectRootUri, config: DramStartConfig) {
  const data = new TextEncoder().encode(JSON.stringify(config));
  return vscode.workspace.fs.writeFile(ARGS_FILE_PATH(projectRootUri), data);
}

async function deserializeDramStartConfig(projectRootUri: vscode.Uri): Promise<DramStartConfig> {
  const data = await vscode.workspace.fs.readFile(ARGS_FILE_PATH(projectRootUri));
  return JSON.parse(new TextDecoder().decode(data));
}

export async function dramStartConfigExists(): Promise<boolean> {
  const projectRootUri = state.getProjectRootUri();
  if (!projectRootUri) {
    return false;
  }
  return vscode.workspace.fs.stat(ARGS_FILE_PATH(projectRootUri)).then(
    () => true,
    () => false
  );
}

export async function maybeStartDram() {
  if (await dramStartConfigExists()) {
    console.debug('Dram start config exists');
    return startDram();
  } else {
    console.debug('No dram start config');
  }
}

export async function startDram() {
  console.debug('Starting dram..');
  const config = (await deserializeDramStartConfig(state.getProjectRootUri())).config;
  console.debug('Dram start config:', config);
  void vscode.workspace.fs.delete(ARGS_FILE_PATH(state.getProjectRootUri()));
  await state.initProjectDir(ConnectType.JackIn, null, false);
  const projectRootUri = state.getProjectRootUri();
  const [mainDoc, mainEditor] = await openStoredDoc(projectRootUri, config.files[0]);
  for (const file of config.files.slice(1)) {
    await openStoredDoc(projectRootUri, file);
  }

  if (config.files?.length > 0) {
    await openStoredDoc(projectRootUri, config.files[0]);
  }

  const firstPos = mainEditor.document.positionAt(0);
  mainEditor.selections = [new vscode.Selection(firstPos, firstPos)];
  mainEditor.revealRange(new vscode.Range(firstPos, firstPos));

  await vscode.window.showTextDocument(mainDoc, {
    preview: false,
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
  });
}
