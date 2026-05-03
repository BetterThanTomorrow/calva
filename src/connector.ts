import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as state from './state';
import * as util from './utilities';
import * as string from './util/string';
import open = require('open');
import * as status from './status';
import * as projectTypes from './nrepl/project-types';
import * as nrepl from './nrepl';
import * as nReplWsServer from './nrepl/nrepl-ws-server';
import * as shadowCljsRuntime from './shadow-cljs-runtime';
import * as jackIn from './nrepl/jack-in';
import * as connectSequenceInheritance from './nrepl/connect-sequence-inheritance';
import * as connectSequences from './nrepl/connectSequence';
import * as secondarySession from './nrepl/secondary-session';
import * as printer from './printer';
import * as outputWindow from './repl-window/repl-window-doc';
import * as resultsOutputUtil from './results-output/util';
import * as evaluate from './evaluate';
import * as liveShareSupport from './live-share';
import * as calvaDebug from './debugger/calva-debug';
import * as cljsLib from '../out/cljs-lib/cljs-lib';
import * as replSession from './nrepl/repl-session';
import * as clojureDocs from './clojuredocs';
import * as config from './config';
import * as connectTypes from './nrepl/connect-types';
import * as output from './results-output/output';
import * as inspector from './providers/inspector';
import * as sessionRegistry from './nrepl/session-registry';
import * as sessionRoleUtils from './nrepl/session-role-utils';
import * as sessionRouting from './nrepl/session-routing';
import * as clientRegistry from './nrepl/client-registry';
import * as sessionTeardown from './nrepl/session-teardown';
import * as clientTeardown from './nrepl/client-teardown';
import type * as globs from './nrepl/globs';
import * as sessionNameResolver from './nrepl/session-name-resolver';
import * as projectRootUtil from './project-root';
import * as cljsBuilds from './connector-cljs-builds';
import * as connectorUtils from './connector-utilities';

function getSessionGlobMetadata(
  sessionKey: string,
  globMap: sessionRoleUtils.SessionGlobMap
): { globSpecs: globs.SessionGlobSpec[]; globs: string[] } {
  const globSpecs = sessionRoleUtils.getGlobSpecsFromMap(globMap, sessionKey);
  return {
    globSpecs,
    globs: globSpecs.map((spec) => spec.pattern),
  };
}

async function readRuntimeConfigs(session: nrepl.NReplSession) {
  const classpath = await session.classpath().catch((e) => {
    console.error('readRuntimeConfigs:', e);
  });
  if (classpath) {
    const configs = classpath.classpath.map(async (element: string) => {
      if (element.endsWith('.jar')) {
        const edn = await util.getJarContents(element.concat('!/calva.exports/config.edn'));
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
      .map(([_, config]) => config.addEdnConfig(config));
  }
}

interface ConnectResult {
  connected: boolean;
  clientKey?: string;
}

/**
 * Connect via a WebSocket server that the browser REPL connects to.
 * Starts a WS server, waits for browser connection, then registers sessions.
 * Handles browser disconnect/reconnect lifecycle automatically.
 */
async function connectViaWebSocket(
  wsPort: number,
  wsHost: string,
  connectSequence: connectSequences.ReplConnectSequence,
  isJackIn = false
): Promise<ConnectResult> {
  let activeClient: nrepl.NReplClient | undefined;
  const baseSessionNames = sessionRoleUtils.deriveSessionRoleKeys(connectSequence);
  const projectRootPath = state.getProjectRootUri().fsPath;
  const projectRoot = state.getProjectRootUri().toString();
  const useSecondarySession = secondarySession.shouldUseSecondarySession(connectSequence);

  const resolution = sessionNameResolver.resolveSessionNames(
    baseSessionNames,
    projectRoot,
    wsHost,
    isJackIn ? null : wsPort
  );
  const sessionRoleKeys = resolution.finalNames;

  if (resolution.reconnectClientKey) {
    output.appendLineOtherOut(
      `Reconnecting: disconnecting existing client for sessions: ${Object.values(sessionRoleKeys)
        .filter(Boolean)
        .join(', ')}`
    );
    if (isJackIn) {
      await jackIn.stopJackInProcessesByClientKey(resolution.reconnectClientKey, {
        preserveSuffix: true,
      });
    }
    if (clientRegistry.getClient(resolution.reconnectClientKey)) {
      await disconnectClientByKey(resolution.reconnectClientKey, { preserveSuffix: true });
    }
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
    // Start WebSocket server with port conflict retry
    let server: nReplWsServer.NReplWsServer | undefined;
    let currentPort = wsPort;
    while (!server) {
      try {
        server = await nReplWsServer.startNReplWsServer(currentPort, wsHost);
      } catch (e) {
        if (e instanceof nReplWsServer.WsPortInUseError) {
          const newPort = await vscode.window.showInputBox({
            prompt: `WebSocket port ${currentPort} is in use. Enter a different port:`,
            value: String(currentPort),
            ignoreFocusOut: true,
            validateInput: (v) => {
              const n = parseInt(v);
              return isNaN(n) || n < 1 || n > 65535 ? 'Enter a valid port number' : undefined;
            },
          });
          if (newPort === undefined) {
            util.setConnectingState(false);
            return { connected: false };
          }
          currentPort = parseInt(newPort);
        } else {
          throw e;
        }
      }
    }

    output.appendLineOtherOut(`WebSocket server listening on ws://${wsHost}:${currentPort}/_nrepl`);
    output.appendLineOtherOut('Waiting for browser REPL to connect...');

    const sessionKeyValues = Object.values(sessionRoleKeys).filter(Boolean) as string[];
    nReplWsServer.trackServer(server, connectSequence.name, projectRoot, sessionKeyValues);

    // Track first connection to resolve the initial await
    let resolveFirstConnection: (() => void) | null = null;
    const firstConnectionPromise = new Promise<void>((resolve) => {
      resolveFirstConnection = resolve;
    });

    /**
     * Register a new NReplClient for the currently-connected browser and
     * set up sessions, CLJS, and all post-connect initialization.
     */
    const registerBrowserClient = async () => {
      const client = nrepl.NReplClient.createFromWebSocket({
        server,
        onError: (e) => {
          output.appendLineOtherErr(`WebSocket connection error: ${e}`);
        },
      });
      activeClient = client;

      clientRegistry.registerClient(client, {
        connectSequenceName: connectSequence.name,
        projectRoot,
        host: wsHost,
        port: currentPort,
        connectionState: {
          cljsBuild: null,
          cljsTypeName: projectTypes.getCljsTypeName(connectSequence),
          hasBuilds: false,
          sessionRoleKeys,
          sessionGlobMap,
          connectSequence,
          baseSessionNames,
          suffix: resolution.suffix,
        },
      });

      const mainSession = client.session;
      mainSession.replType = 'clj';
      util.setConnectingState(false);
      util.setConnectedState(true);
      void state.analytics().logGA4Pageview('/connected-clj-repl');

      const mainKey = sessionRoleKeys.primary;
      const mainGlobMetadata = getSessionGlobMetadata(mainKey, sessionGlobMap);
      sessionRegistry.registerSession(mainKey, mainSession, {
        projectRoot,
        globs: mainGlobMetadata.globs,
        globSpecs: mainGlobMetadata.globSpecs,
      });
      clientRegistry.setCljcTargetForConnection(client.clientKey, 'primary');

      status.update();
      output.appendLineOtherOut(`Connected session: ${mainKey}, ws://${wsHost}:${currentPort}`);
      replSession.updateReplSessionType();

      outputWindow.setSession(mainSession, client.ns, mainKey);

      if (config.getConfig().autoEvaluateCode.onConnect.clj) {
        output.appendLineOtherOut(
          `Evaluating code from settings: 'calva.autoEvaluateCode.onConnect.clj'`
        );
        await evaluate.evaluateInOutputWindow(
          config.getConfig().autoEvaluateCode.onConnect.clj,
          mainKey,
          outputWindow.getNs(),
          {}
        );
      }
      void output.replWindowAppendPrompt();

      const afterMainReplCode =
        connectSequence.afterPrimaryReplConnectedCode ?? connectSequence.afterCLJReplJackInCode;
      if (afterMainReplCode) {
        output.appendLineOtherOut(`Evaluating 'afterPrimaryReplConnectedCode'`);
        await evaluate.evaluateInOutputWindow(afterMainReplCode, mainKey, outputWindow.getNs(), {});
      }
      if (!connectSequence.cljsType || connectSequence.cljsType === 'none') {
        output.maybePrintLegacyREPLWindowOutputMessage();
      }
      void output.replWindowAppendPrompt();

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
          const cljsType: connectSequences.CljsTypeConfig = isBuiltinType
            ? connectSequences.getDefaultCljsType(connectSequence.cljsType as string)
            : (connectSequence.cljsType as connectSequences.CljsTypeConfig);

          const connector = createCljsReplConnector(
            cljsType,
            projectTypes.getCljsTypeName(connectSequence),
            connectSequence,
            client.clientKey,
            sessionRoleKeys,
            sessionGlobMap
          );

          [cljsSession, cljsBuild] = await makeCljsSessionClone(
            mainSession,
            connector,
            connectSequence.name,
            client.clientKey
          );
          void state.analytics().logGA4Pageview('/connected-cljs-repl');
        }
        if (cljsSession && sessionRoleKeys.secondary) {
          await setUpCljsRepl(
            cljsSession,
            cljsBuild,
            sessionRoleKeys.secondary,
            client.clientKey,
            sessionGlobMap
          );
        }
      } catch (e) {
        output.appendLineOtherErr('Error while connecting cljs REPL: ' + e);
      }

      status.update();
    };

    // Wire server events once — they use `activeClient` for dispatch
    server.onMessage((ednString) => {
      if (activeClient) {
        activeClient.handleIncomingMessage(ednString);
      }
    });

    server.onClientDisconnected(() => {
      // Guard: if server was stopped (user disconnect), don't try to reconnect
      if (!server.isListening()) {
        return;
      }
      if (activeClient) {
        const clientKey = activeClient.clientKey;
        output.appendLineOtherOut('Browser REPL disconnected, waiting for reconnection...');
        state.connectionLogChannel().appendLine('Browser REPL disconnected');

        // Clean up client and sessions but keep server alive
        clientTeardown.releaseClientSuffix(clientKey);
        const wasRegistered = clientRegistry.unregisterClient(clientKey);
        if (wasRegistered) {
          sessionTeardown.teardownSessionsForClient(clientKey);
        }
        activeClient = undefined;

        const remainingSessions = sessionRegistry.listSessions().length;
        util.setConnectedState(remainingSessions > 0);
        status.update();
      }
    });

    server.onClientConnected(() => {
      output.appendLineOtherOut('Browser REPL connected');
      state.connectionLogChannel().appendLine('Browser REPL connected');
      void registerBrowserClient().then(() => {
        if (resolveFirstConnection) {
          resolveFirstConnection();
          resolveFirstConnection = null;
        }
      });
    });

    server.onError((e) => {
      console.error('WebSocket server error:', e);
      state.connectionLogChannel().appendLine(`WebSocket error: ${e.message}`);
    });

    // Wait for the first browser connection with a cancellable progress notification
    const connected = await new Promise<boolean>((resolve) => {
      void vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Waiting for browser REPL on ws://${wsHost}:${currentPort}/_nrepl`,
          cancellable: true,
        },
        async (_progress, token) => {
          token.onCancellationRequested(async () => {
            output.appendLineOtherOut('WebSocket connection cancelled by user.');
            nReplWsServer.untrackServer(server);
            await server.stop();
            resolve(false);
          });
          await firstConnectionPromise;
          if (!token.isCancellationRequested) {
            resolve(true);
          }
        }
      );
    });

    if (!connected) {
      util.setConnectingState(false);
      return { connected: false };
    }
  } catch (e) {
    return cleanUpAfterError(e, {
      clientKey: activeClient?.clientKey,
      suffix: resolution.suffix,
      client: activeClient,
    });
  }

  return { connected: true, clientKey: activeClient.clientKey };
}

async function connectToHost(
  hostname: string,
  port: number,
  connectSequence: connectSequences.ReplConnectSequence,
  silent = false,
  isJackIn = false
): Promise<ConnectResult> {
  let mainSession: nrepl.NReplSession;
  let localClient: nrepl.NReplClient | undefined;
  const baseSessionNames = sessionRoleUtils.deriveSessionRoleKeys(connectSequence);
  const projectRootPath = state.getProjectRootUri().fsPath;
  const projectRoot = state.getProjectRootUri().toString();
  const useSecondarySession = secondarySession.shouldUseSecondarySession(connectSequence);

  const resolution = sessionNameResolver.resolveSessionNames(
    baseSessionNames,
    projectRoot,
    hostname,
    isJackIn ? null : port
  );
  const sessionRoleKeys = resolution.finalNames;

  if (resolution.reconnectClientKey) {
    output.appendLineOtherOut(
      `Reconnecting: disconnecting existing client for sessions: ${Object.values(sessionRoleKeys)
        .filter(Boolean)
        .join(', ')}`
    );
    // For jack-in reconnections: stop old jack-in processes to prevent orphaned REPLs
    // (This handles the case where sequence names differ but sessions match)
    // For manual reconnections: keep existing jack-in processes running
    if (isJackIn) {
      await jackIn.stopJackInProcessesByClientKey(resolution.reconnectClientKey, {
        preserveSuffix: true,
      });
    }
    // Disconnect the old client but preserve suffix for reuse
    // Check if client still exists (jack-in cleanup may have already disconnected it)
    if (clientRegistry.getClient(resolution.reconnectClientKey)) {
      await disconnectClientByKey(resolution.reconnectClientKey, { preserveSuffix: true });
    }
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
    localClient = await nrepl.NReplClient.create({
      host: hostname,
      port: +port,
      onError: (e) => {
        output.appendLineOtherErr(`nREPL connection failed, port ${port}: ${e}`);
        const scheme = state.getProjectRootUri().scheme;
        if (scheme === 'vsls') {
          output.appendLineOtherOut('Did the host share the nREPL port?');
        }
        // Clean up acquired suffix since client wasn't registered
        return cleanUpAfterError(e, { suffix: resolution.suffix });
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
        suffix: resolution.suffix,
      },
    });
    localClient.addOnCloseHandler((c) => {
      // Attempt to release suffix. This will be a no-op if:
      // 1. The suffix was marked as preserved (reconnection scenario)
      // 2. The client was already unregistered (disconnectClientByKey flow)
      clientTeardown.releaseClientSuffix(c.clientKey);
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
      projectRoot,
      globs: mainGlobMetadata.globs,
      globSpecs: mainGlobMetadata.globSpecs,
    });
    clientRegistry.setCljcTargetForConnection(localClient.clientKey, 'primary');

    status.update();
    output.appendLineOtherOut(`Connected session: ${mainKey}, port: ${port}`);
    replSession.updateReplSessionType();

    outputWindow.setSession(mainSession, localClient.ns, mainKey);

    if (config.getConfig().autoEvaluateCode.onConnect.clj) {
      output.appendLineOtherOut(
        `Evaluating code from settings: 'calva.autoEvaluateCode.onConnect.clj'`
      );
      await evaluate.evaluateInOutputWindow(
        config.getConfig().autoEvaluateCode.onConnect.clj,
        mainKey,
        outputWindow.getNs(),
        {}
      );
    }
    void output.replWindowAppendPrompt();

    const afterMainReplCode =
      connectSequence.afterPrimaryReplConnectedCode ?? connectSequence.afterCLJReplJackInCode;
    if (afterMainReplCode) {
      output.appendLineOtherOut(`Evaluating 'afterPrimaryReplConnectedCode'`);
      await evaluate.evaluateInOutputWindow(afterMainReplCode, mainKey, outputWindow.getNs(), {});
    }
    if (!connectSequence.cljsType || connectSequence.cljsType === 'none') {
      output.maybePrintLegacyREPLWindowOutputMessage();
    }
    void output.replWindowAppendPrompt();

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
        const cljsType: connectSequences.CljsTypeConfig = isBuiltinType
          ? connectSequences.getDefaultCljsType(connectSequence.cljsType as string)
          : (connectSequence.cljsType as connectSequences.CljsTypeConfig);

        const connector = createCljsReplConnector(
          cljsType,
          projectTypes.getCljsTypeName(connectSequence),
          connectSequence,
          localClient.clientKey,
          sessionRoleKeys,
          sessionGlobMap
        );

        [cljsSession, cljsBuild] = await makeCljsSessionClone(
          mainSession,
          connector,
          connectSequence.name,
          localClient.clientKey
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
      if (useSecondarySession && isShadowCljsConnector(connectSequence.cljsType)) {
        await shadowCljsRuntime.initializeShadowRemoteNotifications();
      }
    } catch (e) {
      output.appendLineOtherErr('Error while connecting cljs REPL: ' + e);
    }

    status.update();
  } catch (e) {
    return cleanUpAfterError(e, {
      clientKey: localClient?.clientKey,
      suffix: resolution.suffix,
      client: localClient,
      silent,
    });
  }

  void liveShareSupport.didConnectRepl(port);

  await readRuntimeConfigs(mainSession);

  // Post-connect initialization
  calvaDebug.initializeDebugger(mainSession);
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
  if (config.getConfig().redirectServerOutputToRepl && mainSession.supports('out-subscribe')) {
    void mainSession.outSubscribe();
  }

  return { connected: true, clientKey: localClient.clientKey };
}

/**
 * Clean up connection state after a connection error.
 *
 * Handles three scenarios:
 * 1. Error before client exists but after suffix acquired (pass suffix)
 * 2. Error after client registered (pass clientKey and client)
 * 3. Error before any resources acquired (no params needed)
 *
 * @param e - The error that occurred
 * @param options - Optional cleanup parameters
 * @param options.clientKey - Client key to clean up (if client was registered)
 * @param options.suffix - Suffix to release (if acquired before client registration)
 * @param options.client - NReplClient to close (always closed if provided)
 * @param options.silent - Whether to suppress error message output
 */
function cleanUpAfterError(
  e: any,
  options: {
    clientKey?: string;
    suffix?: string;
    client?: nrepl.NReplClient;
    silent?: boolean;
  } = {}
): ConnectResult {
  const { clientKey, suffix: directSuffix, client, silent = false } = options;

  // Release suffix - either via client connection state or directly
  if (clientKey) {
    clientTeardown.releaseClientSuffix(clientKey);
    clientRegistry.unregisterClient(clientKey);
    sessionTeardown.teardownSessionsForClient(clientKey);
  } else if (directSuffix) {
    // Suffix was acquired but client wasn't registered yet
    clientTeardown.releaseSuffixDirectly(directSuffix);
  }

  // Close socket if client exists (whether registered or not)
  if (client) {
    try {
      client.disconnect();
    } catch (closeError) {
      console.warn('Failed to close client socket during error cleanup:', closeError);
    }
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
  session: nrepl.NReplSession,
  build: string | null,
  cljsKey: string,
  clientKey: string,
  globMap: sessionRoleUtils.SessionGlobMap
) {
  const globMetadata = getSessionGlobMetadata(cljsKey, globMap);
  // Use project root from owning client to avoid stamping wrong root when multiple connections exist
  const projectRoot =
    clientRegistry.getRegisteredClient(clientKey)?.projectRoot ??
    state.getProjectRootUri().toString();
  sessionRegistry.registerSession(cljsKey, session, {
    projectRoot,
    globs: globMetadata.globs,
    globSpecs: globMetadata.globSpecs,
    isSecondary: true,
  });
  clientRegistry.setCljcTargetForConnection(clientKey, 'secondary');

  clojureDocs.probeAndSetSession(session, cljsKey);

  status.update();
  output.appendLineOtherOut(`Connected session: ${cljsKey}${build ? ', repl: ' + build : ''}`);
  outputWindow.appendLine(
    resultsOutputUtil.formatAsLineComments(outputWindow.CLJS_CONNECT_GREETINGS)
  );
  const description = await session.describe(true);
  const ns = description.aux?.['current-ns'] || 'user';
  await session.eval(`(in-ns '${ns})`, 'user').value;
  outputWindow.setSession(session, ns, cljsKey);
  if (config.getConfig().autoEvaluateCode.onConnect.cljs) {
    output.appendLineOtherOut(
      `Evaluating code from settings: 'calva.autoEvaluateCode.onConnect.cljs'`
    );
    await evaluate.evaluateInOutputWindow(
      config.getConfig().autoEvaluateCode.onConnect.cljs,
      cljsKey,
      ns,
      {}
    );
    output.maybePrintLegacyREPLWindowOutputMessage();
    void output.replWindowAppendPrompt();
  }
  replSession.updateReplSessionType();
}

async function getFigwheelMainBuilds(projectRootUri?: vscode.Uri) {
  const effectiveRoot = projectRootUri ?? state.getProjectRootUri();
  const res = await vscode.workspace.fs.readDirectory(effectiveRoot);
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
  session: nrepl.NReplSession,
  name: string,
  checkSuccess: checkConnectedFn
) => Promise<boolean | undefined>;

async function evalConnectCode(
  newCljsSession: nrepl.NReplSession,
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
      pprintOptions: printer.disabledPrettyPrinter,
    });
  const valueResult = await result.value.catch((reason) => {
    console.error('Error evaluating connect form: ', reason);
  });
  return await checkSuccess(valueResult, out, err);
}

export interface CljsReplConnector {
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
    return await getFigwheelMainBuilds(projectRootUri);
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
  session: nrepl.NReplSession
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
  session?: nrepl.NReplSession
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

function createCljsReplConnector(
  cljsType: connectSequences.CljsTypeConfig,
  cljsTypeName: string,
  connectSequence: connectSequences.ReplConnectSequence,
  clientKey: string,
  roleKeys: sessionRoleUtils.SessionRoleKeys,
  options: { useDefaultBuild?: boolean; preSelectedBuild?: string } = {}
): CljsReplConnector {
  // This function is only called when a secondary session is expected
  const cljsSessionKey = roleKeys.secondary;
  if (!cljsSessionKey) {
    throw new Error('createCljsReplConnector called without secondary session key');
  }

  // Get project root from client registry to avoid using global state
  const clientProjectRoot =
    clientRegistry.getRegisteredClient(clientKey)?.projectRoot ??
    state.getProjectRootUri().toString();
  const clientProjectRootUri = vscode.Uri.parse(clientProjectRoot);

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

  const connector: CljsReplConnector = {
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
          const allBuilds = await figwheelOrShadowBuilds(cljsTypeName, clientProjectRootUri);
          const availableBuilds = startedBuilds
            ? [
                ...startedBuilds,
                ...allBuilds.filter((b) => ['node-repl', 'browser-repl'].includes(b)),
              ]
            : allBuilds;
          const buildItem = await util.quickPickSingle({
            values: availableBuilds.map((a) => ({ label: a })),
            placeHolder: 'Select which build to connect to',
            saveAs: `${clientProjectRoot}/${cljsTypeName.replace(' ', '-')}-build`,
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
      if (!isConnectCodeEvaluatedSuccessfully || !isShadowCljsConnector(cljsType)) {
        return isConnectCodeEvaluatedSuccessfully;
      }
      const runtimesConnected = await waitForShadowCljsRuntimes();
      if (runtimesConnected) {
        await shadowCljsRuntime.detectInitialRuntime(clientKey);
      }
      return runtimesConnected;
    } else {
      return true;
    }
  }

  if (cljsType.startCode && shouldRunStartCode) {
    connector.start = async (session, name, checkFn) => {
      let startCode = cljsType.startCode;
      if (!hasStarted) {
        if (startCode.includes('%BUILDS')) {
          let builds: string[];
          const allBuilds = (
            await figwheelOrShadowBuilds(cljsTypeName, clientProjectRootUri)
          ).filter((build) => !['browser-repl', 'node-repl'].includes(build));

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
                saveAs: `${clientProjectRoot}/${cljsTypeName.replace(' ', '-')}-builds`,
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

  connector.started = (_result, out, err): Promise<boolean> => {
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

  return connector;
}

// Use the extracted pure function from connector-cljs-builds
const isShadowCljsConnector = cljsBuilds.isShadowCljsConnector;

async function makeCljsSessionClone(
  session,
  connector: CljsReplConnector,
  projectTypeName: string,
  clientKey: string
): Promise<[nrepl.NReplSession | null, string | null]> {
  output.appendLineOtherOut('Creating cljs repl session...');
  let newCljsSession = await session.clone();
  newCljsSession.replType = 'cljs';
  if (newCljsSession) {
    output.appendLineOtherOut('Connecting cljs repl: ' + projectTypeName + '...');
    if (connector.start != undefined) {
      if (await connector.start(newCljsSession, connector.name, connector.started)) {
        output.appendLineOtherOut('Cljs builds started');
        newCljsSession = await session.clone();
        newCljsSession.replType = 'cljs';
      } else {
        output.appendLineOtherErr('Failed starting cljs repl');
        clientRegistry.setConnectionState(clientKey, { cljsBuild: null });
        return [null, null];
      }
    }
    if (await connector.connect(newCljsSession, connector.name, connector.connected)) {
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

type PromptReason =
  | 'connection-failed'
  | 'no-port-file'
  | 'manual'
  | 'selected-port-file'
  | 'selected-fallback';

type SelectedPortSource = 'port-file' | 'fallback';

async function promptForNreplUrlAndConnect(
  hostname: string | undefined,
  port: string | undefined,
  connectSequence: connectSequences.ReplConnectSequence,
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
      'selected-port-file': `Calva selected ${currentHost}:${currentPort} from the nREPL port file. Press Enter to connect, or edit host:port.`,
      'selected-fallback': `Calva selected ${currentHost}:${currentPort} using the fallback port from the connect sequence. Press Enter to connect.`,
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

    const result = await connectToHost(parsedHostname, parsedPort, connectSequence, true, false);

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
  connectSequence: connectSequences.ReplConnectSequence,
  isAutoConnect: boolean,
  hostname?: string,
  port?: string,
  isJackIn = false
): Promise<ConnectResult> {
  const cljsTypeName = projectTypes.getCljsTypeName(connectSequence);

  const portFile = projectTypes.nreplPortFileUri(connectSequence);
  void state.extensionContext.workspaceState.update('selectedCljsTypeName', cljsTypeName);
  void state.extensionContext.workspaceState.update('selectedConnectSequence', connectSequence);
  // Used to decide whether to suppress auto-connect when a matching connection already exists.
  const portWasExplicitlyProvided = port !== undefined;
  let selectedPortSource: SelectedPortSource | undefined;

  let result: ConnectResult = { connected: false };
  try {
    // WebSocket transport: skip TCP port resolution entirely
    const wsPort = connectSequenceInheritance.effectiveWebSocketPort(
      connectSequence,
      projectTypes.getProjectTypeForName(connectSequence.projectType)
    );
    if (wsPort !== undefined && wsPort !== false) {
      let resolvedWsPort: number;
      if (wsPort === true) {
        const portStr = await vscode.window.showInputBox({
          prompt: 'Enter WebSocket port for browser REPL',
          value: '3340',
          ignoreFocusOut: true,
          validateInput: (v) => {
            const n = parseInt(v);
            return isNaN(n) || n < 1 || n > 65535 ? 'Enter a valid port number' : undefined;
          },
        });
        if (portStr === undefined) {
          output.appendLineOtherOut('Connect aborted.');
          return { connected: false };
        }
        resolvedWsPort = parseInt(portStr);
      } else {
        resolvedWsPort = wsPort;
      }
      const wsHost = connectSequence.webSocketHost || '127.0.0.1';
      result = await connectViaWebSocket(resolvedWsPort, wsHost, connectSequence, isJackIn);
      status.update();
      return result;
    }

    if (port === undefined) {
      try {
        output.appendLineOtherOut(`Reading port file: ${portFile} ...`);
        await vscode.workspace.fs.stat(portFile);
        const bytes = await vscode.workspace.fs.readFile(portFile);
        port = new TextDecoder('utf-8').decode(bytes);
        selectedPortSource = 'port-file';
      } catch {
        const defaultPort = connectSequenceInheritance.effectiveFallbackPort(
          connectSequence,
          projectTypes.getProjectTypeForName(connectSequence.projectType)
        );
        if (defaultPort !== undefined) {
          output.appendLineOtherOut(`No nrepl port file found, using default port: ${defaultPort}`);
          port = String(defaultPort);
          selectedPortSource = 'fallback';
        } else {
          console.info('No nrepl port found');
        }
      }
    }
    if (port) {
      hostname = hostname !== undefined ? hostname : 'localhost';
      output.appendLineOtherOut(`Using host:port ${hostname}:${port} ...`);
      // Suppress auto-connect when a matching connection already exists,
      // UNLESS explicit host:port was provided or this is a jack-in.
      const baseSessionNames = sessionRoleUtils.deriveSessionRoleKeys(connectSequence);
      const projectRoot = state.getProjectRootUri().toString();
      const hasExistingMatch =
        !portWasExplicitlyProvided &&
        !isJackIn &&
        sessionNameResolver.hasMatchingBaseConnection(baseSessionNames, projectRoot);
      const effectiveAutoConnect = isAutoConnect && !hasExistingMatch;
      const selectedPortBehaviour: connectSequences.SelectedPortBehaviour =
        connectSequenceInheritance.effectiveSelectedPortBehaviour(
          connectSequence,
          isAutoConnect ? 'connect' : 'prompt'
        );

      if (selectedPortSource) {
        const selectedPortPromptReason: Record<SelectedPortSource, PromptReason> = {
          'port-file': 'selected-port-file',
          fallback: 'selected-fallback',
        };
        const shouldAutoConnectSelectedPort =
          selectedPortBehaviour === 'connect' && !hasExistingMatch;

        if (shouldAutoConnectSelectedPort) {
          result = await connectToHost(hostname, parseInt(port), connectSequence, true, isJackIn);
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
          result = await promptForNreplUrlAndConnect(
            hostname,
            port,
            connectSequence,
            selectedPortPromptReason[selectedPortSource]
          );
        }
      } else if (effectiveAutoConnect) {
        result = await connectToHost(hostname, parseInt(port), connectSequence, true, isJackIn);
        if (!result.connected && !isJackIn) {
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
  connectSequence: connectSequences.ReplConnectSequence,
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

    return connect(
      connectSequence,
      config.getConfig().autoSelectNReplPortFromPortFile,
      hostname,
      port
    );
  } else {
    output.appendLineOtherErr('Aborting connect, error determining connect sequence.');
  }
}

async function nReplPortFileExists() {
  const sequences = connectSequences.getConnectSequences(projectTypes.getAllProjectTypes());
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
  // Handle suffix pool exhaustion error
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
  wsServer?: nReplWsServer.NReplWsServer;
  disconnectAll?: boolean;
}

function formatRelativeProjectRoot(projectRoot?: string): string | undefined {
  if (!projectRoot) {
    return undefined;
  }
  try {
    const uri = vscode.Uri.parse(projectRoot);
    return projectRootUtil.getPathRelativeToWorkspace(uri);
  } catch {
    return projectRoot;
  }
}

async function promptForClientDisconnect(
  clients: clientRegistry.RegisteredClient[]
): Promise<DisconnectSelection | undefined> {
  // Identify which WS servers are owned by a connected client
  const clientOwnedServers = new Set<nReplWsServer.NReplWsServer>();
  for (const client of clients) {
    if (client.client.isWebSocket && client.client.wsServer) {
      clientOwnedServers.add(client.client.wsServer);
    }
  }

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
    const detail = client.client.isWebSocket
      ? `ws://${client.host}:${client.port}/_nrepl`
      : connectorUtils.buildDisconnectItemDetail(client.host, client.port);
    const label = connectorUtils.buildDisconnectItemLabel(
      {
        key: client.key,
        connectSequenceName: client.connectSequenceName,
        sessionKeys,
      },
      'debug-connected'
    );

    return {
      label,
      description,
      detail,
      clientKey: client.key,
    };
  });

  // Add orphaned WS servers (listening but no client connected)
  for (const server of nReplWsServer.getActiveServers()) {
    if (!clientOwnedServers.has(server)) {
      items.push({
        label: connectorUtils.buildDisconnectItemLabel(
          {
            key: `${server.port}`,
            connectSequenceName: server.connectSequenceName || `WebSocket Server`,
            sessionKeys: [],
          },
          'debug-disconnect'
        ),
        description: connectorUtils.buildDisconnectItemDescription(
          server.sessionKeys,
          formatRelativeProjectRoot(server.projectRoot)
        ),
        detail: `ws://${server.host}:${server.port}/_nrepl`,
        wsServer: server,
      });
    }
  }

  if (items.length === 0) {
    return undefined;
  }

  if (items.length > 1) {
    items.push({
      label: 'Close all',
      description: 'Disconnect all REPL connections and stop all WebSocket servers',
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

  if (selection.wsServer) {
    return { kind: 'ws-server', wsServer: selection.wsServer };
  }

  return undefined;
}

interface DisconnectOptions {
  preserveSuffix?: boolean;
}

async function disconnectClientByKey(
  clientKey: string,
  options: DisconnectOptions = {}
): Promise<void> {
  if (!clientKey) {
    return;
  }

  // Handle suffix preservation for reconnection scenarios.
  // When preserveSuffix is true, we mark the suffix as preserved so that
  // the on-close handler (which calls releaseClientSuffix) won't release it.
  // This is necessary because client.close() triggers the on-close handler.
  if (options.preserveSuffix) {
    clientTeardown.markSuffixPreserved(clientKey);
  } else {
    // Release suffix BEFORE unregistering (need connection state)
    clientTeardown.releaseClientSuffix(clientKey);
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
    cljsLib.setStateValue('current-session-type', null);
  } else {
    util.setConnectedState(true);
  }

  liveShareSupport.didDisconnectRepl();
  status.update();
}

async function stopWsServer(server: nReplWsServer.NReplWsServer): Promise<void> {
  output.appendLineOtherOut(
    `Stopping WebSocket server on ws://${server.host}:${server.port}/_nrepl`
  );
  nReplWsServer.untrackServer(server);
  await server.stop();
  status.update();
}

export async function connectNonProjectREPLCommand(context: vscode.ExtensionContext) {
  await state.setOrCreateNonProjectRoot(context, true);
  const connectSequence = await connectSequences.askForConnectSequence(
    projectTypes.getAllProjectTypes(),
    connectTypes.ConnectType.Connect,
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
}

export async function connectCommand(options?: {
  host?: string;
  port?: string;
  connectSequence?: string | connectSequences.ReplConnectSequence;
  disableAutoSelect?: boolean;
}) {
  const host = options && options.host ? options.host : undefined;
  const port = options && options.port ? options.port : undefined;
  let connectSequence: connectSequences.ReplConnectSequence;
  if (options && typeof options.connectSequence === 'string') {
    connectSequence = connectSequences
      .getConnectSequences(projectTypes.getAllProjectTypes())
      .find((s) => s.name === options.connectSequence);
  } else if (options && options.connectSequence) {
    connectSequence = options.connectSequence as connectSequences.ReplConnectSequence;
  }
  await state
    .initProjectDir(connectTypes.ConnectType.Connect, connectSequence, options?.disableAutoSelect)
    .catch((e) => {
      void vscode.window.showErrorMessage('Failed initializing project root directory: ', e);
    });
  const cljTypes = await projectTypes.detectProjectTypes();
  if (!connectSequence) {
    try {
      connectSequence = await connectSequences.askForConnectSequence(
        cljTypes,
        connectTypes.ConnectType.Connect,
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
}

export async function shouldAutoConnect() {
  return config.getConfig().autoConnectRepl && nReplPortFileExists();
}

export function disconnect(
  options: {
    clientKey?: string;
    disconnectAll?: boolean;
    preserveSuffix?: boolean;
  } | null = null,
  callback = () => {
    // do nothing
  }
) {
  return (async () => {
    const clients = clientRegistry.listClients();
    const hasOrphanedWsServers =
      nReplWsServer.getActiveServers().size > 0 &&
      [...nReplWsServer.getActiveServers()].some(
        (server) => !clients.some((c) => c.client.wsServer === server)
      );

    if (clients.length === 0 && !hasOrphanedWsServers) {
      callback();
      return;
    }

    let disconnectAll = options?.disconnectAll === true;
    let targetClientKey = options?.clientKey;
    let targetWsServer: nReplWsServer.NReplWsServer | undefined;
    const preserveSuffix = options?.preserveSuffix ?? false;

    if (!disconnectAll && !targetClientKey) {
      const selection = await promptForClientDisconnect(clients);
      if (!selection) {
        return;
      }
      if (selection.kind === 'all') {
        disconnectAll = true;
      } else if (selection.kind === 'single') {
        targetClientKey = selection.clientKey;
      } else if (selection.kind === 'ws-server') {
        targetWsServer = selection.wsServer;
      }
    }

    if (disconnectAll) {
      for (const client of [...clients]) {
        await disconnectClientByKey(client.key, { preserveSuffix });
      }
      // Stop any orphaned WS servers
      for (const server of [...nReplWsServer.getActiveServers()]) {
        await stopWsServer(server);
      }
    } else if (targetWsServer) {
      await stopWsServer(targetWsServer);
    } else {
      const keyToDisconnect = targetClientKey || clients[0].key;
      await disconnectClientByKey(keyToDisconnect, { preserveSuffix });
    }

    callback();
  })();
}

export function toggleCLJCSession() {
  if (!cljsLib.getStateValue('connected')) {
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
}

export async function selectCljcTarget(target?: 'primary' | 'secondary') {
  if (!cljsLib.getStateValue('connected')) {
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
    ? projectRootUtil.getPathRelativeToWorkspace(activeDoc.uri)
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
}

export async function switchCljsBuild() {
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
  const cljsType: connectSequences.CljsTypeConfig = isBuiltinType
    ? connectSequences.getDefaultCljsType(connectSequence.cljsType as string)
    : (connectSequence.cljsType as connectSequences.CljsTypeConfig);

  const cljsConnector = createCljsReplConnector(
    cljsType,
    projectTypes.getCljsTypeName(connectSequence),
    connectSequence,
    clientKey,
    roleKeys,
    { useDefaultBuild: false, preSelectedBuild: selectedBuild }
  );

  const [cljsSession, build] = await makeCljsSessionClone(
    cljSession,
    cljsConnector,
    cljsTypeName,
    clientKey
  );
  if (cljsSession) {
    await setUpCljsRepl(cljsSession, build, roleKeys.secondary, clientKey, globMap);
  }
  status.update();
}
