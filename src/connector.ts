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
  getConnectSequences,
} from './nrepl/connectSequence';
import { disabledPrettyPrinter } from './printer';
import { keywordize } from './util/string';
import { initializeDebugger } from './debugger/calva-debug';
import * as outputWindow from './results-output/results-doc';
import { formatAsLineComments } from './results-output/util';
import { evaluateInOutputWindow } from './evaluate';
import * as liveShareSupport from './live-share';
import * as calvaDebug from './debugger/calva-debug';
import { setStateValue, getStateValue } from '../out/cljs-lib/cljs-lib';
import * as replSession from './nrepl/repl-session';
import * as clojureDocs from './clojuredocs';
import * as jszip from 'jszip';
import { addEdnConfig, getConfig } from './config';
import { getJarContents } from './utilities';
import { ConnectType } from './nrepl/connect-types';

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
    outputWindow.appendLine('; Hooking up nREPL sessions...');
    // Create an nREPL client. waiting for the connection to be established.
    nClient = await NReplClient.create({
      host: hostname,
      port: +port,
      onError: (e) => {
        const scheme = state.getProjectRootUri().scheme;
        if (scheme === 'vsls') {
          outputWindow.appendLine('; nREPL connection failed; did the host share the nREPL port?');
        }
      },
    });
    nClient.addOnCloseHandler((c) => {
      util.setConnectedState(false);
      util.setConnectingState(false);
      if (!c['silent']) {
        // we didn't deliberately close this session, mention this fact.
        outputWindow.appendLine('; nREPL Connection was closed');
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
    outputWindow.appendLine(
      `; Connected session: clj\n${formatAsLineComments(outputWindow.CLJ_CONNECT_GREETINGS)}`
    );
    replSession.updateReplSessionType();

    outputWindow.setSession(cljSession, nClient.ns);

    if (connectSequence.afterCLJReplJackInCode) {
      outputWindow.appendLine(`; Evaluating 'afterCLJReplJackInCode'`);
      await evaluateInOutputWindow(
        connectSequence.afterCLJReplJackInCode,
        'clj',
        outputWindow.getNs(),
        {}
      );
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
      outputWindow.appendLine('; Error while connecting cljs REPL: ' + e);
    }
    status.update();
  } catch (e) {
    util.setConnectingState(false);
    util.setConnectedState(false);
    outputWindow.appendLine('; Failed connecting.');
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
  outputWindow.appendLine(
    `; Connected session: cljs${build ? ', repl: ' + build : ''}\n${formatAsLineComments(
      outputWindow.CLJS_CONNECT_GREETINGS
    )}`
  );
  outputWindow.setSession(session, 'cljs.user');
  replSession.updateReplSessionType();
}

async function getFigwheelMainBuilds() {
  const res = await vscode.workspace.fs.readDirectory(state.getProjectRootUri());
  const builds = res
    .filter(([name, type]) => type !== vscode.FileType.Directory && name.match(/\.cljs\.edn/))
    .map(([name, _]) => name.replace(/\.cljs\.edn$/, ''));
  if (builds.length == 0) {
    void vscode.window.showErrorMessage(
      'There are no figwheel build files (.cljs.edn) in the project directory.'
    );
    outputWindow.appendLine(
      '; There are no figwheel build files (.cljs.edn) in the project directory.'
    );
    outputWindow.appendLine('; Connection to Figwheel Main aborted.');
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
  let appURL: string;
  let haveShownStartMessage = false;
  let haveShownAppURL = false;
  let haveShownStartSuffix = false;
  let useDefaultBuild = true;
  let startedBuilds: string[];
  const shouldRunStartCode =
    !cljsType.isStarted && !(connectSequence.projectType === 'shadow-cljs');

  let hasStarted = cljsType.isStarted || !shouldRunStartCode;

  // The output processors are used to keep the user informed about the connection process
  // TODO: Consider changing this to do-not-print semantics instead
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
          outputWindow.appendLine(
            '; CLJS REPL ready to connect. Please, start your ClojureScript app.'
          );
          haveShownStartMessage = true;
        }
      }
      // If we have an appURL to go with the ”start now” message, say so
      if (appURL && haveShownStartMessage && !haveShownAppURL) {
        if (cljsType.shouldOpenUrl) {
          outputWindow.appendLine(`; Opening ClojureScript app in the browser at: ${appURL} ...`);
          open(appURL).catch((reason) => {
            outputWindow.appendLine('; Error opening ClojureScript app in the browser: ' + reason);
          });
        } else {
          outputWindow.appendLine(';   Open the app on this URL: ' + appURL);
        }
        haveShownAppURL = true;
      }
      // Wait for any appURL to be printed before we round of the ”start now” message.
      // (If we do not have the regexp for extracting the appURL, do not wait for appURL.)
      if (
        !haveShownStartSuffix &&
        (haveShownAppURL || (haveShownStartMessage && !cljsType.openUrlRegExp))
      ) {
        outputWindow.appendLine(';   The CLJS REPL will connect when your app is running.');
        haveShownStartSuffix = true;
      }
    },
    // This processor prints everything. We use it for stderr below.
    allPrinter: processOutputFn = (x) => {
      outputWindow.appendLine('; ' + util.stripAnsi(x).replace(/\s*$/, ''));
    };

  const replType: ReplType = {
    name: cljsTypeName,
    connect: async (session, name, checkFn) => {
      void state.extensionContext.workspaceState.update(
        'cljsReplTypeHasBuilds',
        cljsType.buildsRequired
      );
      let initCode = cljsType.connectCode,
        build: string = null;
      if (menuSelections && menuSelections.cljsDefaultBuild && useDefaultBuild) {
        build = menuSelections.cljsDefaultBuild;
        useDefaultBuild = false;
      } else {
        if (typeof initCode === 'object' || initCode.includes('%BUILD%')) {
          build = await util.quickPickSingle({
            values: startedBuilds ? startedBuilds : await figwheelOrShadowBuilds(cljsTypeName),
            placeHolder: 'Select which build to connect to',
            saveAs: `${state.getProjectRootUri().toString()}/${cljsTypeName.replace(
              ' ',
              '-'
            )}-build`,
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
      if (cljsType.isConnectedRegExp) {
        return (
          [...out, result].find((x) => {
            return x.search(cljsType.isConnectedRegExp) >= 0;
          }) != undefined
        );
      } else {
        return true;
      }
    },
  };

  if (cljsType.startCode && shouldRunStartCode) {
    replType.start = async (session, name, checkFn) => {
      let startCode = cljsType.startCode;
      if (!hasStarted) {
        if (startCode.includes('%BUILDS')) {
          let builds: string[];
          if (menuSelections && menuSelections.cljsLaunchBuilds) {
            builds = menuSelections.cljsLaunchBuilds;
          } else {
            const allBuilds = (await figwheelOrShadowBuilds(cljsTypeName)).filter(
              (build) => !['browser-repl', 'node-repl'].includes(build)
            );
            builds =
              allBuilds.length <= 1
                ? allBuilds
                : await util.quickPickMulti({
                    values: allBuilds,
                    placeHolder: 'Please select which builds to start',
                    saveAs: `${state.getProjectRootUri().toString()}/${cljsTypeName.replace(
                      ' ',
                      '-'
                    )}-builds`,
                  });
          }
          if (builds) {
            outputWindow.appendLine('; Starting cljs repl for: ' + projectTypeName + '...');
            void state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
            startCode = startCode.replace(
              '%BUILDS%',
              builds
                .map((x) => {
                  return x.startsWith(':') ? x : `"${x}"`;
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
            outputWindow.appendLine('; Aborted starting cljs repl.');
            throw 'Aborted';
          }
        } else {
          outputWindow.appendLine('; Starting cljs repl for: ' + projectTypeName + '...');
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
    if (cljsType.isReadyToStartRegExp && !hasStarted) {
      const started =
        [...out, ...err].find((x) => {
          return x.search(cljsType.isReadyToStartRegExp) >= 0;
        }) != undefined;
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

async function makeCljsSessionClone(session, repl: ReplType, projectTypeName: string) {
  outputWindow.appendLine('; Creating cljs repl session...');
  let newCljsSession = await session.clone();
  newCljsSession.replType = 'cljs';
  if (newCljsSession) {
    outputWindow.appendLine('; Connecting cljs repl: ' + projectTypeName + '...');
    outputWindow.appendLine(
      ';   The Calva Connection Log might have more connection progress information.'
    );
    if (repl.start != undefined) {
      if (await repl.start(newCljsSession, repl.name, repl.started)) {
        state.analytics().logEvent('REPL', 'StartedCLJS', repl.name).send();
        outputWindow.appendLine('; Cljs builds started');
        newCljsSession = await session.clone();
        newCljsSession.replType = 'cljs';
      } else {
        state.analytics().logEvent('REPL', 'FailedStartingCLJS', repl.name).send();
        outputWindow.appendLine('; Failed starting cljs repl');
        setStateValue('cljsBuild', null);
        return [null, null];
      }
    }
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
      outputWindow.appendLine(`; ${failed}`);
      setStateValue('cljsBuild', null);
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
      outputWindow.appendLine('; Bad url: ' + url);
      util.setConnectingState(false);
      status.update();
    }
  } else {
    util.setConnectingState(false);
    status.update();
  }
  return true;
}

export let nClient: NReplClient;
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
        outputWindow.appendLine(`; Read port file: ${portFile}`);
      } catch {
        console.info('No nrepl port found');
      }
    }
    if (port) {
      hostname = hostname !== undefined ? hostname : 'localhost';
      outputWindow.appendLine(`; Using host:port ${hostname}:${port}`);
      if (isAutoConnect) {
        setStateValue('hostname', hostname);
        setStateValue('port', port);
        await connectToHost(hostname, parseInt(port), connectSequence);
      } else {
        await promptForNreplUrlAndConnect(port, connectSequence);
      }
    } else {
      outputWindow.appendLine('; No nrepl port file found.');
      await promptForNreplUrlAndConnect(port, connectSequence);
    }
  } catch (e) {
    console.error(e);
  }
  initializeDebugger(nClient.session);
  if (!['babashka', 'nbb', 'joyride', 'generic'].includes(connectSequence.projectType)) {
    if (!nClient.session.supports('info')) {
      void vscode.window
        .showWarningMessage(
          'The nREPL server does not support cider-nrepl `info` op, which indicates troubles ahead. You need to start the REPL with cider-nrepl dependencies met.',
          'Show Calva Connect Docs'
        )
        .then((choice) => {
          if (choice === 'Show Calva Connect Docs') {
            void vscode.commands.executeCommand('simpleBrowser.show', 'https://calva.io/connect/');
          }
        });
      console.error(`Basic cider-nrepl dependencies not met (no 'info' op)`);
    }
  }
  return true;
}

async function standaloneConnect(
  connectSequence: ReplConnectSequence,
  hostname?: string,
  port?: string
) {
  await outputWindow.initResultsDoc();
  await outputWindow.openResultsDoc();

  if (connectSequence) {
    const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);
    outputWindow.appendLine(`; Connecting ...`);
    state
      .analytics()
      .logEvent('REPL', 'StandaloneConnect', `${connectSequence.name} + ${cljsTypeName}`)
      .send();
    return connect(
      connectSequence,
      getConfig().autoSelectNReplPortFromPortFile,
      hostname,
      port
    ).catch(() => {
      // do nothing
    });
  } else {
    outputWindow.appendLine('; Aborting connect, error determining connect sequence.');
  }
}

async function nReplPortFileExists() {
  const sequences = getConnectSequences(projectTypes.getAllProjectTypes());
  const portFiles = sequences.map((sequence) => projectTypes.nreplPortFileUri(sequence));
  return await Promise.all(
    portFiles.map(async (portFile) => {
      try {
        await vscode.workspace.fs.stat(portFile);
        return true;
      } catch {
        return false;
      }
    })
  );
}

export default {
  connectNonProjectREPLCommand: async (context: vscode.ExtensionContext) => {
    status.updateNeedReplUi(true);
    await state.setOrCreateNonProjectRoot(context, true);
    const connectSequence = await askForConnectSequence(
      projectTypes.getAllProjectTypes(),
      'connect-type',
      'ConnectInterrupted',
      ConnectType.Connect
    );
    void standaloneConnect(connectSequence);
  },
  connectCommand: async (host: string, port: string) => {
    status.updateNeedReplUi(true);
    await state.initProjectDir(ConnectType.Connect).catch((e) => {
      void vscode.window.showErrorMessage('Failed initializing project root directory: ', e);
    });
    await liveShareSupport.setupLiveShareListener().catch((e) => {
      console.error('Error initializing LiveShare support: ', e);
    });
    const cljTypes = await projectTypes.detectProjectTypes();
    const connectSequence = await askForConnectSequence(
      cljTypes,
      'connect-type',
      'ConnectInterrupted',
      ConnectType.Connect
    );
    return standaloneConnect(connectSequence, host, port);
  },
  shouldAutoConnect: async () => {
    return getConfig().autoConnectRepl && nReplPortFileExists();
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
    let newSession: NReplSession;

    if (getStateValue('connected')) {
      if (replSession.getSession('cljc') == replSession.getSession('cljs')) {
        newSession = replSession.getSession('clj');
      } else if (replSession.getSession('cljc') == replSession.getSession('clj')) {
        newSession = replSession.getSession('cljs');
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
    const cljSession = replSession.getSession('clj');
    const cljsTypeName: string = state.extensionContext.workspaceState.get('selectedCljsTypeName'),
      cljTypeName: string = state.extensionContext.workspaceState.get('selectedCljTypeName');
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
