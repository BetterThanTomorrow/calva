import status from './status';
import semver from 'semver';
import connector from './connector';
import state from './state';
import vscode from 'vscode';
import connectSequences from './nrepl/connectSequence';
import open from 'open';
import outputWindow from './results-output/results-doc';
import utilities from './utilities';

const JOYRIDE_NREPL_START_API_VERSION = '0.0.5';

type JoyrideContext = 'joyride.isNReplServerRunning';

interface JoyrideExtensionApi {
  getContextValue: (arg0: JoyrideContext) => boolean;
  startNReplServer: (arg0?: string) => Promise<number>;
}

interface JoyrideExtension extends vscode.Extension<any> {
  exports: JoyrideExtensionApi;
}

function getJoyrideExtension(): JoyrideExtension {
  return vscode.extensions.getExtension('betterthantomorrow.joyride');
}

function isJoyrideExtensionCompliant(joyrideExt: JoyrideExtension) {
  return joyrideExt && semver.gte(joyrideExt.packageJSON.version, JOYRIDE_NREPL_START_API_VERSION);
}

export function isJoyrideExtensionActive() {
  const joyrideExt = getJoyrideExtension();
  return joyrideExt && joyrideExt.isActive;
}

export function isJoyrideNReplServerRunning() {
  const joyrideExt = getJoyrideExtension();
  if (isJoyrideExtensionActive()) {
    const joyApi = joyrideExt.exports;
    return joyApi.getContextValue('joyride.isNReplServerRunning');
  } else {
    return false;
  }
}

export async function prepareForJackingOrConnect() {
  status.updateNeedReplUi(true);
  await state.initProjectDir().catch((e) => {
    void vscode.window.showErrorMessage('Failed initializing project root directory: ', e);
  });
  await outputWindow.initResultsDoc();
  await outputWindow.openResultsDoc();
  return state.getProjectRootLocal();
}

export async function joyrideJackIn(projectDir: string) {
  const joyrideExtension = getJoyrideExtension();
  if (joyrideExtension && isJoyrideExtensionCompliant(joyrideExtension)) {
    joyrideExtension.exports
      .startNReplServer(projectDir)
      .then(async (port) => {
        utilities.setLaunchingState(null);
        await connector.connect(connectSequences.joyrideDefaults[0], true, 'localhost', `${port}`);
        outputWindow.appendLine('; Jack-in done.');
        outputWindow.appendPrompt();
      })
      .catch((e: Error) => {
        console.error('Joyride REPL start failed: ', e);
      });
  } else {
    const OPEN_OPTION = 'Open Joyride Extension page';
    const choice = await vscode.window.showInformationMessage(
      'Joyride is an extension that embeds a Clojure REPL in VS Code and lets you script the editor while you are using it. You need version 0.0.5, or later.',
      ...[OPEN_OPTION]
    );
    if (choice === OPEN_OPTION) {
      void open('https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.joyride');
    }
  }
}
