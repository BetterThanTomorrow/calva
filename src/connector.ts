import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
import * as open from 'open';
import status from './status';
import * as projectTypes from './nrepl/project-types';
import { NReplClient, NReplSession } from './nrepl';
import {
  CljsTypeConfig,
  ReplConnectSequence,
  getDefaultCljsType,
  askForConnectSequence,
} from './nrepl/connectSequence';
import { disabledPrettyPrinter } from './printer';
import { keywordize } from './util/string';
import { initializeDebugger } from './debugger/calva-debug';
import * as outputWindow from './results-output/results-doc';
import { evaluateInOutputWindow } from './evaluate';
import * as liveShareSupport from './live-share';
import * as calvaDebug from './debugger/calva-debug';
import { setStateValue, getStateValue } from '../out/cljs-lib/cljs-lib';
import * as replSession from './nrepl/repl-session';
import * as clojureDocs from './clojuredocs';
import * as jszip from 'jszip';
import { addEdnConfig } from './config';
import { getJarContents } from './utilities';

async function readJarContent(uri: string) {
  try {
    const rawData = await vscode.workspace.fs.readFile(vscode.Uri.parse(uri));
    const zipData = await jszip.loadAsync(rawData);

    const conf = await zipData.file('calva.exports/config.edn')?.async('string');
    return [uri, conf];
  } catch (error) {
    return [uri, null];
  }
}

async function readRuntimeConfigs() {
  util.assertIsDefined(nClient, 'Expected there to be an nREPL client!');
  const classpath = await nClient.session.classpath().catch((e) => {
    console.error('readRuntimeConfigs:', e);
  });
  if (classpath) {
    const configs = classpath.classpath.map(async (element: string) => {
      if (element.endsWith('.jar')) {
        const edn = await getJarContents(element.concat('!/calva.exports/config.edn'));
        return [element, edn];
      }

      return [element, null];
    });
    const files = await Promise.all(configs);

    // maybe we don't need to keep uri -> edn association, but it would make showing errors easier later
    return files
      .filter(([_, config]) => util.isNonEmptyString(config))
      .map(([_, config]) => addEdnConfig(config));
  }
}

async function connectToHost(hostname: string, port: number, connectSequence: ReplConnectSequence) {
  state.analytics().logEvent('REPL', 'Connecting').send();

  if (nClient) {
    nClient['silent'] = true;
    nClient.close();
  }

  let cljSession: NReplSession;

  util.setConnectingState(true);
  status.update();
  try {
    outputWindow.append('; Hooking up nREPL sessions...');
    // Create an nREPL client. waiting for the connection to be established.
    nClient = await NReplClient.create({
      host: hostname,
      port: +port,
      onError: (e) => {
        const scheme = state.getProjectRootUri().scheme;
        if (scheme === 'vsls') {
          outputWindow.append('; nREPL connection failed; did the host share the nREPL port?');
        }
      },
    });
    nClient.addOnCloseHandler((c) => {
      util.setConnectedState(false);
      util.setConnectingState(false);
      if (!c['silent']) {
        // we didn't deliberately close this session, mention this fact.
        outputWindow.append('; nREPL Connection was closed');
      }
      status.update();
      calvaDebug.terminateDebugSession();
    });
    cljSession = nClient.session;
    cljSession.replType = 'clj';
    util.setConnectingState(false);
    util.setConnectedState(true);
    state.analytics().logEvent('REPL', 'ConnectedCLJ').send();
    setStateValue('clj', cljSession);
    setStateValue('cljc', cljSession);
    status.update();
    outputWindow.append(`; Connected session: clj\n${outputWindow.CLJ_CONNECT_GREETINGS}`);
    replSession.updateReplSessionType();

    initializeDebugger(cljSession);

    outputWindow.setSession(cljSession, nClient.ns);

    if (connectSequence.afterCLJReplJackInCode) {
      outputWindow.append(`\n; Evaluating 'afterCLJReplJackInCode'`);
      const ns = outputWindow.getNs();
      util.assertIsDefined(ns, 'Expected outputWindow to have a namespace!');
      await evaluateInOutputWindow(connectSequence.afterCLJReplJackInCode, 'clj', ns, {});
    }

    outputWindow.appendPrompt();

    clojureDocs.init(cljSession);

    let cljsSession = null,
      cljsBuild = null;
    try {
      if (connectSequence.cljsType && connectSequence.cljsType != 'none') {
        const isBuiltinType: boolean = typeof connectSequence.cljsType == 'string';
        const cljsType: CljsTypeConfig = isBuiltinType
          ? getDefaultCljsType(connectSequence.cljsType as string)
          : (connectSequence.cljsType as CljsTypeConfig);
        translatedReplType = createCLJSReplType(
          cljsType,
          projectTypes.getCljsTypeName(connectSequence),
          connectSequence
        );

        [cljsSession, cljsBuild] = await makeCljsSessionClone(
          cljSession,
          translatedReplType,
          connectSequence.name
        );
        state
          .analytics()
          .logEvent(
            'REPL',
            'ConnectCljsRepl',
            isBuiltinType ? (connectSequence.cljsType as string) : 'Custom'
          )
          .send();
      }
      if (cljsSession) {
        setUpCljsRepl(cljsSession, cljsBuild);
      }
    } catch (e) {
      outputWindow.append('; Error while connecting cljs REPL: ' + e);
    }
    status.update();
  } catch (e) {
    util.setConnectingState(false);
    util.setConnectedState(false);
    outputWindow.append('; Failed connecting.');
    state.analytics().logEvent('REPL', 'FailedConnectingCLJ').send();
    console.error('Failed connecting:', e);
    return false;
  }

  void liveShareSupport.didConnectRepl(port);

  await readRuntimeConfigs();

  return true;
}

function setUpCljsRepl(session, build) {
  setStateValue('cljs', session);
  status.update();
  outputWindow.append(
    `; Connected session: cljs${build ? ', repl: ' + build : ''}\n${
      outputWindow.CLJS_CONNECT_GREETINGS
    }`
  );
  outputWindow.setSession(session, 'cljs.user');
  replSession.updateReplSessionType();
}

async function getFigwheelMainBuilds() {
  const projectRootUri = state.getProjectRootUri();
  const res = await vscode.workspace.fs.readDirectory(projectRootUri);
  const builds = res
    .filter(([name, type]) => type !== vscode.FileType.Directory && name.match(/\.cljs\.edn/))
    .map(([name, _]) => name.replace(/\.cljs\.edn$/, ''));
  if (builds.length == 0) {
    void vscode.window.showErrorMessage(
      'There are no figwheel build files (.cljs.edn) in the project directory.'
    );
    outputWindow.append(
      '; There are no figwheel build files (.cljs.edn) in the project directory.'
    );
    outputWindow.append('; Connection to Figwheel Main aborted.');
    throw 'Aborted';
  }
  return builds;
}

/**
 * ! DO it later
 */
function getFigwheelBuilds() {
  // do nothing
}

type checkConnectedFn = (value: string, out: any[], err: any[]) => boolean;
type processOutputFn = (output: string) => void;
type connectFn = (
  session: NReplSession,
  name: string,
  checkSuccess: checkConnectedFn
) => Promise<boolean | undefined>;

async function evalConnectCode(
  newCljsSession: NReplSession,
  code: string,
  name: string,
  checkSuccess: checkConnectedFn,
  outputProcessors: processOutputFn[] = [],
  errorProcessors: processOutputFn[] = []
): Promise<boolean> {
  const chan = state.connectionLogChannel();
  const err: string[] = [],
    out: string[] = [],
    result = newCljsSession.eval(code, 'user', {
      stdout: (x) => {
        out.push(util.stripAnsi(x));
        chan.append(util.stripAnsi(x));
        for (const p of outputProcessors) {
          p(util.stripAnsi(x));
        }
      },
      stderr: (x) => {
        err.push(util.stripAnsi(x));
        chan.append(util.stripAnsi(x));
        for (const p of errorProcessors) {
          p(util.stripAnsi(x));
        }
      },
      pprintOptions: disabledPrettyPrinter,
    });
  const valueResult = await result.value.catch((reason) => {
    console.error('Error evaluating connect form: ', reason);
  });
  if (checkSuccess(valueResult, out, err)) {
    state.analytics().logEvent('REPL', 'ConnectedCLJS', name).send();
    setStateValue('cljs', (cljsSession = newCljsSession));
    return true;
  } else {
    return false;
  }
}

export interface ReplType {
  name: string;
  start?: connectFn;
  started?: (valueResult: string, out: string[], err: string[]) => boolean;
  connect?: connectFn;
  connected: (valueResult: string, out: string[], err: string[]) => boolean;
}

let translatedReplType: ReplType;

async function figwheelOrShadowBuilds(cljsTypeName: string): Promise<string[] | undefined> {
  if (cljsTypeName.includes('Figwheel Main')) {
    return await getFigwheelMainBuilds();
  } else if (cljsTypeName.includes('shadow-cljs')) {
    return await projectTypes.shadowBuilds();
  }
}

function updateInitCode(build: string, initCode): string | undefined {
  if (build && typeof initCode === 'object') {
    if (['node-repl', 'browser-repl'].includes(build)) {
      return initCode.repl.replace('%REPL%', build);
    } else {
      return initCode.build.replace('%BUILD%', keywordize(build));
    }
  } else if (build && typeof initCode === 'string') {
    return initCode.replace('%BUILD%', `"${build}"`);
  }
  return undefined;
}

function createCLJSReplType(
  cljsType: CljsTypeConfig,
  cljsTypeName: string,
  connectSequence: ReplConnectSequence
): ReplType {
  const projectTypeName: string = connectSequence.name,
    menuSelections = connectSequence.menuSelections;
  let appURL: string,
    haveShownStartMessage = false,
    haveShownAppURL = false,
    haveShownStartSuffix = false,
    hasStarted = cljsType.isStarted,
    useDefaultBuild = true,
    startedBuilds: string[];
  // The output processors are used to keep the user informed about the connection process
  // The output from Figwheel is meant for printing to the REPL prompt,
  // and since we print to Calva says we, only print some of the messages.
  const printThisPrinter: processOutputFn = (x) => {
      if (cljsType.printThisLineRegExp) {
        if (x.search(cljsType.printThisLineRegExp) >= 0) {
          outputWindow.append('; ' + x.replace(/\s*$/, ''));
        }
      }
    },
    // Having and app to connect to is crucial so we do what we can to help the user
    // start the app at the right time in the process.
    startAppNowProcessor: processOutputFn = (x) => {
      // Extract the appURL if we have the regexp for it configured.
      if (cljsType.openUrlRegExp) {
        const matched = util.stripAnsi(x).match(cljsType.openUrlRegExp);
        if (matched && matched['groups'] && matched['groups'].url != undefined) {
          if (matched['groups'].url != appURL) {
            appURL = matched['groups'].url;
            haveShownAppURL = false;
          }
        }
      }
      // When the app is ready to start, say so.
      if (!haveShownStartMessage && cljsType.isReadyToStartRegExp) {
        if (x.search(cljsType.isReadyToStartRegExp) >= 0) {
          outputWindow.append(
            '; CLJS REPL ready to connect. Please, start your ClojureScript app.'
          );
          haveShownStartMessage = true;
        }
      }
      // If we have an appURL to go with the ”start now” message, say so
      if (appURL && haveShownStartMessage && !haveShownAppURL) {
        if (cljsType.shouldOpenUrl) {
          outputWindow.append(`; Opening ClojureScript app in the browser at: ${appURL} ...`);
          open(appURL).catch((reason) => {
            outputWindow.append('; Error opening ClojureScript app in the browser: ' + reason);
          });
        } else {
          outputWindow.append(';   Open the app on this URL: ' + appURL);
        }
        haveShownAppURL = true;
      }
      // Wait for any appURL to be printed before we round of the ”start now” message.
      // (If we do not have the regexp for extracting the appURL, do not wait for appURL.)
      if (
        !haveShownStartSuffix &&
        (haveShownAppURL || (haveShownStartMessage && !cljsType.openUrlRegExp))
      ) {
        outputWindow.append(';   The CLJS REPL will connect when your app is running.');
        haveShownStartSuffix = true;
      }
    },
    // This processor prints everything. We use it for stderr below.
    allPrinter: processOutputFn = (x) => {
      outputWindow.append('; ' + util.stripAnsi(x).replace(/\s*$/, ''));
    };

  const replType: ReplType = {
    name: cljsTypeName,
    connect: async (session, name, checkFn) => {
      void state.extensionContext.workspaceState.update(
        'cljsReplTypeHasBuilds',
        cljsType.buildsRequired
      );
      let initCode: typeof cljsType.connectCode | undefined = cljsType.connectCode,
        build: string | null = null;
      if (menuSelections && menuSelections.cljsDefaultBuild && useDefaultBuild) {
        build = menuSelections.cljsDefaultBuild;
        useDefaultBuild = false;
      } else {
        if (typeof initCode === 'object' || initCode.includes('%BUILD%')) {
          const projectRootUri = state.getProjectRootUri();

          const buildsForSelection = startedBuilds
            ? startedBuilds
            : await figwheelOrShadowBuilds(cljsTypeName);
          util.assertIsDefined(
            buildsForSelection,
            'Expected there to be figwheel or shadowcljs builds!'
          );

          build = await util.quickPickSingle({
            values: buildsForSelection,
            placeHolder: 'Select which build to connect to',
            saveAs: `${projectRootUri.toString()}/${cljsTypeName.replace(' ', '-')}-build`,
            autoSelect: true,
          });
        }
      }

      if (typeof build == 'string' && build != '') {
        initCode = updateInitCode(build, initCode);
        if (!initCode) {
          //TODO error message
          return;
        }
      }

      if (!(typeof initCode == 'string')) {
        //TODO error message
        return;
      }

      setStateValue('cljsBuild', build);

      return evalConnectCode(
        session,
        initCode,
        name,
        checkFn,
        [startAppNowProcessor, printThisPrinter],
        [allPrinter]
      );
    },
    connected: (result, out, err) => {
      const { isConnectedRegExp } = cljsType;

      if (isConnectedRegExp) {
        return [...out, result].find((x) => x.search(isConnectedRegExp) >= 0) !== undefined;
      } else {
        return true;
      }
    },
  };

  if (cljsType.startCode) {
    replType.start = async (session, name, checkFn) => {
      let startCode = cljsType.startCode;
      if (!hasStarted) {
        if (startCode && startCode.includes('%BUILDS')) {
          let builds: string[];
          if (menuSelections && menuSelections.cljsLaunchBuilds) {
            builds = menuSelections.cljsLaunchBuilds;
          } else {
            const allBuilds = await figwheelOrShadowBuilds(cljsTypeName);
            util.assertIsDefined(allBuilds, 'Expected there to be figwheel or shadowcljs builds!');
            const projectRootUri = state.getProjectRootUri();

            builds =
              allBuilds.length <= 1
                ? allBuilds
                : await util.quickPickMulti({
                    values: allBuilds,
                    placeHolder: 'Please select which builds to start',
                    saveAs: `${projectRootUri.toString()}/${cljsTypeName.replace(' ', '-')}-builds`,
                  });
          }
          if (builds) {
            outputWindow.append('; Starting cljs repl for: ' + projectTypeName + '...');
            void state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
            startCode = startCode.replace(
              '%BUILDS%',
              builds
                .map((x) => {
                  return `"${x}"`;
                })
                .join(' ')
            );
            const result = evalConnectCode(
              session,
              startCode,
              name,
              checkFn,
              [startAppNowProcessor, printThisPrinter],
              [allPrinter]
            );
            if (await result) {
              startedBuilds = builds;
            }
            return result;
          } else {
            outputWindow.append('; Aborted starting cljs repl.');
            throw 'Aborted';
          }
        } else if (startCode) {
          outputWindow.append('; Starting cljs repl for: ' + projectTypeName + '...');
          return evalConnectCode(
            session,
            startCode,
            name,
            checkFn,
            [startAppNowProcessor, printThisPrinter],
            [allPrinter]
          );
        }
      } else {
        return true;
      }
    };
  }

  replType.started = (result, out, err) => {
    const { isReadyToStartRegExp } = cljsType;

    if (isReadyToStartRegExp && !hasStarted) {
      const started =
        [...out, ...err].find((x) => x.search(isReadyToStartRegExp) >= 0) !== undefined;
      if (started) {
        hasStarted = true;
      }
      return started;
    } else {
      hasStarted = true;
      return true;
    }
  };

  return replType;
}

async function makeCljsSessionClone(session, repl: ReplType, projectTypeName: string | undefined) {
  outputWindow.append('; Creating cljs repl session...');
  let newCljsSession = await session.clone();
  newCljsSession.replType = 'cljs';
  if (newCljsSession) {
    outputWindow.append('; Connecting cljs repl: ' + projectTypeName + '...');
    outputWindow.append(
      ';   The Calva Connection Log might have more connection progress information.'
    );
    if (repl.start !== undefined) {
      util.assertIsDefined(repl.started, "Expected repl to have a 'started' check function!");
      if (await repl.start(newCljsSession, repl.name, repl.started)) {
        state.analytics().logEvent('REPL', 'StartedCLJS', repl.name).send();
        outputWindow.append('; Cljs builds started');
        newCljsSession = await session.clone();
        newCljsSession.replType = 'cljs';
      } else {
        state.analytics().logEvent('REPL', 'FailedStartingCLJS', repl.name).send();
        outputWindow.append('; Failed starting cljs repl');
        setStateValue('cljsBuild', null);
        return [null, null];
      }
    }

    util.assertIsDefined(repl.connect, 'Expected repl to have a connect function!');

    if (await repl.connect(newCljsSession, repl.name, repl.connected)) {
      state.analytics().logEvent('REPL', 'ConnectedCLJS', repl.name).send();
      setStateValue('cljs', (cljsSession = newCljsSession));
      return [cljsSession, getStateValue('cljsBuild')];
    } else {
      const build = getStateValue('cljsBuild');
      state.analytics().logEvent('REPL', 'FailedConnectingCLJS', repl.name).send();
      const failed =
        'Failed starting cljs repl' +
        (build != null
          ? ` for build: ${build}. Is the build running and connected?\n   See the Output channel "Calva Connection Log" for any hints on what went wrong.`
          : '');
      outputWindow.append(`; ${failed}`);
      setStateValue('cljsBuild', null);
      void vscode.window
        .showInformationMessage(failed, { modal: true }, ...['Ok'])
        .then((value) => {
          if (value == 'Ok') {
            const outputChannel = state.connectionLogChannel();
            outputChannel.show();
          }
        });
    }
  }
  return [null, null];
}

async function promptForNreplUrlAndConnect(port, connectSequence: ReplConnectSequence) {
  const url = await vscode.window.showInputBox({
    placeHolder: 'Enter existing nREPL hostname:port here...',
    prompt: "Add port to nREPL if localhost, otherwise 'hostname:port'",
    value: 'localhost:' + (port ? port : ''),
    ignoreFocusOut: true,
  });
  // state.reset(); TODO see if this should be done
  if (url !== undefined) {
    const [hostname, port] = url.split(':'),
      parsedPort = parseFloat(port);
    if (parsedPort && parsedPort > 0 && parsedPort < 65536) {
      setStateValue('hostname', hostname);
      setStateValue('port', parsedPort);
      await connectToHost(hostname, parsedPort, connectSequence);
    } else {
      outputWindow.append('; Bad url: ' + url);
      util.setConnectingState(false);
      status.update();
    }
  } else {
    util.setConnectingState(false);
    status.update();
  }
  return true;
}

export let nClient: NReplClient | undefined;
export let cljSession: NReplSession;
export let cljsSession: NReplSession;

export async function connect(
  connectSequence: ReplConnectSequence,
  isAutoConnect: boolean,
  hostname?: string,
  port?: string
) {
  const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);

  state.analytics().logEvent('REPL', 'ConnectInitiated', isAutoConnect ? 'auto' : 'manual');
  state.analytics().logEvent('REPL', 'ConnectInitiated', cljsTypeName).send();

  const portFile = projectTypes.nreplPortFileUri(connectSequence);

  void state.extensionContext.workspaceState.update('selectedCljsTypeName', cljsTypeName);
  void state.extensionContext.workspaceState.update('selectedConnectSequence', connectSequence);

  try {
    if (port === undefined) {
      try {
        await vscode.workspace.fs.stat(portFile);
        const bytes = await vscode.workspace.fs.readFile(portFile);
        port = new TextDecoder('utf-8').decode(bytes);
      } catch {
        console.info('No nrepl port found');
      }
    }
    if (port) {
      hostname = hostname !== undefined ? hostname : 'localhost';
      if (isAutoConnect) {
        setStateValue('hostname', hostname);
        setStateValue('port', port);
        await connectToHost(hostname, parseInt(port), connectSequence);
      } else {
        await promptForNreplUrlAndConnect(port, connectSequence);
      }
    } else {
      outputWindow.append('; No nrepl port file found.');
      await promptForNreplUrlAndConnect(port, connectSequence);
    }
  } catch (e) {
    console.error(e);
  }
  return true;
}

async function standaloneConnect(connectSequence: ReplConnectSequence | undefined) {
  await outputWindow.initResultsDoc();
  await outputWindow.openResultsDoc();

  if (connectSequence) {
    const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);
    outputWindow.append(`; Connecting ...`);
    state
      .analytics()
      .logEvent('REPL', 'StandaloneConnect', `${connectSequence.name} + ${cljsTypeName}`)
      .send();
    await connect(connectSequence, false).catch(() => {
      // do nothing
    });
  } else {
    outputWindow.append('; Aborting connect, error determining connect sequence.');
  }
}

export default {
  connectNonProjectREPLCommand: async (context: vscode.ExtensionContext) => {
    status.updateNeedReplUi(true);
    await state.setOrCreateNonProjectRoot(context, true);
    const connectSequence = await askForConnectSequence(
      projectTypes.getAllProjectTypes(),
      'connect-type',
      'ConnectInterrupted'
    );
    void standaloneConnect(connectSequence);
  },
  connectCommand: async (_context: vscode.ExtensionContext) => {
    status.updateNeedReplUi(true);
    await state.initProjectDir().catch((e) => {
      void vscode.window.showErrorMessage('Failed initializing project root directory: ', e);
    });
    await liveShareSupport.setupLiveShareListener().catch((e) => {
      console.error('Error initializing LiveShare support: ', e);
    });
    const cljTypes = await projectTypes.detectProjectTypes(),
      connectSequence = await askForConnectSequence(cljTypes, 'connect-type', 'ConnectInterrupted');
    void standaloneConnect(connectSequence);
  },
  disconnect: (
    options = null,
    callback = () => {
      // do nothing
    }
  ) => {
    status.updateNeedReplUi(false);
    ['clj', 'cljs'].forEach((sessionType) => {
      setStateValue(sessionType, null);
    });
    util.setConnectedState(false);
    setStateValue('cljc', null);
    status.update();

    if (nClient) {
      if (state.getProjectRootUri().scheme === 'vsls') {
        nClient.disconnect();
      } else {
        // the connection may be ended before
        // the REPL client was connected.
        nClient.close();
      }

      liveShareSupport.didDisconnectRepl();
      nClient = undefined;
    }

    callback();
  },
  toggleCLJCSession: () => {
    let newSession: NReplSession | undefined;

    if (getStateValue('connected')) {
      if (replSession.tryToGetSession('cljc') == replSession.tryToGetSession('cljs')) {
        newSession = replSession.tryToGetSession('clj');
      } else if (replSession.tryToGetSession('cljc') == replSession.tryToGetSession('clj')) {
        newSession = replSession.tryToGetSession('cljs');
      }
      setStateValue('cljc', newSession);
      if (outputWindow.isResultsDoc(util.getActiveTextEditor().document)) {
        outputWindow.setSession(newSession, undefined);
        replSession.updateReplSessionType();
        outputWindow.appendPrompt();
      }
      status.update();
    }
  },
  switchCljsBuild: async () => {
    const cljSession = replSession.tryToGetSession('clj');
    const cljsTypeName: string | undefined =
        state.extensionContext.workspaceState.get('selectedCljsTypeName'),
      cljTypeName: string | undefined =
        state.extensionContext.workspaceState.get('selectedCljTypeName');
    state.analytics().logEvent('REPL', 'switchCljsBuild', cljsTypeName).send();

    const [session, build] = await makeCljsSessionClone(
      cljSession,
      translatedReplType,
      cljTypeName
    );
    if (session) {
      setUpCljsRepl(session, build);
    }
    status.update();
  },
};
