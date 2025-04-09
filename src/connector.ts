import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
import * as string from './util/string';
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
import * as outputWindow from './repl-window/repl-doc';
import { formatAsLineComments } from './results-output/util';
import evaluate from './evaluate';
import * as liveShareSupport from './live-share';
import * as calvaDebug from './debugger/calva-debug';
import { setStateValue, getStateValue } from '../out/cljs-lib/cljs-lib';
import * as replSession from './nrepl/repl-session';
import * as clojureDocs from './clojuredocs';
import * as jszip from 'jszip';
import { addEdnConfig, getConfig } from './config';
import { getJarContents } from './utilities';
import { ConnectType } from './nrepl/connect-types';
import * as output from './results-output/output';
import * as inspector from './providers/inspector';

async function readRuntimeConfigs() {
  const classpath = await nClient.session.classpath().catch((e) => {
    console.error('readRuntimeConfigs:', e);
  });
  if (classpath) {
    const configs = classpath.classpath.map(async (element: string) => {
      if (element.endsWith('.jar')) {
        const edn = await getJarContents(element.concat('!/calva.exports/config.edn'));
        return [element, edn];
      } else if (element.endsWith('/resources')) {
        const configUri = vscode.Uri.file(element.concat('/calva.exports/config.edn'));
        try {
          await vscode.workspace.fs.stat(configUri);
          const ednBytes = await vscode.workspace.fs.readFile(configUri);
          const edn = new TextDecoder('utf-8').decode(ednBytes);
          return [element, edn];
        } catch {
          // no config found
        }
      }

      return [element, null];
    });
    const files = await Promise.all(configs);

    // maybe we don't need to keep uri -> edn association, but it would make showing errors easier later
    return files
      .filter(([_, config]) => string.isNonEmptyString(config))
      .map(([_, config]) => addEdnConfig(config));
  }
}

async function connectToHost(hostname: string, port: number, connectSequence: ReplConnectSequence) {
  if (nClient) {
    nClient['silent'] = true;
    await nClient.close();
  }

  let cljSession: NReplSession;

  util.setConnectingState(true);
  status.update();
  try {
    output.appendLineOtherOut('Hooking up nREPL sessions ...');
    // Create an nREPL client. waiting for the connection to be established.
    nClient = await NReplClient.create({
      host: hostname,
      port: +port,
      onError: (e) => {
        output.appendLineOtherErr(`nREPL connection failed: ${e}`);
        const scheme = state.getProjectRootUri().scheme;
        if (scheme === 'vsls') {
          output.appendLineOtherOut('Did the host share the nREPL port?');
        }
        // TODO: Figure out why the program bails out after here.
        // For now, we just clean up the connection state (even if we fail to return)
        return cleanUpAfterError(e);
      },
    });
    nClient.addOnCloseHandler((c) => {
      // TODO: We probably should not do the connect state changes here,
      //       or, only here...
      util.setConnectedState(false);
      util.setConnectingState(false);
      if (!c['silent']) {
        // we didn't deliberately close this session, mention this fact.
        output.appendLineOtherOut('nREPL Connection was closed');
      }
      status.update();
      calvaDebug.terminateDebugSession();
    });
    cljSession = nClient.session;
    cljSession.replType = 'clj';
    util.setConnectingState(false);
    util.setConnectedState(true);
    void state.analytics().logGA4Pageview('/connected-clj-repl');
    setStateValue('clj', cljSession);
    setStateValue('cljc', cljSession);
    status.update();
    output.appendLineOtherOut(`Connected session: clj`);
    replSession.updateReplSessionType();

    outputWindow.setSession(cljSession, nClient.ns);

    if (getConfig().autoEvaluateCode.onConnect.clj) {
      output.appendLineOtherOut(
        `Evaluating code from settings: 'calva.autoEvaluateCode.onConnect.clj'`
      );
      await evaluate.evaluateInOutputWindow(
        getConfig().autoEvaluateCode.onConnect.clj,
        'clj',
        outputWindow.getNs(),
        {}
      );
    }
    output.replWindowAppendPrompt();

    if (connectSequence.afterCLJReplJackInCode) {
      output.appendLineOtherOut(`Evaluating 'afterCLJReplJackInCode'`);
      await evaluate.evaluateInOutputWindow(
        connectSequence.afterCLJReplJackInCode,
        'clj',
        outputWindow.getNs(),
        {}
      );
    }
    if (!connectSequence.cljsType || connectSequence.cljsType === 'none') {
      output.maybePrintLegacyREPLWindowOutputMessage();
    }
    output.replWindowAppendPrompt();

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
        void state.analytics().logGA4Pageview('/connected-cljs-repl');
      }
      if (cljsSession) {
        await setUpCljsRepl(cljsSession, cljsBuild);
      }
    } catch (e) {
      output.appendLineOtherErr('Error while connecting cljs REPL: ' + e);
    }
    status.update();
  } catch (e) {
    return cleanUpAfterError(e);
  }

  void liveShareSupport.didConnectRepl(port);

  await readRuntimeConfigs();

  return true;
}

function cleanUpAfterError(e: any) {
  util.setConnectingState(false);
  util.setConnectedState(false);
  output.appendLineOtherErr('Failed connecting.');
  console.error('Failed connecting:', e);
  status.update();
  return false;
}

async function setUpCljsRepl(session: NReplSession, build) {
  setStateValue('cljs', session);
  setStateValue('cljc', session);
  status.update();
  output.appendLineOtherOut(`Connected session: cljs${build ? ', repl: ' + build : ''}`);
  outputWindow.appendLine(formatAsLineComments(outputWindow.CLJS_CONNECT_GREETINGS));
  const description = await session.describe(true);
  const ns = description.aux?.['current-ns'] || 'user';
  await session.eval(`(in-ns '${ns})`, 'user').value;
  outputWindow.setSession(session, ns);
  if (getConfig().autoEvaluateCode.onConnect.cljs) {
    output.appendLineOtherOut(
      `Evaluating code from settings: 'calva.autoEvaluateCode.onConnect.cljs'`
    );
    await evaluate.evaluateInOutputWindow(
      getConfig().autoEvaluateCode.onConnect.cljs,
      'cljs',
      ns,
      {}
    );
    output.maybePrintLegacyREPLWindowOutputMessage();
    output.replWindowAppendPrompt();
  }
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
    output.appendLineOtherErr(
      'There are no figwheel build files (.cljs.edn) in the project directory.'
    );
    output.appendLineOtherOut('Connection to Figwheel Main aborted.');
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

type checkConnectedFn = (value: string, out: any[], err: any[]) => Promise<boolean>;
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
  if (await checkSuccess(valueResult, out, err)) {
    setStateValue('cljs', (cljsSession = newCljsSession));
    return true;
  } else {
    return false;
  }
}

export interface ReplType {
  name: string;
  start?: connectFn;
  started?: (valueResult: string, out: string[], err: string[]) => Promise<boolean>;
  connect?: connectFn;
  connected: (valueResult: string, out: string[], err: string[]) => Promise<boolean>;
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
  let connectToBuild: string;
  const shouldRunStartCode =
    !cljsType.isStarted && !(connectSequence.projectType === 'shadow-cljs');

  let hasStarted = cljsType.isStarted || !shouldRunStartCode;

  // The output processors are used to keep the user informed about the connection process
  // TODO: Consider changing this to do-not-print semantics instead
  const printThisPrinter: processOutputFn = (x) => {
      if (cljsType.printThisLineRegExp) {
        if (x.search(cljsType.printThisLineRegExp) >= 0) {
          output.appendLineOtherOut(x.trimEnd());
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
          output.appendLineOtherOut(
            'CLJS REPL ready to connect. Please, start your ClojureScript app.'
          );
          haveShownStartMessage = true;
        }
      }
      // If we have an appURL to go with the ”start now” message, say so
      if (appURL && haveShownStartMessage && !haveShownAppURL) {
        if (cljsType.shouldOpenUrl) {
          output.appendLineOtherOut(`Opening ClojureScript app in the browser at: ${appURL} ...`);
          open(appURL).catch((reason) => {
            output.appendLineOtherErr('Error opening ClojureScript app in the browser: ' + reason);
          });
        } else {
          output.appendLineOtherOut('  Open the app on this URL: ' + appURL);
        }
        haveShownAppURL = true;
      }
      // Wait for any appURL to be printed before we round of the ”start now” message.
      // (If we do not have the regexp for extracting the appURL, do not wait for appURL.)
      if (
        !haveShownStartSuffix &&
        (haveShownAppURL || (haveShownStartMessage && !cljsType.openUrlRegExp))
      ) {
        output.appendLineOtherOut('  The CLJS REPL will connect when your app is running.');
        haveShownStartSuffix = true;
      }
    },
    // This processor prints everything. We use it for stderr below.
    allPrinter: processOutputFn = (x) => {
      output.appendOtherOut(x);
    };

  const replType: ReplType = {
    name: cljsTypeName,
    connect: async (session, name, checkFn) => {
      void state.extensionContext.workspaceState.update(
        'cljsReplTypeHasBuilds',
        cljsType.buildsRequired
      );
      let initCode = cljsType.connectCode;
      let build: string = null;
      if (menuSelections && menuSelections.cljsDefaultBuild && useDefaultBuild) {
        build = menuSelections.cljsDefaultBuild;
        useDefaultBuild = false;
      } else {
        if (typeof initCode === 'object' || initCode.includes('%BUILD%')) {
          const buildItem = await util.quickPickSingle({
            values: startedBuilds
              ? startedBuilds.map((a) => ({ label: a }))
              : (await figwheelOrShadowBuilds(cljsTypeName)).map((a) => ({ label: a })),
            placeHolder: 'Select which build to connect to',
            saveAs: `${state.getProjectRootUri().toString()}/${cljsTypeName.replace(
              ' ',
              '-'
            )}-build`,
            autoSelect: true,
          });
          build = buildItem.label;
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

      if (typeof build == 'string' && build != '') {
        build = build.startsWith(':') ? build : `:${build}`;
      }
      connectToBuild = build;
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
    connected: (result, out, err): Promise<boolean> => {
      return handleConnected(result, out, err);
    },
  };

  async function waitForShadowCljsRuntimes() {
    const cljSession = replSession.getSession('clj');
    const getRuntimesCode = `(count (shadow.cljs.devtools.api/repl-runtimes ${connectToBuild}))`;
    const checkForRuntimes = async () => {
      const runtimes = await cljSession.eval(getRuntimesCode, 'user').value;
      return runtimes && parseInt(runtimes) > 0;
    };
    return new Promise<boolean>((resolve, reject) => {
      void vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Waiting for shadow-cljs runtimes...',
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            reject(new Error('User cancelled waiting for shadow-cljs runtimes.'));
          });

          while (!(await checkForRuntimes())) {
            if (token.isCancellationRequested) {
              break;
            }
            progress.report({ message: 'Please start your ClojureScript app...' });
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          if (!token.isCancellationRequested) {
            resolve(true);
          }
        }
      );
    });
  }

  async function handleConnected(result, out, err): Promise<boolean> {
    if (cljsType.isConnectedRegExp) {
      const isConnectCodeEvaluatedSuccessfully =
        [...out, result].find((x) => {
          return x?.search(cljsType.isConnectedRegExp) >= 0;
        }) != undefined;
      if (!isConnectCodeEvaluatedSuccessfully || !isShadowCljsReplType(cljsType)) {
        return isConnectCodeEvaluatedSuccessfully;
      }
      return waitForShadowCljsRuntimes();
    } else {
      return true;
    }
  }

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
            if (allBuilds.length <= 1) {
              builds = allBuilds;
            } else {
              const selectedBuilds = await util.quickPickMulti({
                values: allBuilds.map((a) => ({ label: a })),
                placeHolder: 'Please select which builds to start',
                saveAs: `${state.getProjectRootUri().toString()}/${cljsTypeName.replace(
                  ' ',
                  '-'
                )}-builds`,
              });
              builds = selectedBuilds.map((build) => build.label);
            }
          }
          if (builds) {
            output.appendLineOtherOut('Starting cljs repl for: ' + projectTypeName + '...');
            void state.extensionContext.workspaceState.update('cljsReplTypeHasBuilds', true);
            startCode = startCode.replace(
              '%BUILDS%',
              builds
                .map((x) => {
                  return x.startsWith(':') ? x : `:${x}`;
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
            output.appendLineOtherOut('Aborted starting cljs repl.');
            throw 'Aborted';
          }
        } else {
          output.appendLineOtherOut('Starting cljs repl for: ' + projectTypeName + '...');
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

  replType.started = (result, out, err): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (cljsType.isReadyToStartRegExp && !hasStarted) {
        const started =
          [...out, ...err].find((x) => {
            return x.search(cljsType.isReadyToStartRegExp) >= 0;
          }) != undefined;
        if (started) {
          hasStarted = true;
        }
        resolve(started);
      } else {
        hasStarted = true;
        resolve(true);
      }
    });
  };

  return replType;
}

function isShadowCljsReplType(cljsType: CljsTypeConfig) {
  return (
    (typeof cljsType === 'string' && cljsType === 'shadow-cljs') ||
    cljsType.name === 'shadow-cljs' ||
    cljsType.dependsOn === 'shadow-cljs'
  );
}

async function makeCljsSessionClone(session, repl: ReplType, projectTypeName: string) {
  output.appendLineOtherOut('Creating cljs repl session...');
  let newCljsSession = await session.clone();
  newCljsSession.replType = 'cljs';
  if (newCljsSession) {
    output.appendLineOtherOut('Connecting cljs repl: ' + projectTypeName + '...');
    if (repl.start != undefined) {
      if (await repl.start(newCljsSession, repl.name, repl.started)) {
        output.appendLineOtherOut('Cljs builds started');
        newCljsSession = await session.clone();
        newCljsSession.replType = 'cljs';
      } else {
        output.appendLineOtherErr('Failed starting cljs repl');
        setStateValue('cljsBuild', null);
        return [null, null];
      }
    }
    if (await repl.connect(newCljsSession, repl.name, repl.connected)) {
      setStateValue('cljs', (cljsSession = newCljsSession));
      return [cljsSession, getStateValue('cljsBuild')];
    } else {
      const build = getStateValue('cljsBuild');
      const failed =
        'Failed starting cljs repl' +
        (build != null
          ? ` for build: ${build}. Is the build running and connected?\n   See the Output channel "Calva Connection Log" for any hints on what went wrong.`
          : '');
      output.appendLineOtherOut(failed);
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
      output.appendLineOtherErr('Bad url: ' + url);
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

  const portFile = projectTypes.nreplPortFileUri(connectSequence);
  void state.extensionContext.workspaceState.update('selectedCljsTypeName', cljsTypeName);
  void state.extensionContext.workspaceState.update('selectedConnectSequence', connectSequence);

  try {
    if (port === undefined) {
      try {
        output.appendLineOtherOut(`Reading port file: ${portFile} ...`);
        await vscode.workspace.fs.stat(portFile);
        const bytes = await vscode.workspace.fs.readFile(portFile);
        port = new TextDecoder('utf-8').decode(bytes);
      } catch {
        console.info('No nrepl port found');
      }
    }
    if (port) {
      hostname = hostname !== undefined ? hostname : 'localhost';
      output.appendLineOtherOut(`Using host:port ${hostname}:${port} ...`);
      if (isAutoConnect) {
        setStateValue('hostname', hostname);
        setStateValue('port', port);
        await connectToHost(hostname, parseInt(port), connectSequence);
      } else {
        await promptForNreplUrlAndConnect(port, connectSequence);
      }
    } else {
      output.appendLineOtherOut('No nrepl port file found.');
      await promptForNreplUrlAndConnect(port, connectSequence);
    }
    status.update();
  } catch (e) {
    console.error(e);
  }
  initializeDebugger(nClient.session);
  if (
    !['babashka', 'nbb', 'joyride', 'basilisp', 'generic'].includes(connectSequence.projectType)
  ) {
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
  if (getConfig().redirectServerOutputToRepl && nClient.session.supports('out-subscribe')) {
    void nClient.session.outSubscribe();
  }
  return true;
}

async function standaloneConnect(
  connectSequence: ReplConnectSequence,
  hostname?: string,
  port?: string
) {
  await outputWindow.initResultsDoc();
  inspector.revealOnConnect();
  await outputWindow.openResultsDoc();

  if (connectSequence) {
    const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);
    output.appendLineOtherOut(`Connecting ...`);
    void state.analytics().logGA4Pageview('/connect-initiated');
    void state.analytics().logGA4Pageview('/connect-initiated/standalone-connect');

    return connect(connectSequence, getConfig().autoSelectNReplPortFromPortFile, hostname, port);
  } else {
    output.appendLineOtherErr('Aborting connect, error determining connect sequence.');
  }
}

async function nReplPortFileExists() {
  const sequences = getConnectSequences(projectTypes.getAllProjectTypes());
  const portFiles = sequences.map((sequence) => projectTypes.nreplPortFileUri(sequence));
  let fileExists = false;
  await Promise.all(
    portFiles.map(async (portFile) => {
      try {
        await vscode.workspace.fs.stat(portFile);
        fileExists = true;
      } catch {
        // do nothing, file does not exist
      }
    })
  );
  return fileExists;
}

export default {
  connectNonProjectREPLCommand: async (context: vscode.ExtensionContext) => {
    await state.setOrCreateNonProjectRoot(context, true);
    const connectSequence = await askForConnectSequence(
      projectTypes.getAllProjectTypes(),
      ConnectType.Connect,
      undefined
    );
    inspector.revealOnConnect();
    await outputWindow.initResultsDoc();
    await outputWindow.openResultsDoc();

    if (connectSequence) {
      const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);
      output.appendLineOtherOut(`Connecting ...`);
      void state.analytics().logGA4Pageview('/connect-initiated');
      void state.analytics().logGA4Pageview('/connect-initiated/external-repl-connect');

      return connect(connectSequence, false);
    } else {
      output.appendLineOtherErr('Aborting connect, error determining connect sequence.');
    }
  },
  connectCommand: async (options?: {
    host?: string;
    port?: string;
    connectSequence?: string | ReplConnectSequence;
    disableAutoSelect?: boolean;
  }) => {
    const host = options && options.host ? options.host : undefined;
    const port = options && options.port ? options.port : undefined;
    let connectSequence: ReplConnectSequence;
    if (options && typeof options.connectSequence === 'string') {
      connectSequence = getConnectSequences(projectTypes.getAllProjectTypes()).find(
        (s) => s.name === options.connectSequence
      );
    } else if (options && options.connectSequence) {
      connectSequence = options.connectSequence as ReplConnectSequence;
    }
    await state
      .initProjectDir(ConnectType.Connect, connectSequence, options?.disableAutoSelect)
      .catch((e) => {
        void vscode.window.showErrorMessage('Failed initializing project root directory: ', e);
      });
    const cljTypes = await projectTypes.detectProjectTypes();
    if (!connectSequence) {
      try {
        connectSequence = await askForConnectSequence(
          cljTypes,
          ConnectType.Connect,
          options?.disableAutoSelect
        );
      } catch (e) {
        output.appendLineOtherErr(`${e}\nAborting connect.`);
        void vscode.window.showErrorMessage(`${e}`, 'OK');
        return;
      }
    }
    await liveShareSupport.setupLiveShareListener().catch((e) => {
      console.error('Error initializing LiveShare support: ', e);
    });
    return standaloneConnect(connectSequence, host, port).catch((e) => {
      void vscode.window.showErrorMessage('Failed connecting to REPL: ', e);
    });
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
        void nClient.close();
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
        output.replWindowAppendPrompt();
      }
      status.update();
    }
  },
  switchCljsBuild: async () => {
    const cljSession = replSession.getSession('clj');
    const cljsTypeName: string = state.extensionContext.workspaceState.get('selectedCljsTypeName'),
      cljTypeName: string = state.extensionContext.workspaceState.get('selectedCljTypeName');
    const [session, build] = await makeCljsSessionClone(
      cljSession,
      translatedReplType,
      cljTypeName
    );
    if (session) {
      await setUpCljsRepl(session, build);
    }
    status.update();
  },
};
