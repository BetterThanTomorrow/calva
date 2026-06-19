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

  const evalOptions: resultOutput.AppendClojureOptions = {
    ns,
    replSessionType: effectiveSessionKey,
    who: resolvedWho,
  };

  if (description) {
    resultOutput.appendOtherOut(description, {
      who: resolvedWho,
      ns,
      replSessionType: effectiveSessionKey,
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
  // Always send to Calva destinations AND call custom handlers if provided
  const stdout = (m: string) => {
    resultOutput.appendEvalOut(m);

    if (output?.stdout) {
      output.stdout(m);
    }
  };

  const stderr = (m: string) => {
    resultOutput.appendEvalErr(m, {
      ns: ns,
      replSessionType: effectiveSessionKey,
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
    };

    // Always display results in Calva destination
    resultOutput.appendClojureEval(evaluationResult, {
      ns: evaluation.ns,
      replSessionType: effectiveSessionKey,
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
      };

      resultOutput.appendClojureEval('nil', {
        ns: evaluation.ns,
        replSessionType: effectiveSessionKey,
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
    return {
      replSessionKey: session.key,
      projectRoot: session.projectRoot
        ? vscode.workspace.asRelativePath(session.projectRoot)
        : undefined,
      lastActivity: session.lastActivity,
      globs: session.globs,
      currentRoutedTarget: session.key === currentSessionKey,
      replType: session.isSecondary ? 'cljs' : 'clj',
      hasBuilds: connState ? !!connState.hasBuilds : false,
      supportsRuntimes: connState ? connState.cljsTypeName === 'shadow-cljs' : false,
      availableBuilds: connState?.availableBuilds,
      currentlyConnectedCljsBuild: connState?.cljsBuild || undefined,
      currentlyConnectedRuntimeId: connState?.shadowCljsRuntimeId,
    };
  });
};

export interface ShadowRuntimeInfo {
  runtimeId: number;
  description: string;
  buildId: string;
  host: string;
  workerId: number;
  sinceInst: number;
  sinceDescription: string;
}

export const listRuntimes = async (sessionKey?: string): Promise<ShadowRuntimeInfo[]> => {
  const key = sessionKey || replSession.getSessionKey();
  if (!key) {
    return [];
  }
  const clientKey = sessionRegistry.getClientKeyForSession(key);
  if (!clientKey) {
    return [];
  }
  const connState = clientRegistry.getConnectionState(clientKey);
  if (!connState || connState.cljsTypeName !== 'shadow-cljs') {
    return [];
  }
  const runtimes = await shadowCljsRuntime.getShadowRuntimesForClient(clientKey);
  return (runtimes || []).map((r) => ({
    runtimeId: r.clientId,
    description: r.description,
    buildId: r.buildId,
    host: r.host,
    workerId: r.workerId,
    sinceInst: r.sinceInst,
    sinceDescription: r.sinceDescription,
  }));
};

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
      });
    } catch (error) {
      console.log('API onOutputLogged callback failed', error.message);
    }
  });
  return new vscode.Disposable(unsubscribe);
}
