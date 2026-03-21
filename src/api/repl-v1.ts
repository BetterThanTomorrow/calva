import * as vscode from 'vscode';
import * as printer from '../printer';
import * as replSession from '../nrepl/repl-session';
import * as resultOutput from '../results-output/output';
import * as util from '../utilities';
import { getConfig } from '../config';
import * as sessionRegistry from '../nrepl/session-registry';

type Result = {
  result: string;
  ns: string;
  output: string;
  errorOutput: string;
  sessionKey: string;
  evaluator: string;
  error?: string;
  stacktrace?: any;
};

export interface ReplSessionInfo {
  replSessionKey: string;
  projectRoot?: string;
  lastActivity?: number;
  globs?: string[];
  currentRoutedTarget?: boolean;
}

export const evaluate = async (
  code: string,
  options?: {
    sessionKey?: 'clj' | 'cljs' | 'cljc' | string;
    ns?: string;
    output?: {
      stdout: (m: string) => void;
      stderr: (m: string) => void;
    };
    nReplOptions?: Record<string, unknown>;
    evaluator?: string;
    description?: string;
  }
): Promise<Result> => {
  const {
    sessionKey,
    ns = 'user',
    output,
    nReplOptions = {},
    evaluator: rawEvaluator,
    description,
  } = options || {};

  const resolvedEvaluator = rawEvaluator || 'anonymous';

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
    evaluator: resolvedEvaluator,
    description,
  };

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

  const evaluation = session.eval(code, ns, {
    stdout,
    stderr,
    pprintOptions: printer.disabledPrettyPrinter,
    ...nReplOptions,
  });

  sessionRegistry.updateSessionActivity(effectiveSessionKey);

  if (getConfig().evaluationSendCodeToOutputWindow) {
    if (resultOutput.getDestinationConfiguration().evalResults !== 'repl-window') {
      resultOutput.appendClojureEval(code, {
        ...evalOptions,
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
      evaluator: resolvedEvaluator,
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
        evaluator: resolvedEvaluator,
        error: `${evalError}`,
        stacktrace,
      };
      resultOutput.appendClojureEval('nil', evalOptions);
    }
  }
  return result;
};

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
  return evaluate(code, {
    sessionKey,
    ns,
    output,
    nReplOptions: nReplEvalOptions,
    evaluator: 'anonymous',
  });
};

export const currentSessionKey = () => {
  return replSession.getSessionKey();
};

export const listSessions = (): ReplSessionInfo[] => {
  const currentSessionKey = replSession.getSessionKey();
  return sessionRegistry.listSessions().map((session) => ({
    replSessionKey: session.key,
    projectRoot: session.projectRoot
      ? vscode.workspace.asRelativePath(session.projectRoot)
      : undefined,
    lastActivity: session.lastActivity,
    globs: session.globs,
    currentRoutedTarget: session.key === currentSessionKey,
  }));
};

//// OUTPUT ////

export type OutputCategory =
  | 'evaluationResults'
  | 'clojureCode'
  | 'evaluationOutput'
  | 'evaluationErrorOutput'
  | 'otherOutput'
  | 'otherErrorOutput';

export interface OutputMessage {
  category: OutputCategory;
  text: string;
  evaluator?: string;
}

const outputCategoryToApiCategory: Record<string, OutputCategory> = {
  evalResults: 'evaluationResults',
  clojure: 'clojureCode',
  evalOut: 'evaluationOutput',
  evalErr: 'evaluationErrorOutput',
  otherOut: 'otherOutput',
  otherErr: 'otherErrorOutput',
};

export function onOutputLogged(callback: (msg: OutputMessage) => void): vscode.Disposable {
  const unsubscribe = resultOutput.subscribe((m: resultOutput.SubscriberOutputMessage) => {
    const cat = outputCategoryToApiCategory[m.category] || 'otherOutput';
    try {
      callback({ category: cat, text: m.text, evaluator: m.evaluator });
    } catch (error) {
      console.log('API onOutputLogged callback failed', error.message);
    }
  });
  return new vscode.Disposable(unsubscribe);
}
