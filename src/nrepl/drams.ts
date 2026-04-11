import * as vscode from 'vscode';
import * as path from 'path';
import * as state from '../state';
import * as utilities from '../utilities';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import { ConnectType } from './connect-types';
import * as dramManifest from './dram-manifest';
import * as dramStaging from './dram-staging';
import * as replMenu from './repl-menu';

const DRAM_REPO_URL = 'https://raw.githubusercontent.com/BetterThanTomorrow/dram';

export type DramConfig = dramManifest.DramConfig;

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
  return cljsLib.parseEdn(configEdn) as DramConfig;
}

async function stageDramPathFile(stagingUri: vscode.Uri, src: string, filePath: string) {
  const directoryPath = path.dirname(filePath).split(/\//);
  const dirUri = vscode.Uri.joinPath(stagingUri, ...directoryPath);
  await vscode.workspace.fs.createDirectory(dirUri);
  const stagedFileUri = vscode.Uri.joinPath(stagingUri, path.join(...filePath.split(/\//)));
  await utilities.downloadFromUrl(`${src}/${filePath}`, stagedFileUri.fsPath);
}

async function stageGithubArchiveFile(
  stagingUri: vscode.Uri,
  tempUri: vscode.Uri,
  archiveUrl: string
) {
  await vscode.workspace.fs.createDirectory(tempUri);
  const archiveUri = vscode.Uri.joinPath(tempUri, `${utilities.randomSlug()}.zip`);
  await utilities.downloadFromUrl(archiveUrl, archiveUri.fsPath);
  await dramStaging.stageGithubArchive(archiveUri.fsPath, stagingUri.fsPath);
}

async function openProjectDoc(
  projectRootUri: vscode.Uri,
  filePath: string
): Promise<[vscode.TextDocument, vscode.TextEditor]> {
  const destUri = vscode.Uri.file(path.join(projectRootUri.fsPath, filePath));
  const doc = await vscode.workspace.openTextDocument(destUri);
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: true,
  });
  return [doc, editor];
}

async function stageDramFiles(
  stagingUri: vscode.Uri,
  tempUri: vscode.Uri,
  src: string,
  files: dramManifest.DramFileInput[]
) {
  for (const file of files) {
    if (dramManifest.isGithubDramFile(file)) {
      await stageGithubArchiveFile(stagingUri, tempUri, file.github);
      continue;
    }

    await stageDramPathFile(stagingUri, src, file.path);
    console.log(`Downloaded ${file.path}`);
  }
}

async function copyStagedFilesToProject(stagingUri: vscode.Uri, projectRootUri: vscode.Uri) {
  const entries = await vscode.workspace.fs.readDirectory(stagingUri);

  for (const [name, fileType] of entries) {
    const sourceUri = vscode.Uri.joinPath(stagingUri, name);
    const destinationUri = vscode.Uri.joinPath(projectRootUri, name);

    if (fileType === vscode.FileType.Directory) {
      await vscode.workspace.fs.createDirectory(destinationUri);
      await copyStagedFilesToProject(sourceUri, destinationUri);
      continue;
    }

    if (fileType !== vscode.FileType.File) {
      continue;
    }

    try {
      await vscode.workspace.fs.copy(sourceUri, destinationUri, {
        overwrite: false,
      });
    } catch (e) {
      if (e instanceof vscode.FileSystemError && e.code === 'FileExists') {
        console.info(`File ${destinationUri.fsPath} already exists in project dir, skipping copy.`);
      } else {
        throw e;
      }
    }
  }
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

  const storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'drams', utilities.randomSlug());
  const tempUri = vscode.Uri.joinPath(
    context.globalStorageUri,
    'drams-tmp',
    utilities.randomSlug()
  );

  await vscode.workspace.fs.createDirectory(storageUri);
  await vscode.workspace.fs.createDirectory(tempUri);
  await vscode.workspace.fs.createDirectory(projectRootUri);
  try {
    await stageDramFiles(storageUri, tempUri, src, config.files);
    await copyStagedFilesToProject(storageUri, projectRootUri);
  } catch (err) {
    console.error(`Error staging drams: ${err.message}`);
    void vscode.window.showWarningMessage(`Error staging files: ${err.message}`);
    return;
  } finally {
    void vscode.workspace.fs
      .delete(storageUri, { recursive: true, useTrash: false })
      .then(undefined, () => undefined);
    void vscode.workspace.fs
      .delete(tempUri, { recursive: true, useTrash: false })
      .then(undefined, () => undefined);
  }

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
  const openPaths = dramManifest.resolveDramOpenPaths(config);

  if (openPaths.length === 0) {
    return;
  }

  const [mainDocPath, ...secondaryDocPaths] = openPaths;
  const [mainDoc, mainEditor] = await openProjectDoc(projectRootUri, mainDocPath);
  for (const filePath of secondaryDocPaths) {
    await openProjectDoc(projectRootUri, filePath);
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
