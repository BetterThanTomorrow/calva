import * as semver from 'semver';
import * as connector from './connector';
import * as state from './state';
import * as vscode from 'vscode';
import * as connectSequences from './nrepl/connectSequence';
import * as open from 'open';
import * as outputWindow from './repl-window/repl-doc';
import * as utilities from './utilities';
import { ConnectType } from './nrepl/connect-types';
import * as output from './results-output/output';
import * as inspector from './providers/inspector';

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

export async function prepareForJackInOrConnect() {
  await state.initProjectDir(ConnectType.JackIn, undefined, false).catch((e) => {
    void vscode.window.showErrorMessage('Failed initializing project root directory: ', e);
  });
  inspector.revealOnConnect();
  await outputWindow.initResultsDoc();
  await outputWindow.openResultsDoc();
  return state.getProjectRootLocal();
}

export async function joyrideJackIn(projectDir: string) {
  void state.analytics().logGA4Pageview('/connect-initiated');
  void state.analytics().logGA4Pageview('/connect-initiated/joyride-jack-in');
  const joyrideExtension = getJoyrideExtension();
  if (joyrideExtension && isJoyrideExtensionCompliant(joyrideExtension)) {
    joyrideExtension.exports
      .startNReplServer(projectDir)
      .then(async (port) => {
        utilities.setLaunchingState(null);
        await connector.connect(connectSequences.joyrideDefaults[0], true, 'localhost', `${port}`);
        output.appendLineOtherOut('Jack-in done.');
        output.replWindowAppendPrompt();
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
