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
  CljsTypes,
  ReplConnectSequence,
  getDefaultCljsType,
  askForConnectSequence,
  getConnectSequences,
} from './nrepl/connectSequence';
import * as secondarySession from './nrepl/secondary-session';
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
import * as sessionRegistry from './nrepl/session-registry';
import type { SessionKeyStatus } from './nrepl/session-registry';
import * as sessionRoleUtils from './nrepl/session-role-utils';
import type { SessionRoleKeys, SessionGlobMap } from './nrepl/session-role-utils';
import * as sessionRouting from './nrepl/session-routing';
import * as clientRegistry from './nrepl/client-registry';
import type { RegisteredClient } from './nrepl/client-registry';
import * as sessionTeardown from './nrepl/session-teardown';
import { ConflictingSessionsError } from './errors/conflicting-sessions';
import { toGlobMetadata } from './nrepl/globs';
import * as sessionNameResolver from './nrepl/session-name-resolver';
import * as fruitSuffix from './nrepl/fruit-suffix';

const CALVA_DOCS_BASE_URL = 'https://calva.io/';

export function deriveRequestedSessionKeys(
  sessionRoleKeys: SessionRoleKeys,
  connectSequence: ReplConnectSequence,
  useSecondarySession: boolean
): string[] {
  const keys = [sessionRoleKeys.primary];
  if (
    useSecondarySession &&
    sessionRoleKeys.secondary &&
    connectSequence.cljsType &&
    connectSequence.cljsType !== 'none'
  ) {
    keys.push(sessionRoleKeys.secondary);
  }
  return keys.filter((key): key is string => Boolean(key));
}

function formatConflictDetails(conflicts: SessionKeyStatus[]): string {
  if (conflicts.length === 0) {
    return '';
  }

  return conflicts
    .map((conflict) => {
      const label = conflict.key;
      const project = conflict.metadata?.projectRoot ? ` – ${conflict.metadata.projectRoot}` : '';
      const globInfo = conflict.metadata?.globs?.length
        ? ` [globs: ${conflict.metadata.globs.join(', ')}]`
        : '';
      return `${label} (${conflict.key})${project}${globInfo}`;
    })
    .join('\n');
}

function getSessionGlobMetadata(sessionKey: string, globMap: SessionGlobMap) {
  const tiers = sessionRoleUtils.getGlobTiersFromMap(globMap, sessionKey);
  return toGlobMetadata(tiers);
}

export function ensureSessionAssignmentsAvailable(
  requestedKeys: string[],
  clientKey: string
): void {
  if (!clientKey || requestedKeys.length === 0) {
    return;
  }

  const analysis = sessionRegistry.analyzeSessionAssignments(requestedKeys, clientKey);
  if (analysis.summary !== 'conflict') {
    return;
  }

  const conflicts = analysis.statuses.filter((status) => status.occupancy === 'conflict');
  const detailText = formatConflictDetails(conflicts);
  const message = [
    'Cannot connect because these session names are already in use by another Calva connection.',
    detailText,
    'Update the connect sequence to use unique session names or disconnect the other REPL first.',
  ]
    .filter(Boolean)
    .join('\n');

  throw new ConflictingSessionsError(message, conflicts);
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
  let mainSession: NReplSession;
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
    clientRegistry.registerClient(nClient, {
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
    clientRegistry.setActiveClientKey(nClient.clientKey);
    nClient.addOnCloseHandler((c) => {
      const wasRegistered = clientRegistry.unregisterClient(c.clientKey);
      if (wasRegistered) {
        sessionTeardown.teardownSessionsForClient(c.clientKey);
      }

      const remainingSessions = sessionRegistry.listSessions().length;
      util.setConnectedState(remainingSessions > 0);
      util.setConnectingState(false);
      if (!c['silent']) {
        output.appendLineOtherOut('nREPL Connection was closed');
      }
      nClient = clientRegistry.getActiveClient();
      status.update();
      calvaDebug.terminateDebugSession();
    });
    mainSession = nClient.session;
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

    status.update();
    output.appendLineOtherOut(`Connected session: ${mainKey}`);
    replSession.updateReplSessionType();

    outputWindow.setSession(mainSession, nClient.ns, mainKey);

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

    clojureDocs.init(mainSession);

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
          nClient.clientKey,
          sessionRoleKeys,
          sessionGlobMap
        );

        [cljsSession, cljsBuild] = await makeCljsSessionClone(
          mainSession,
          translatedReplType,
          connectSequence.name,
          nClient.clientKey,
          sessionRoleKeys.secondary,
          sessionGlobMap
        );
        void state.analytics().logGA4Pageview('/connected-cljs-repl');
      }
      if (cljsSession && sessionRoleKeys.secondary) {
        await setUpCljsRepl(cljsSession, cljsBuild, sessionRoleKeys.secondary, sessionGlobMap);
      }
      if (useSecondarySession && isShadowCljsReplType(connectSequence.cljsType)) {
        await shadowCljsRuntime.initializeShadowRemoteNotifications();
      }
    } catch (e) {
      output.appendLineOtherErr('Error while connecting cljs REPL: ' + e);
    }

    status.update();
  } catch (e) {
    if (e instanceof ConflictingSessionsError) {
      util.setConnectingState(false);
      util.setConnectedState(false);
      status.update();
      if (nClient) {
        clientRegistry.unregisterClient(nClient.clientKey);
      }
      if (nClient) {
        try {
          await nClient.close();
        } catch (closeError) {
          console.warn('Failed closing nREPL client after conflict:', closeError);
          nClient.disconnect();
        } finally {
          nClient = clientRegistry.getActiveClient();
        }
      }
      throw e;
    }
    return cleanUpAfterError(e, nClient?.clientKey);
  }

  void liveShareSupport.didConnectRepl(port);

  await readRuntimeConfigs();

  return true;
}

function cleanUpAfterError(e: any, clientKeyToRemove?: string) {
  if (clientKeyToRemove) {
    clientRegistry.unregisterClient(clientKeyToRemove);
    sessionTeardown.teardownSessionsForClient(clientKeyToRemove);
    if (nClient && nClient.clientKey === clientKeyToRemove) {
      nClient = clientRegistry.getActiveClient();
    }
  }
  util.setConnectingState(false);
  util.setConnectedState(sessionRegistry.listSessions().length > 0);
  output.appendLineOtherErr('Failed connecting.');
  console.error('Failed connecting:', e);
  status.update();
  return false;
}

async function setUpCljsRepl(
  session: NReplSession,
  build: string | null,
  cljsKey: string,
  globMap: SessionGlobMap
) {
  const globMetadata = getSessionGlobMetadata(cljsKey, globMap);
  sessionRegistry.registerSession(cljsKey, session, {
    projectRoot: state.getProjectRootUri().toString(),
    globs: globMetadata.globs,
    globSpecs: globMetadata.globSpecs,
    isSecondary: true,
  });

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
  secondaryKey: string,
  globMap: SessionGlobMap,
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
    // Update the session in the registry
    const globMetadata = getSessionGlobMetadata(secondaryKey, globMap);
    sessionRegistry.registerSession(secondaryKey, newCljsSession, {
      projectRoot: state.getProjectRootUri().toString(),
      globs: globMetadata.globs,
      globSpecs: globMetadata.globSpecs,
      isSecondary: true,
    });

    cljsSession = newCljsSession;
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
    let code: string;
    if (cljsTypeName.includes('shadow-cljs')) {
      code = '(mapv str (shadow.cljs.devtools.api/active-builds))';
    } else if (cljsTypeName.includes('Figwheel Main')) {
      code = '(vec (keys @figwheel.main/build-registry))';
    } else {
      return undefined;
    }

    const result = await session.eval(code, 'user').value;
    if (result) {
      // Parse the Clojure vector result, e.g. '[:app :app-too]' or '[":app" ":app-too"]'
      const parsed = result
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(/\s+/)
        .map((s) => s.trim())
        .map((s) => s.replace(/^"|"$/g, '')) // Strip quotes from string results
        .filter((s) => s.length > 0);
      return parsed;
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

  // Builds that don't require watchers (always available)
  const noWatcherRequired = ['node-repl', 'browser-repl'];

  // Helper to normalize build keys for comparison
  const normalizeBuildKey = (build: string) => (build.startsWith(':') ? build.substring(1) : build);

  // Create picker items with status information
  const pickerItems: util.CalvaQuickPickItem[] = allBuilds.map((build) => {
    const buildKey = normalizeBuildKey(build);
    const isNoWatcherBuild = noWatcherRequired.includes(buildKey);
    const isActive =
      isNoWatcherBuild ||
      !activeBuilds ||
      activeBuilds.some((ab) => normalizeBuildKey(ab) === buildKey);

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
        name,
        checkFn,
        secondaryKey,
        globMap,
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

  async function handleConnected(result, out, err): Promise<boolean> {
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
              name,
              checkFn,
              secondaryKey,
              globMap,
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
            secondaryKey,
            globMap,
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

function isShadowCljsReplType(cljsType: CljsTypeConfig | CljsTypes): boolean {
  if (typeof cljsType === 'string') {
    return cljsType === 'shadow-cljs';
  }

  if (typeof cljsType === 'object' && cljsType !== null) {
    return cljsType.name === 'shadow-cljs' || cljsType.dependsOn === 'shadow-cljs';
  }

  return false;
}

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
      // Update registry
      const globMetadata = getSessionGlobMetadata(secondaryKey, globMap);
      sessionRegistry.registerSession(secondaryKey, newCljsSession, {
        projectRoot: state.getProjectRootUri().toString(),
        globs: globMetadata.globs,
        globSpecs: globMetadata.globSpecs,
        isSecondary: true,
      });

      cljsSession = newCljsSession;
      return [cljsSession, clientRegistry.getConnectionState(clientKey)?.cljsBuild ?? null];
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
    if (!handleConnectError(e)) {
      console.error(e);
    }
    return false;
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

function buildDocsUrl(slug?: string): string {
  if (!slug) {
    return CALVA_DOCS_BASE_URL;
  }
  const normalizedSlug = slug.startsWith('/') ? slug.slice(1) : slug;
  return `${CALVA_DOCS_BASE_URL}${normalizedSlug}`;
}

function handleConnectError(error: unknown): boolean {
  if (error instanceof ConflictingSessionsError) {
    const docUrl = buildDocsUrl(error.docSlug);
    const openDocsLabel = 'Open multi-session docs';
    output.appendLineOtherErr(error.message);
    void vscode.window.showErrorMessage(error.message, openDocsLabel).then((choice) => {
      if (choice === openDocsLabel) {
        void vscode.commands.executeCommand('simpleBrowser.show', docUrl);
      }
    });
    return true;
  }

  // Handle fruit pool exhaustion error
  if (error instanceof Error && error.message.includes('too many REPLs')) {
    output.appendLineOtherErr(error.message);
    void vscode.window.showErrorMessage(error.message);
    return true;
  }

  return false;
}

interface DisconnectSelectionAll {
  kind: 'all';
}

interface DisconnectSelectionSingle {
  kind: 'single';
  clientKey: string;
}

type DisconnectSelection = DisconnectSelectionAll | DisconnectSelectionSingle;

interface DisconnectQuickPickItem extends vscode.QuickPickItem {
  clientKey?: string;
  disconnectAll?: boolean;
}

function buildDisconnectItemLabel(client: RegisteredClient): string {
  const label = client.connectSequenceName || client.key;
  return label;
}

async function promptForClientDisconnect(
  clients: RegisteredClient[]
): Promise<DisconnectSelection | undefined> {
  const items: DisconnectQuickPickItem[] = clients.map((client) => {
    const sessions = sessionRegistry.listSessionsByClient(client.key);
    const sessionSummary = sessions.length
      ? sessions.map((s) => s.key).join(', ')
      : 'No sessions registered';
    const detailSegments = [];
    if (client.host) {
      detailSegments.push(`${client.host}${client.port ? ':' + client.port : ''}`);
    }
    if (client.projectRoot) {
      detailSegments.push(client.projectRoot);
    }
    return {
      label: buildDisconnectItemLabel(client),
      description: sessionSummary,
      detail: detailSegments.join(' · ') || undefined,
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

  nClient = clientRegistry.getActiveClient();
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

    const sessions = sessionRegistry.listSessions();
    if (sessions.length === 0) {
      return;
    }

    const currentOverride = sessionRouting.getCljcSessionKey();
    const referenceKey = currentOverride ?? replSession.getReplSessionTypeFromState();
    const currentIndex = referenceKey ? sessions.findIndex((s) => s.key === referenceKey) : -1;
    const nextIndex = (currentIndex + 1) % sessions.length;
    const nextSessionMeta = sessions[nextIndex];

    sessionRouting.setCljcSessionKey(nextSessionMeta.key);
    status.update();
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
      await setUpCljsRepl(cljsSession, build, roleKeys.secondary, globMap);
    }
    status.update();
  },
};
