import status from './status';
import * as connector from './connector';
import * as state from './state';
import * as vscode from 'vscode';
import * as connectSequences from './nrepl/connectSequence';
import * as outputWindow from './results-output/results-doc';
import * as utilities from './utilities';

export function getJoyrideExtension() {
  return utilities.cljsLib.getStateValue('joyrideExtension');
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

export function joyrideJackIn(joyrideExtension: vscode.Extension<any>, projectDir: string) {
  joyrideExtension.exports
    .startNReplServer(projectDir)
    .then((port) => {
      utilities.setLaunchingState(null);
      return connector
        .connect(connectSequences.joyrideDefaults[0], true, 'localhost', port)
        .then(() => {
          outputWindow.append('; Jack-in done.');
          outputWindow.appendPrompt();
        });
    })
    .catch((e: Error) => {
      console.error('Joyride REPL start failed: ', e);
    });
}
