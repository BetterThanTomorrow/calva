import status from './status';
import * as connector from './connector';
import * as state from './state';
import * as vscode from 'vscode';
import * as connectSequences from './nrepl/connectSequence';
import * as open from 'open';
import * as outputWindow from './results-output/results-doc';
import * as utilities from './utilities';

type JoyrideContext = 'joyride.isNReplServerRunning';

interface JoyrideExtensionApi {
  getContextValue: (arg0: JoyrideContext) => boolean;
  startNReplServer: (arg0?: string) => Promise<number>;
}

interface JoyrideExtension extends vscode.Extension<any> {
  exports: JoyrideExtensionApi;
}

export function getJoyrideExtension(): JoyrideExtension {
  return vscode.extensions.getExtension('betterthantomorrow.joyride');
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
  if (joyrideExtension) {
    joyrideExtension.exports
      .startNReplServer(projectDir)
      .then(async (port) => {
        utilities.setLaunchingState(null);
        await connector.connect(connectSequences.joyrideDefaults[0], true, 'localhost', `${port}`);
        outputWindow.append('; Jack-in done.');
        outputWindow.appendPrompt();
      })
      .catch((e: Error) => {
        console.error('Joyride REPL start failed: ', e);
      });
  } else {
    const OPEN_REPO_OPTION = 'Open Joyride Project page';
    const choice = await vscode.window.showInformationMessage(
      'Joyride is an extension that embeds a Clojure REPL in VS Code and lets you script the editor while you are using it.',
      ...[OPEN_REPO_OPTION]
    );
    if (choice === OPEN_REPO_OPTION) {
      void open('https://github.com/BetterThanTomorrow/joyride');
    }
  }
}
