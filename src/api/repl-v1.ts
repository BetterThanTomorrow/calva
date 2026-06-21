import * as vscode from 'vscode';
import * as printer from '../printer';
import * as replSession from '../nrepl/repl-session';
import * as resultOutput from '../results-output/output';
import * as util from '../utilities';
import * as config from '../config';
import * as sessionRegistry from '../nrepl/session-registry';
import * as whoTracking from './who-tracking';
import * as outputDestinations from '../results-output/output-destinations';
import * as logUtil from './log-util';
import * as clientRegistry from '../nrepl/client-registry';
import * as shadowCljsRuntime from '../shadow-cljs-runtime';

type Result = {
  result: string;
  ns: string;
  output: string;
  errorOutput: string;
  sessionKey: string;
  who?: string;
  otherWhosSinceLast?: string[];
  error?: string;
  stacktrace?: any;
  shadowBuild?: string;
  shadowRuntimeId?: number;
};

export interface ReplSessionInfo {
  replSessionKey: string;
  projectRoot?: string;
  lastActivity?: number;
  globs?: string[];
  currentRoutedTarget?: boolean;
  replType: 'clj' | 'cljs';
  hasBuilds: boolean;
  supportsRuntimes: boolean;
  availableBuilds?: string[];
  currentlyConnectedCljsBuild?: string;
  currentlyConnectedRuntimeId?: number;
}

export interface ReplSessionAndRuntimesInfo extends ReplSessionInfo {
  builds?: ShadowBuildInfo[];
}

export const evaluate = async (
  code: string,
  options?: {
    sessionKey?: string;
    ns?: string;
    output?: {
      stdout: (m: string) => void;
      stderr: (m: string) => void;
    };
    nReplOptions?: Record<string, unknown>;
    who?: string;
    description?: string;
    targetRuntimeId?: number;
  }
): Promise<Result> => {
  const {
    sessionKey,
    ns = 'user',
    output,
    nReplOptions = {},
    who: rawWho,
    description,
    targetRuntimeId,
  } = options || {};

  const resolvedWho = rawWho || 'api';

  const reservedWhos = ['ui', 'api'];
  if (rawWho && reservedWhos.includes(rawWho)) {
    throw new Error(`The who value '${rawWho}' is reserved for Calva's internal use`);
  }

  const session = sessionKey ? sessionRegistry.getSession(sessionKey) : replSession.getSession();

  if (!session) {
    if (!util.getConnectedState()) {
      throw new Error(`The REPL is not connected.`);
    } else {
      throw new Error(
        `Can't retrieve REPL session for session key: ${sessionKey || 'auto-routed'}.`
      );
    }
  }

  const effectiveSessionKey =
    sessionKey || ((session as any)?._calvaSessionMetadata?.key as string | undefined) || 'unknown';

  const clientKey = session?.client?.clientKey;
  const connState = clientKey ? clientRegistry.getConnectionState(clientKey) : undefined;
  const isShadow = connState?.cljsTypeName === 'shadow-cljs';
  const sessionSupportsRuntimes =
    isShadow &&
    (session?.replType === 'cljs' || sessionRegistry.isSessionSecondary(effectiveSessionKey));
  let shadowBuild =
    sessionSupportsRuntimes && connState ? connState.cljsBuild || undefined : undefined;
  const shadowRuntimeId =
    sessionSupportsRuntimes && connState
      ? targetRuntimeId !== undefined
        ? targetRuntimeId
        : connState.shadowCljsRuntimeId
      : undefined;

  if (sessionSupportsRuntimes && clientKey && targetRuntimeId !== undefined) {
    const allBuildsData = await shadowCljsRuntime.getShadowRuntimesAllBuilds(clientKey);
    if (allBuildsData?.runtimes) {
      const targetRuntime = allBuildsData.runtimes.find((r) => r.runtimeId === targetRuntimeId);
      if (targetRuntime) {
        shadowBuild = targetRuntime.buildId;
      }
    }
  }

  const evalOptions: resultOutput.AppendClojureOptions = {
    ns,
    replSessionType: effectiveSessionKey,
    who: resolvedWho,
    shadowBuild,
    shadowRuntimeId,
  };

  if (description) {
    resultOutput.appendOtherOut(description, {
      who: resolvedWho,
      ns,
      replSessionType: effectiveSessionKey,
      shadowBuild,
      shadowRuntimeId,
    });
  }

  const stdout = (m: string) => {
    resultOutput.appendEvalOut(m, evalOptions);
    if (output?.stdout) {
      output.stdout(m);
    }
  };

  const stderr = (m: string) => {
    resultOutput.appendEvalErr(m, evalOptions);
    if (output?.stderr) {
      output.stderr(m);
    }
  };

  const evaluationOptions: any = {
    stdout,
    stderr,
    pprintOptions: printer.disabledPrettyPrinter,
    ...nReplOptions,
  };

  if (targetRuntimeId !== undefined) {
    evaluationOptions['runtime-id'] = targetRuntimeId;
  }

  const evaluation = session.eval(code, ns, evaluationOptions);

  sessionRegistry.updateSessionActivity(effectiveSessionKey);
  whoTracking.recordEvaluation(effectiveSessionKey, resolvedWho);
  whoTracking.setCurrentWho(session.sessionId, resolvedWho);

  // Track runtime activity for the effective runtime
  const effectiveRuntimeId =
    targetRuntimeId ?? shadowCljsRuntime.getSelectedRuntimeId(session?.client?.clientKey);
  if (effectiveRuntimeId !== undefined) {
    shadowCljsRuntime.recordRuntimeActivity(effectiveRuntimeId);
  }

  resultOutput.appendEvaluatedCode(code, {
    destination: resultOutput.getDestinationConfiguration().evalResults,
    ...evalOptions,
  });

  let result: Result;
  try {
    const evaluationResult = await evaluation.value;
    result = {
      result: evaluationResult,
      ns: evaluation.ns,
      output: evaluation.outPut,
      errorOutput: evaluation.errorOutput,
      sessionKey: effectiveSessionKey,
      who: resolvedWho,
      otherWhosSinceLast: whoTracking.getOtherWhosSinceLast(effectiveSessionKey, resolvedWho),
      shadowBuild,
      shadowRuntimeId,
    };
    resultOutput.appendClojureEval(evaluationResult, evalOptions);
  } catch (evalError) {
    let stacktrace;
    try {
      stacktrace = await session.stacktrace();
    } catch (fetchStacktraceError) {
      console.error(`Calva API eval: failed to output stacktrace. ${fetchStacktraceError}`);
    } finally {
      result = {
        result: 'nil',
        ns: evaluation.ns,
        output: evaluation.outPut,
        errorOutput: evaluation.errorOutput,
        sessionKey: effectiveSessionKey,
        who: resolvedWho,
        otherWhosSinceLast: whoTracking.getOtherWhosSinceLast(effectiveSessionKey, resolvedWho),
        error: `${evalError}`,
        stacktrace,
        shadowBuild,
        shadowRuntimeId,
      };
      resultOutput.appendClojureEval('nil', evalOptions);
    }
  }
  return result;
};

/**
 * @deprecated Use `evaluate()` instead.
 */
export const evaluateCode = async (
  sessionKey: 'clj' | 'cljs' | 'cljc' | string | undefined,
  code: string,
  ns = 'user',
  output?: {
    stdout: (m: string) => void;
    stderr: (m: string) => void;
  },
  nReplEvalOptions = {}
): Promise<Result> => {
  // When sessionKey is explicitly provided, use it directly without routing
  // Otherwise, use the routing logic to determine the session
  const session = sessionKey ? sessionRegistry.getSession(sessionKey) : replSession.getSession();

  if (!session) {
    if (!util.getConnectedState()) {
      throw new Error(`The REPL is not connected.`);
    } else {
      throw new Error(
        `Can't retrieve REPL session for session key: ${sessionKey || 'auto-routed'}.`
      );
    }
  }
  const effectiveSessionKey =
    sessionKey || ((session as any)?._calvaSessionMetadata?.key as string | undefined) || 'unknown';

  const clientKey = session?.client?.clientKey;
  const connState = clientKey ? clientRegistry.getConnectionState(clientKey) : undefined;
  const isShadow = connState?.cljsTypeName === 'shadow-cljs';
  const sessionSupportsRuntimes =
    isShadow &&
    (session?.replType === 'cljs' || sessionRegistry.isSessionSecondary(effectiveSessionKey));
  const shadowBuild =
    sessionSupportsRuntimes && connState ? connState.cljsBuild || undefined : undefined;
  const shadowRuntimeId =
    sessionSupportsRuntimes && connState ? connState.shadowCljsRuntimeId : undefined;

  // Always send to Calva destinations AND call custom handlers if provided
  const stdout = (m: string) => {
    resultOutput.appendEvalOut(m, {
      ns,
      replSessionType: effectiveSessionKey,
      shadowBuild,
      shadowRuntimeId,
    });

    if (output?.stdout) {
      output.stdout(m);
    }
  };

  const stderr = (m: string) => {
    resultOutput.appendEvalErr(m, {
      ns: ns,
      replSessionType: effectiveSessionKey,
      shadowBuild,
      shadowRuntimeId,
    });

    if (output?.stderr) {
      output.stderr(m);
    }
  };
  const evaluation = session.eval(code, ns, {
    stdout: stdout,
    stderr: stderr,
    pprintOptions: printer.disabledPrettyPrinter,
    ...nReplEvalOptions,
  });

  // Update session activity timestamp for UI display
  sessionRegistry.updateSessionActivity(effectiveSessionKey);

  // Honor the evaluationSendCodeToOutputWindow setting like manual evaluations do
  if (config.getConfig().evaluationSendCodeToOutputWindow) {
    if (
      !outputDestinations
        .normalizeDestinations(resultOutput.getDestinationConfiguration().evalResults)
        .includes('repl-window')
    ) {
      resultOutput.appendClojureEval(code, {
        ns,
        replSessionType: effectiveSessionKey,
        outputCategory: 'evaluatedCode',
        shadowBuild,
        shadowRuntimeId,
      });
    }
  }

  let result: Result;
  try {
    const evaluationResult = await evaluation.value;
    result = {
      result: evaluationResult,
      ns: evaluation.ns,
      output: evaluation.outPut,
      errorOutput: evaluation.errorOutput,
      sessionKey: effectiveSessionKey,
      shadowBuild,
      shadowRuntimeId,
    };

    // Always display results in Calva destination
    resultOutput.appendClojureEval(evaluationResult, {
      ns: evaluation.ns,
      replSessionType: effectiveSessionKey,
      shadowBuild,
      shadowRuntimeId,
    });
  } catch (evalError) {
    let stacktrace;
    try {
      stacktrace = await session.stacktrace();
    } catch (fetchStacktraceError) {
      console.error(`Calva API eval: failed to output stacktrace. ${fetchStacktraceError}`);
    } finally {
      result = {
        result: 'nil',
        ns: evaluation.ns,
        output: evaluation.outPut,
        errorOutput: evaluation.errorOutput,
        sessionKey: effectiveSessionKey,
        error: `${evalError}`,
        stacktrace,
        shadowBuild,
        shadowRuntimeId,
      };

      resultOutput.appendClojureEval('nil', {
        ns: evaluation.ns,
        replSessionType: effectiveSessionKey,
        shadowBuild,
        shadowRuntimeId,
      });
    }
  }
  return result;
};

export const currentSessionKey = () => {
  return replSession.getSessionKey();
};

export const listSessions = (): ReplSessionInfo[] => {
  const currentSessionKey = replSession.getSessionKey();
  return sessionRegistry.listSessions().map((session) => {
    const clientKey = session.connectionOwnerId;
    const connState = clientKey ? clientRegistry.getConnectionState(clientKey) : undefined;
    const isCljs = session.isSecondary || false;
    const supportsRuntimes = isCljs && connState ? connState.cljsTypeName === 'shadow-cljs' : false;
    return {
      replSessionKey: session.key,
      projectRoot: session.projectRoot
        ? vscode.workspace.asRelativePath(session.projectRoot)
        : undefined,
      lastActivity: session.lastActivity,
      globs: session.globs,
      currentRoutedTarget: session.key === currentSessionKey,
      replType: isCljs ? 'cljs' : 'clj',
      hasBuilds: isCljs && connState ? !!connState.hasBuilds : false,
      supportsRuntimes,
      availableBuilds: isCljs ? connState?.availableBuilds : undefined,
      currentlyConnectedCljsBuild: isCljs ? connState?.cljsBuild || undefined : undefined,
      currentlyConnectedRuntimeId: isCljs ? connState?.shadowCljsRuntimeId : undefined,
    };
  });
};

export const listSessionsAndRuntimes = async (): Promise<ReplSessionAndRuntimesInfo[]> => {
  const currentSessionKey = replSession.getSessionKey();
  const sessionInfoList: ReplSessionAndRuntimesInfo[] = [];

  for (const session of sessionRegistry.listSessions()) {
    const clientKey = session.connectionOwnerId;
    const connState = clientKey ? clientRegistry.getConnectionState(clientKey) : undefined;
    const isCljs = session.isSecondary || false;
    const supportsRuntimes = isCljs && connState ? connState.cljsTypeName === 'shadow-cljs' : false;

    let builds: ShadowBuildInfo[] | undefined;

    if (supportsRuntimes && clientKey && connState) {
      const allBuildsData = await shadowCljsRuntime.getShadowRuntimesAllBuilds(clientKey);
      if (allBuildsData) {
        const { activeBuilds, runtimes } = allBuildsData;

        const buildKeyMap = new Map<string, string>();
        const addKey = (k: string) => {
          const norm = k.startsWith(':') ? k.substring(1) : k;
          if (!buildKeyMap.has(norm)) {
            const canonical = shadowCljsRuntime.canonicalBuildId(k);
            if (canonical) {
              buildKeyMap.set(norm, canonical);
            }
          }
        };

        activeBuilds.forEach(addKey);
        runtimes.forEach((r) => addKey(r.buildId));
        if (connState.availableBuilds) {
          connState.availableBuilds.forEach(addKey);
        }
        if (connState.cljsBuild) {
          addKey(connState.cljsBuild);
        }

        const currentConnectedBuildNorm = connState.cljsBuild
          ? connState.cljsBuild.startsWith(':')
            ? connState.cljsBuild.substring(1)
            : connState.cljsBuild
          : undefined;

        const normalizedActiveBuilds = activeBuilds.map((b) =>
          b.startsWith(':') ? b.substring(1) : b
        );

        builds = Array.from(buildKeyMap.entries()).map(([norm, originalKey]) => {
          const isActive = normalizedActiveBuilds.includes(norm);
          const isCurrentlyConnected = norm === currentConnectedBuildNorm;
          const buildRuntimes = (runtimes || [])
            .filter((r) => {
              const rNorm = r.buildId.startsWith(':') ? r.buildId.substring(1) : r.buildId;
              return rNorm === norm;
            })
            .map((r) => ({
              ...r,
              lastActivity: shadowCljsRuntime.getRuntimeLastActivity(r.runtimeId),
            }))
            .sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));

          return {
            buildId: originalKey,
            isActive,
            isCurrentlyConnected,
            runtimes: buildRuntimes,
          };
        });
      }
    }

    sessionInfoList.push({
      replSessionKey: session.key,
      projectRoot: session.projectRoot
        ? vscode.workspace.asRelativePath(session.projectRoot)
        : undefined,
      lastActivity: session.lastActivity,
      globs: session.globs,
      currentRoutedTarget: session.key === currentSessionKey,
      replType: isCljs ? 'cljs' : 'clj',
      hasBuilds: isCljs && connState ? !!connState.hasBuilds : false,
      supportsRuntimes,
      availableBuilds: isCljs ? connState?.availableBuilds : undefined,
      currentlyConnectedCljsBuild: isCljs ? connState?.cljsBuild || undefined : undefined,
      currentlyConnectedRuntimeId: isCljs ? connState?.shadowCljsRuntimeId : undefined,
      builds,
    });
  }

  return sessionInfoList;
};

export interface ShadowRuntimeInfo {
  runtimeId: number;
  description: string;
  buildId: string;
  host: string;
  workerId: number;
  sinceInst: number;
  sinceDescription: string;
  lastActivity?: number;
}

export interface ShadowBuildInfo {
  buildId: string;
  isActive: boolean;
  isCurrentlyConnected: boolean;
  runtimes: ShadowRuntimeInfo[];
}

//// OUTPUT ////

export type OutputCategory =
  | 'evaluationResults'
  | 'evaluatedCode'
  | 'evaluationOutput'
  | 'evaluationErrorOutput'
  | 'otherOutput'
  | 'otherErrorOutput';

export interface OutputMessage {
  category: OutputCategory;
  text: string;
  who?: string;
  ns?: string;
  replSessionKey?: string;
  shadowBuild?: string;
  shadowRuntimeId?: number;
}

const outputCategoryToApiCategory: Record<string, OutputCategory> = {
  evalResults: 'evaluationResults',
  evaluatedCode: 'evaluatedCode',
  evalOut: 'evaluationOutput',
  evalErr: 'evaluationErrorOutput',
  otherOut: 'otherOutput',
  otherErr: 'otherErrorOutput',
};

export function log(message: OutputMessage): void {
  const internalCategory = logUtil.validateLogMessage(message);
  resultOutput.emitExternal({
    category: internalCategory,
    text: message.text,
    who: message.who,
    ns: message.ns,
    replSessionKey: message.replSessionKey,
    shadowBuild: message.shadowBuild,
    shadowRuntimeId: message.shadowRuntimeId,
  });
}

export function onOutputLogged(callback: (msg: OutputMessage) => void): vscode.Disposable {
  const unsubscribe = resultOutput.subscribe((m: resultOutput.SubscriberOutputMessage) => {
    const cat = outputCategoryToApiCategory[m.category] || 'otherOutput';
    try {
      callback({
        category: cat,
        text: m.text,
        who: m.who,
        ns: m.ns,
        replSessionKey: m.replSessionKey,
        shadowBuild: m.shadowBuild,
        shadowRuntimeId: m.shadowRuntimeId,
      });
    } catch (error) {
      console.log('API onOutputLogged callback failed', error.message);
    }
  });
  return new vscode.Disposable(unsubscribe);
}
