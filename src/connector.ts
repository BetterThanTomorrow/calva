import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
import * as string from './util/string';
import * as open from 'open';
import status from './status';
import * as projectTypes from './nrepl/project-types';
import { NReplClient, NReplSession } from './nrepl';
import * as shadowCljsRuntime from './shadow-cljs-runtime';
import {
  CljsTypeConfig,
  ReplConnectSequence,
  getDefaultCljsType,
  askForConnectSequence,
  getConnectSequences,
} from './nrepl/connectSequence';
import * as secondarySession from './nrepl/secondary-session';
import { disabledPrettyPrinter } from './printer';
import { initializeDebugger } from './debugger/calva-debug';
import * as outputWindow from './repl-window/repl-window-doc';
import { formatAsLineComments } from './results-output/util';
import evaluate from './evaluate';
import * as liveShareSupport from './live-share';
import * as calvaDebug from './debugger/calva-debug';
import { setStateValue, getStateValue } from '../out/cljs-lib/cljs-lib';
import * as replSession from './nrepl/repl-session';
import * as clojureDocs from './clojuredocs';
import { addEdnConfig, getConfig } from './config';
import { getJarContents } from './utilities';
import { ConnectType } from './nrepl/connect-types';
import * as output from './results-output/output';
import * as inspector from './providers/inspector';
import * as sessionRegistry from './nrepl/session-registry';
import * as sessionRoleUtils from './nrepl/session-role-utils';
import type { SessionRoleKeys, SessionGlobMap } from './nrepl/session-role-utils';
import * as sessionRouting from './nrepl/session-routing';
import * as clientRegistry from './nrepl/client-registry';
import type { RegisteredClient } from './nrepl/client-registry';
import * as sessionTeardown from './nrepl/session-teardown';
import type { SessionGlobSpec } from './nrepl/globs';
import * as sessionNameResolver from './nrepl/session-name-resolver';
import * as fruitSuffix from './nrepl/fruit-suffix';
import { getPathRelativeToWorkspace } from './project-root';
import * as cljsBuilds from './connector-cljs-builds';
import * as connectorUtils from './connector-utilities';

function getSessionGlobMetadata(
  sessionKey: string,
  globMap: SessionGlobMap
): { globSpecs: SessionGlobSpec[]; globs: string[] } {
  const globSpecs = sessionRoleUtils.getGlobSpecsFromMap(globMap, sessionKey);
  return {
    globSpecs,
    globs: globSpecs.map((spec) => spec.pattern),
  };
}

async function readRuntimeConfigs(session: NReplSession) {
  const classpath = await session.classpath().catch((e) => {
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

interface ConnectResult {
  connected: boolean;
  clientKey?: string;
}

async function connectToHost(
  hostname: string,
  port: number,
  connectSequence: ReplConnectSequence,
  silent = false
): Promise<ConnectResult> {
  let mainSession: NReplSession;
  let localClient: NReplClient | undefined;
  const baseSessionNames = sessionRoleUtils.deriveSessionRoleKeys(connectSequence);
  const projectRootPath = state.getProjectRootUri().fsPath;
  const projectRoot = state.getProjectRootUri().toString();
  const useSecondarySession = secondarySession.shouldUseSecondarySession(connectSequence);

  const resolution = sessionNameResolver.resolveSessionNames(baseSessionNames, projectRoot);
  const sessionRoleKeys = resolution.finalNames;

  if (resolution.reconnectClientKey) {
    output.appendLineOtherOut(
      `Reconnecting: disconnecting existing client for sessions: ${Object.values(sessionRoleKeys)
        .filter(Boolean)
        .join(', ')}`
    );
    await disconnectClientByKey(resolution.reconnectClientKey);
  }

  const sessionGlobMap = sessionRoleUtils.deriveSessionGlobMap(
    connectSequence,
    sessionRoleKeys,
    projectRootPath
  );

  util.setConnectingState(true);
  void vscode.commands.executeCommand('setContext', 'calva:connectSequence', connectSequence.name);
  status.update();
  try {
    output.appendLineOtherOut(`Hooking up nREPL sessions on port ${port}...`);
    // Create an nREPL client. waiting for the connection to be established.
    localClient = await NReplClient.create({
      host: hostname,
      port: +port,
      onError: (e) => {
        output.appendLineOtherErr(`nREPL connection failed, port ${port}: ${e}`);
        const scheme = state.getProjectRootUri().scheme;
        if (scheme === 'vsls') {
          output.appendLineOtherOut('Did the host share the nREPL port?');
        }
        // TODO: Figure out why the program bails out after here.
        // For now, we just clean up the connection state (even if we fail to return)
        return cleanUpAfterError(e);
      },
    });
    clientRegistry.registerClient(localClient, {
      connectSequenceName: connectSequence.name,
      projectRoot,
      host: hostname,
      port,
      connectionState: {
        cljsBuild: null,
        cljsTypeName: projectTypes.getCljsTypeName(connectSequence),
        hasBuilds: false,
        sessionRoleKeys,
        sessionGlobMap,
        connectSequence,
        baseSessionNames,
        fruitSuffix: resolution.fruitSuffix,
      },
    });
    localClient.addOnCloseHandler((c) => {
      const wasRegistered = clientRegistry.unregisterClient(c.clientKey);
      if (wasRegistered) {
        sessionTeardown.teardownSessionsForClient(c.clientKey);
      }

      const remainingSessions = sessionRegistry.listSessions().length;
      util.setConnectedState(remainingSessions > 0);
      util.setConnectingState(false);
      if (!c['silent']) {
        output.appendLineOtherOut(
          `nREPL Connection was closed for client: ${c.clientKey}, port: ${port}`
        );
      }
      status.update();
      calvaDebug.terminateDebugSession();
    });
    mainSession = localClient.session;
    mainSession.replType = 'clj';
    util.setConnectingState(false);
    util.setConnectedState(true);
    void state.analytics().logGA4Pageview('/connected-clj-repl');

    const mainKey = sessionRoleKeys.primary;
    const mainGlobMetadata = getSessionGlobMetadata(mainKey, sessionGlobMap);
    sessionRegistry.registerSession(mainKey, mainSession, {
      projectRoot: state.getProjectRootUri().toString(),
      globs: mainGlobMetadata.globs,
      globSpecs: mainGlobMetadata.globSpecs,
    });
    clientRegistry.setCljcTargetForConnection(localClient.clientKey, 'primary');

    status.update();
    output.appendLineOtherOut(`Connected session: ${mainKey}, port: ${port}`);
    replSession.updateReplSessionType();

    outputWindow.setSession(mainSession, localClient.ns, mainKey);

    if (getConfig().autoEvaluateCode.onConnect.clj) {
      output.appendLineOtherOut(
        `Evaluating code from settings: 'calva.autoEvaluateCode.onConnect.clj'`
      );
      await evaluate.evaluateInOutputWindow(
        getConfig().autoEvaluateCode.onConnect.clj,
        mainKey,
        outputWindow.getNs(),
        {}
      );
    }
    output.replWindowAppendPrompt();

    const afterMainReplCode =
      connectSequence.afterPrimaryReplConnectedCode ?? connectSequence.afterCLJReplJackInCode;
    if (afterMainReplCode) {
      output.appendLineOtherOut(`Evaluating 'afterPrimaryReplConnectedCode'`);
      await evaluate.evaluateInOutputWindow(afterMainReplCode, mainKey, outputWindow.getNs(), {});
    }
    if (!connectSequence.cljsType || connectSequence.cljsType === 'none') {
      output.maybePrintLegacyREPLWindowOutputMessage();
    }
    output.replWindowAppendPrompt();

    clojureDocs.probeAndSetSession(mainSession, mainKey);

    let cljsSession = null,
      cljsBuild = null;
    try {
      if (
        useSecondarySession &&
        sessionRoleKeys.secondary &&
        connectSequence.cljsType &&
        connectSequence.cljsType != 'none'
      ) {
        const isBuiltinType: boolean = typeof connectSequence.cljsType == 'string';
        const cljsType: CljsTypeConfig = isBuiltinType
          ? getDefaultCljsType(connectSequence.cljsType as string)
          : (connectSequence.cljsType as CljsTypeConfig);

        const translatedReplType = createCLJSReplType(
          cljsType,
          projectTypes.getCljsTypeName(connectSequence),
          connectSequence,
          localClient.clientKey,
          sessionRoleKeys,
          sessionGlobMap
        );

        [cljsSession, cljsBuild] = await makeCljsSessionClone(
          mainSession,
          translatedReplType,
          connectSequence.name,
          localClient.clientKey,
          sessionRoleKeys.secondary,
          sessionGlobMap
        );
        void state.analytics().logGA4Pageview('/connected-cljs-repl');
      }
      if (cljsSession && sessionRoleKeys.secondary) {
        await setUpCljsRepl(
          cljsSession,
          cljsBuild,
          sessionRoleKeys.secondary,
          localClient.clientKey,
          sessionGlobMap
        );
      }
      if (useSecondarySession && isShadowCljsReplType(connectSequence.cljsType)) {
        await shadowCljsRuntime.initializeShadowRemoteNotifications();
      }
    } catch (e) {
      output.appendLineOtherErr('Error while connecting cljs REPL: ' + e);
    }

    status.update();
  } catch (e) {
    return cleanUpAfterError(e, localClient?.clientKey, silent);
  }

  void liveShareSupport.didConnectRepl(port);

  await readRuntimeConfigs(mainSession);

  // Post-connect initialization
  initializeDebugger(mainSession);
  if (
    !['babashka', 'nbb', 'joyride', 'scittle', 'basilisp', 'generic'].includes(
      connectSequence.projectType
    )
  ) {
    if (!mainSession.supports('info')) {
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
  if (getConfig().redirectServerOutputToRepl && mainSession.supports('out-subscribe')) {
    void mainSession.outSubscribe();
  }

  return { connected: true, clientKey: localClient.clientKey };
}

function cleanUpAfterError(e: any, clientKeyToRemove?: string, silent = false): ConnectResult {
  if (clientKeyToRemove) {
    clientRegistry.unregisterClient(clientKeyToRemove);
    sessionTeardown.teardownSessionsForClient(clientKeyToRemove);
  }
  util.setConnectingState(false);
  util.setConnectedState(sessionRegistry.listSessions().length > 0);
  if (!silent) {
    output.appendLineOtherErr('Failed connecting.');
  }
  console.error('Failed connecting:', e);
  status.update();
  return { connected: false };
}

async function setUpCljsRepl(
  session: NReplSession,
  build: string | null,
  cljsKey: string,
  clientKey: string,
  globMap: SessionGlobMap
) {
  const globMetadata = getSessionGlobMetadata(cljsKey, globMap);
  sessionRegistry.registerSession(cljsKey, session, {
    projectRoot: state.getProjectRootUri().toString(),
    globs: globMetadata.globs,
    globSpecs: globMetadata.globSpecs,
    isSecondary: true,
  });
  clientRegistry.setCljcTargetForConnection(clientKey, 'secondary');

  clojureDocs.probeAndSetSession(session, cljsKey);

  status.update();
  output.appendLineOtherOut(`Connected session: ${cljsKey}${build ? ', repl: ' + build : ''}`);
  outputWindow.appendLine(formatAsLineComments(outputWindow.CLJS_CONNECT_GREETINGS));
  const description = await session.describe(true);
  const ns = description.aux?.['current-ns'] || 'user';
  await session.eval(`(in-ns '${ns})`, 'user').value;
  outputWindow.setSession(session, ns, cljsKey);
  if (getConfig().autoEvaluateCode.onConnect.cljs) {
    output.appendLineOtherOut(
      `Evaluating code from settings: 'calva.autoEvaluateCode.onConnect.cljs'`
    );
    await evaluate.evaluateInOutputWindow(
      getConfig().autoEvaluateCode.onConnect.cljs,
      cljsKey,
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
// function getFigwheelBuilds() {
//   // do nothing
// }

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
  return await checkSuccess(valueResult, out, err);
}

export interface ReplType {
  name: string;
  start?: connectFn;
  started?: (valueResult: string, out: string[], err: string[]) => Promise<boolean>;
  connect?: connectFn;
  connected: (valueResult: string, out: string[], err: string[]) => Promise<boolean>;
}

async function figwheelOrShadowBuilds(
  cljsTypeName: string,
  projectRootUri?: vscode.Uri
): Promise<string[] | undefined> {
  if (cljsTypeName.includes('Figwheel Main')) {
    return await getFigwheelMainBuilds();
  } else if (cljsTypeName.includes('shadow-cljs')) {
    return await projectTypes.shadowBuilds(projectRootUri);
  }
}

/**
 * Query the REPL for currently active (watched) builds.
 * For shadow-cljs: uses shadow.cljs.devtools.api/active-builds
 * For Figwheel Main: uses figwheel.main/build-registry
 * Returns undefined if the query fails or cljsType is not supported.
 */
async function getActiveBuilds(
  cljsTypeName: string,
  session: NReplSession
): Promise<string[] | undefined> {
  try {
    const code = cljsBuilds.getActiveBuildQueryCode(cljsTypeName);
    if (!code) {
      return undefined;
    }

    const result = await session.eval(code, 'user').value;
    if (result) {
      return cljsBuilds.parseClojureVectorResult(result);
    }
  } catch (e) {
    console.error('Error querying active builds:', e);
  }
  return undefined;
}

/**
 * Prompt the user to select a CLJS build, showing watcher status for each build.
 * Builds without active watchers are shown as disabled and cannot be selected.
 * browser-repl and node-repl don't require watchers and are always available.
 */
async function selectCljsBuild(
  cljsTypeName: string,
  projectRootUri?: vscode.Uri,
  session?: NReplSession
): Promise<string | null> {
  const effectiveProjectRoot = projectRootUri ?? state.getProjectRootUri();
  const allBuilds = await figwheelOrShadowBuilds(cljsTypeName, effectiveProjectRoot);
  if (!allBuilds || allBuilds.length === 0) {
    return null;
  }

  // Query active builds if we have a session
  let activeBuilds: string[] | undefined;
  if (session) {
    activeBuilds = await getActiveBuilds(cljsTypeName, session);
  }

  // Create picker items with status information using extracted helpers
  const pickerItems: util.CalvaQuickPickItem[] = allBuilds.map((build) => {
    const isActive = cljsBuilds.isBuildActive(build, activeBuilds);

    return {
      label: build,
      description: !isActive ? 'Watcher not running' : undefined,
      disabled: !isActive,
    };
  });

  const buildItem = await util.quickPickSingle({
    title: 'ClojureScript Builds',
    values: pickerItems,
    placeHolder: 'Select which build to connect to',
    saveAs: `${effectiveProjectRoot.toString()}/${cljsTypeName.replace(' ', '-')}-build`,
    autoSelect: true,
  });

  return buildItem?.label ?? null;
}

// Use the extracted pure function from connector-cljs-builds
const updateInitCode = cljsBuilds.updateInitCode;

function createCLJSReplType(
  cljsType: CljsTypeConfig,
  cljsTypeName: string,
  connectSequence: ReplConnectSequence,
  clientKey: string,
  roleKeys: SessionRoleKeys,
  globMap: SessionGlobMap,
  options: { useDefaultBuild?: boolean; preSelectedBuild?: string } = {}
): ReplType {
  // This function is only called when a secondary session is expected
  const secondaryKey = roleKeys.secondary;
  if (!secondaryKey) {
    throw new Error('createCLJSReplType called without secondary session key');
  }

  const projectTypeName: string = connectSequence.name,
    menuSelections = connectSequence.menuSelections;
  let appURL: string;
  let haveShownStartMessage = false;
  let haveShownAppURL = false;
  let haveShownStartSuffix = false;
  let useDefaultBuild = options.useDefaultBuild ?? true;
  const preSelectedBuild = options.preSelectedBuild;
  let startedBuilds: string[];
  let connectToBuild: string;
  const shouldRunStartCode =
    !cljsType.isStarted && !(connectSequence.projectType === 'shadow-cljs') && !preSelectedBuild;

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
      // Store hasBuilds in per-connection state
      clientRegistry.setConnectionState(clientKey, {
        hasBuilds: cljsType.buildsRequired,
      });
      let initCode = cljsType.connectCode;
      let build: string = null;

      // Use pre-selected build if provided (from switchCljsBuild command)
      if (preSelectedBuild) {
        build = preSelectedBuild;
      } else if (menuSelections && menuSelections.cljsDefaultBuild && useDefaultBuild) {
        build = menuSelections.cljsDefaultBuild;
        useDefaultBuild = false;
      } else {
        if (typeof initCode === 'object' || initCode.includes('%BUILD%')) {
          const allBuilds = await figwheelOrShadowBuilds(cljsTypeName);
          const availableBuilds = startedBuilds
            ? [
                ...startedBuilds,
                ...allBuilds.filter((b) => ['node-repl', 'browser-repl'].includes(b)),
              ]
            : allBuilds;
          const buildItem = await util.quickPickSingle({
            values: availableBuilds.map((a) => ({ label: a })),
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
      clientRegistry.setConnectionState(clientKey, { cljsBuild: build });

      return evalConnectCode(
        session,
        initCode,
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
    // Get the main session for this connection (identified by clientKey)
    const clientSessions = sessionRegistry.listSessionsByClient(clientKey);
    const mainSessionMeta = clientSessions.find((m) => !m.isSecondary);
    const cljSession = mainSessionMeta
      ? sessionRegistry.getSession(mainSessionMeta.key)
      : sessionRegistry.getSession(roleKeys.primary);
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

  async function handleConnected(result, out, _err): Promise<boolean> {
    if (cljsType.isConnectedRegExp) {
      const isConnectCodeEvaluatedSuccessfully =
        [...out, result].find((x) => {
          return x?.search(cljsType.isConnectedRegExp) >= 0;
        }) != undefined;
      if (!isConnectCodeEvaluatedSuccessfully || !isShadowCljsReplType(cljsType)) {
        return isConnectCodeEvaluatedSuccessfully;
      }
      const runtimesConnected = await waitForShadowCljsRuntimes();
      if (runtimesConnected) {
        await shadowCljsRuntime.detectInitialRuntime();
      }
      return runtimesConnected;
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
          const allBuilds = (await figwheelOrShadowBuilds(cljsTypeName)).filter(
            (build) => !['browser-repl', 'node-repl'].includes(build)
          );

          // Helper to normalize build keys for comparison
          const normalizeBuildKey = (build: string) =>
            build.startsWith(':') ? build.substring(1) : build;
          const normalizedAllBuilds = new Set(allBuilds.map(normalizeBuildKey));

          if (menuSelections && menuSelections.cljsLaunchBuilds) {
            builds = menuSelections.cljsLaunchBuilds;

            // Validate that all specified builds exist in config
            const invalidBuilds = builds.filter(
              (build) => !normalizedAllBuilds.has(normalizeBuildKey(build))
            );
            if (invalidBuilds.length > 0) {
              const invalidList = invalidBuilds.map((b) => `"${b}"`).join(', ');
              const availableList = allBuilds.join(', ');
              output.appendLineOtherErr(
                `Invalid cljsLaunchBuilds: ${invalidList} not found in project config. ` +
                  `Available builds: ${availableList}`
              );
              throw new Error(`Invalid cljsLaunchBuilds configuration`);
            }

            // Validate cljsDefaultBuild if specified
            if (menuSelections.cljsDefaultBuild) {
              const defaultBuild = menuSelections.cljsDefaultBuild;
              const normalizedDefault = normalizeBuildKey(defaultBuild);
              const normalizedSelected = new Set(builds.map(normalizeBuildKey));

              if (!normalizedSelected.has(normalizedDefault)) {
                const selectedList = builds.map((b) => `"${b}"`).join(', ');
                output.appendLineOtherErr(
                  `Invalid cljsDefaultBuild: "${defaultBuild}" is not in cljsLaunchBuilds [${selectedList}]. ` +
                    `The default build must be one of the launched builds.`
                );
                throw new Error(`Invalid cljsDefaultBuild configuration`);
              }
            }
          } else {
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
            clientRegistry.setConnectionState(clientKey, { hasBuilds: true });
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

  replType.started = (_result, out, err): Promise<boolean> => {
    return new Promise((resolve, _reject) => {
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

// Use the extracted pure function from connector-cljs-builds
const isShadowCljsReplType = cljsBuilds.isShadowCljsReplType;

async function makeCljsSessionClone(
  session,
  repl: ReplType,
  projectTypeName: string,
  clientKey: string,
  secondaryKey: string,
  globMap: SessionGlobMap
): Promise<[NReplSession | null, string | null]> {
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
        clientRegistry.setConnectionState(clientKey, { cljsBuild: null });
        return [null, null];
      }
    }
    if (await repl.connect(newCljsSession, repl.name, repl.connected)) {
      return [newCljsSession, clientRegistry.getConnectionState(clientKey)?.cljsBuild ?? null];
    } else {
      const build = clientRegistry.getConnectionState(clientKey)?.cljsBuild ?? null;
      const failed =
        'Failed starting cljs repl' +
        (build != null
          ? ` for build: ${build}. Is the build running and connected?\n   See the Output channel "Calva Connection Log" for any hints on what went wrong.`
          : '');
      output.appendLineOtherOut(failed);
      clientRegistry.setConnectionState(clientKey, { cljsBuild: null });
    }
  }
  return [null, null];
}

type PromptReason = 'connection-failed' | 'no-port-file' | 'manual';

async function promptForNreplUrlAndConnect(
  hostname: string | undefined,
  port: string | undefined,
  connectSequence: ReplConnectSequence,
  reason: PromptReason = 'manual'
): Promise<ConnectResult> {
  let currentHost = hostname ?? 'localhost';
  let currentPort = port;
  let currentReason = reason;

  // Loop until user cancels or connection succeeds
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const promptMessages: Record<PromptReason, string> = {
      'connection-failed': `Could not connect to ${currentHost}:${currentPort}. Enter a different host:port or retry.`,
      'no-port-file': 'No nREPL port file found. Enter host:port for the nREPL server.',
      manual: "Enter port if localhost, otherwise 'hostname:port'",
    };
    const url = await vscode.window.showInputBox({
      title: 'nREPL Connect',
      placeHolder: 'hostname:port',
      prompt: promptMessages[currentReason],
      value: currentHost + ':' + (currentPort ? currentPort : ''),
      ignoreFocusOut: true,
    });

    if (url === undefined) {
      // User dismissed the prompt
      output.appendLineOtherOut('Connect aborted.');
      util.setConnectingState(false);
      status.update();
      return { connected: false };
    }

    const [parsedHostname, parsedPortStr] = url.split(':');
    const parsedPort = parseFloat(parsedPortStr);

    if (!parsedPort || parsedPort <= 0 || parsedPort >= 65536) {
      // Bad URL format - update message and re-prompt
      currentHost = parsedHostname || currentHost;
      currentPort = parsedPortStr || '';
      currentReason = 'connection-failed';
      continue;
    }

    // Try to connect (silently - we'll show our own message on retry)
    setStateValue('hostname', parsedHostname);
    setStateValue('port', parsedPort);
    const result = await connectToHost(parsedHostname, parsedPort, connectSequence, true);

    if (result.connected) {
      return result;
    }

    // Connection failed - update for next iteration
    currentHost = parsedHostname;
    currentPort = parsedPortStr;
    currentReason = 'connection-failed';
  }
}

export async function connect(
  connectSequence: ReplConnectSequence,
  isAutoConnect: boolean,
  hostname?: string,
  port?: string
): Promise<ConnectResult> {
  const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);

  const portFile = projectTypes.nreplPortFileUri(connectSequence);
  void state.extensionContext.workspaceState.update('selectedCljsTypeName', cljsTypeName);
  void state.extensionContext.workspaceState.update('selectedConnectSequence', connectSequence);

  let result: ConnectResult = { connected: false };
  try {
    if (port === undefined) {
      try {
        output.appendLineOtherOut(`Reading port file: ${portFile} ...`);
        await vscode.workspace.fs.stat(portFile);
        const bytes = await vscode.workspace.fs.readFile(portFile);
        port = new TextDecoder('utf-8').decode(bytes);
      } catch {
        if (connectSequence.defaultPort) {
          output.appendLineOtherOut(
            `No nrepl port file found, using default port: ${connectSequence.defaultPort}`
          );
          port = String(connectSequence.defaultPort);
        } else {
          console.info('No nrepl port found');
        }
      }
    }
    if (port) {
      hostname = hostname !== undefined ? hostname : 'localhost';
      output.appendLineOtherOut(`Using host:port ${hostname}:${port} ...`);
      if (isAutoConnect) {
        setStateValue('hostname', hostname);
        setStateValue('port', port);
        result = await connectToHost(hostname, parseInt(port), connectSequence, true);
        if (!result.connected) {
          output.appendLineOtherOut('Prompting for nREPL connection...');
          result = await promptForNreplUrlAndConnect(
            hostname,
            port,
            connectSequence,
            'connection-failed'
          );
        }
      } else {
        result = await promptForNreplUrlAndConnect(undefined, port, connectSequence, 'manual');
      }
    } else {
      output.appendLineOtherOut('No nrepl port file found.');
      result = await promptForNreplUrlAndConnect(undefined, port, connectSequence, 'no-port-file');
    }
    status.update();
  } catch (e) {
    if (!handleConnectError(e)) {
      console.error(e);
    }
    return { connected: false };
  }
  return result;
}

async function standaloneConnect(
  connectSequence: ReplConnectSequence,
  hostname?: string,
  port?: string
) {
  await outputWindow.initReplWindowDoc();
  inspector.revealOnConnect();
  await outputWindow.openReplWindowDoc();

  if (connectSequence) {
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

function handleConnectError(error: unknown): boolean {
  // Handle fruit pool exhaustion error
  if (error instanceof Error && error.message.includes('too many REPLs')) {
    output.appendLineOtherErr(error.message);
    void vscode.window.showErrorMessage(error.message);
    return true;
  }

  return false;
}

// Re-export types from connector-utilities
type DisconnectSelection = connectorUtils.DisconnectSelection;

interface DisconnectQuickPickItem extends vscode.QuickPickItem {
  clientKey?: string;
  disconnectAll?: boolean;
}

function formatRelativeProjectRoot(projectRoot?: string): string | undefined {
  if (!projectRoot) {
    return undefined;
  }
  try {
    const uri = vscode.Uri.parse(projectRoot);
    return getPathRelativeToWorkspace(uri);
  } catch {
    return projectRoot;
  }
}

async function promptForClientDisconnect(
  clients: RegisteredClient[]
): Promise<DisconnectSelection | undefined> {
  const items: DisconnectQuickPickItem[] = clients.map((client) => {
    const sessions = sessionRegistry.listSessionsByClient(client.key);
    const sessionKeys = sessions.map((s) => s.key);

    // Format project root as relative path for readability
    const relativeProjectRoot = formatRelativeProjectRoot(client.projectRoot);

    // Use extracted pure functions for building display strings
    const description = connectorUtils.buildDisconnectItemDescription(
      sessionKeys,
      relativeProjectRoot
    );
    const detail = connectorUtils.buildDisconnectItemDetail(client.host, client.port);
    const label = connectorUtils.buildDisconnectItemLabel({
      key: client.key,
      connectSequenceName: client.connectSequenceName,
      sessionKeys,
    });

    return {
      label,
      description,
      detail,
      clientKey: client.key,
    };
  });

  if (clients.length > 1) {
    items.push({
      label: 'Disconnect all sessions',
      description: 'Tear down every connected REPL client',
      disconnectAll: true,
    });
  }

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select the REPL connection to disconnect',
    canPickMany: false,
  });

  if (!selection) {
    return undefined;
  }

  if (selection.disconnectAll) {
    return { kind: 'all' };
  }

  if (selection.clientKey) {
    return { kind: 'single', clientKey: selection.clientKey };
  }

  return undefined;
}

async function disconnectClientByKey(clientKey: string): Promise<void> {
  if (!clientKey) {
    return;
  }

  const connectionState = clientRegistry.getConnectionState(clientKey);
  if (connectionState?.fruitSuffix) {
    fruitSuffix.releaseFruit(connectionState.fruitSuffix);
  }

  const client = clientRegistry.getClient(clientKey);
  clientRegistry.unregisterClient(clientKey);
  sessionTeardown.teardownSessionsForClient(clientKey);

  if (client) {
    client['silent'] = true;
    try {
      if (state.getProjectRootUri().scheme === 'vsls') {
        client.disconnect();
      } else {
        await client.close();
      }
    } catch (e) {
      console.warn('Failed to close nREPL client cleanly, forcing disconnect.', e);
      client.disconnect();
    }
  }

  const remainingSessions = sessionRegistry.listSessions().length;
  if (remainingSessions === 0) {
    sessionRouting.resetRouting();
    util.setConnectedState(false);
    setStateValue('current-session-type', null);
  } else {
    util.setConnectedState(true);
  }

  liveShareSupport.didDisconnectRepl();
  status.update();
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
    await outputWindow.initReplWindowDoc();
    await outputWindow.openReplWindowDoc();

    if (connectSequence) {
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
    options: { clientKey?: string; disconnectAll?: boolean } | null = null,
    callback = () => {
      // do nothing
    }
  ) => {
    return (async () => {
      const clients = clientRegistry.listClients();
      if (clients.length === 0) {
        callback();
        return;
      }

      let disconnectAll = options?.disconnectAll === true;
      let targetClientKey = options?.clientKey;

      if (!disconnectAll && !targetClientKey && clients.length > 1) {
        const selection = await promptForClientDisconnect(clients);
        if (!selection) {
          return;
        }
        if (selection.kind === 'all') {
          disconnectAll = true;
        } else {
          targetClientKey = selection.clientKey;
        }
      }

      if (disconnectAll) {
        for (const client of [...clients]) {
          await disconnectClientByKey(client.key);
        }
      } else {
        const keyToDisconnect = targetClientKey || clients[0].key;
        await disconnectClientByKey(keyToDisconnect);
      }

      callback();
    })();
  },
  toggleCLJCSession: () => {
    if (!getStateValue('connected')) {
      return;
    }

    const routingInfo = replSession.getRoutingInfo();
    if (!routingInfo) {
      return;
    }

    const clientKey = sessionRegistry.getClientKeyForSession(routingInfo.sessionKey);
    if (!clientKey) {
      return;
    }

    // Check if this connection has both primary and secondary sessions
    const secondaryKey = sessionRegistry.getSecondarySessionKeyForClient(clientKey);
    if (!secondaryKey) {
      // No secondary session, nothing to toggle
      return;
    }

    const currentTarget = clientRegistry.getCljcTargetForConnection(clientKey);
    const newTarget = currentTarget === 'primary' ? 'secondary' : 'primary';
    clientRegistry.setCljcTargetForConnection(clientKey, newTarget);
    replSession.updateReplSessionType();
    status.update();
  },
  selectCljcTarget: async (target?: 'primary' | 'secondary') => {
    if (!getStateValue('connected')) {
      return;
    }

    const routingInfo = replSession.getRoutingInfo();
    if (!routingInfo) {
      return;
    }

    const clientKey = sessionRegistry.getClientKeyForSession(routingInfo.sessionKey);
    if (!clientKey) {
      return;
    }

    // Check if this connection has both primary and secondary sessions
    const secondaryKey = sessionRegistry.getSecondarySessionKeyForClient(clientKey);
    const primaryKey = sessionRegistry.getPrimarySessionKeyForClient(clientKey);
    if (!secondaryKey || !primaryKey) {
      void vscode.window.showInformationMessage(
        'CLJC target selection requires both CLJ and CLJS sessions.'
      );
      return;
    }

    if (target === 'primary' || target === 'secondary') {
      clientRegistry.setCljcTargetForConnection(clientKey, target);
      replSession.updateReplSessionType();
      status.update();
      return;
    }

    // Show picker
    const currentTarget = clientRegistry.getCljcTargetForConnection(clientKey);
    const items = [
      {
        label: currentTarget === 'primary' ? `$(check) ${primaryKey}` : primaryKey,
        description: 'Primary session (CLJ)',
        target: 'primary' as const,
      },
      {
        label: currentTarget === 'secondary' ? `$(check) ${secondaryKey}` : secondaryKey,
        description: 'Secondary session (CLJS)',
        target: 'secondary' as const,
      },
    ];

    const activeDoc = vscode.window.activeTextEditor?.document;
    const activeFilePath = activeDoc
      ? getPathRelativeToWorkspace(activeDoc.uri)
      : 'no file selected';

    const selection = await vscode.window.showQuickPick(items, {
      title: 'Select CLJC Target',
      placeHolder: `Current file: ${activeFilePath}`,
    });

    if (selection) {
      clientRegistry.setCljcTargetForConnection(clientKey, selection.target);
      replSession.updateReplSessionType();
      status.update();
    }
  },
  switchCljsBuild: async () => {
    // Follow the same pattern as shadow-runtime: routed session → connection state → everything
    const routedSessionKey = replSession.getReplSessionTypeFromState();
    if (!routedSessionKey) {
      return;
    }

    const connectionStateData = sessionRegistry.getConnectionStateForSession(routedSessionKey);
    if (!connectionStateData) {
      return;
    }

    const connectSequence = connectionStateData.connectSequence;
    if (!connectSequence || !secondarySession.shouldUseSecondarySession(connectSequence)) {
      return;
    }

    // Get everything from connection state
    const {
      clientKey,
      projectRoot,
      cljsTypeName,
      sessionRoleKeys: roleKeys,
      sessionGlobMap: globMap,
    } = connectionStateData;
    const projectRootUri = projectRoot ? vscode.Uri.parse(projectRoot) : state.getProjectRootUri();

    if (!roleKeys?.secondary || !globMap) {
      output.appendLineOtherErr(
        'Cannot switch build: connection state missing role keys or glob map'
      );
      return;
    }

    // Get the main session for this connection early so we can query active builds
    const cljSession = sessionRegistry.getPrimarySessionForClient(clientKey);
    if (!cljSession) {
      return;
    }

    // Show build selection menu with active build status
    const selectedBuild = await selectCljsBuild(cljsTypeName, projectRootUri, cljSession);
    if (!selectedBuild) {
      return; // User cancelled or no builds available
    }

    const isBuiltinType: boolean = typeof connectSequence.cljsType == 'string';
    const cljsType: CljsTypeConfig = isBuiltinType
      ? getDefaultCljsType(connectSequence.cljsType as string)
      : (connectSequence.cljsType as CljsTypeConfig);

    const replType = createCLJSReplType(
      cljsType,
      projectTypes.getCljsTypeName(connectSequence),
      connectSequence,
      clientKey,
      roleKeys,
      globMap,
      { useDefaultBuild: false, preSelectedBuild: selectedBuild }
    );

    const [cljsSession, build] = await makeCljsSessionClone(
      cljSession,
      replType,
      cljsTypeName,
      clientKey,
      roleKeys.secondary,
      globMap
    );
    if (cljsSession) {
      await setUpCljsRepl(cljsSession, build, roleKeys.secondary, clientKey, globMap);
    }
    status.update();
  },
};
