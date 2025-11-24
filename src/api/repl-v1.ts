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
  error?: string;
  stacktrace?: any;
};

export interface ReplSessionInfo {
  replSessionKey: string;
  projectRoot?: string;
  lastActivity?: number;
  globs?: string[];
}

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
  const sessionKeyToUse = replSession.getSessionKey(sessionKey);
  const session = replSession.getSession(sessionKeyToUse || undefined);
  if (!session) {
    if (!util.getConnectedState()) {
      throw new Error(`The REPL is not connected.`);
    } else {
      throw new Error(
        `Can't retrieve REPL session for session key: ${sessionKey}. (used ${sessionKeyToUse}).`
      );
    }
  }
  const effectiveSessionKey =
    sessionKeyToUse ||
    ((session as any)?._calvaSessionMetadata?.key as string | undefined) ||
    'unknown';
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
  // Honor the evaluationSendCodeToOutputWindow setting like manual evaluations do
  if (getConfig().evaluationSendCodeToOutputWindow) {
    if (resultOutput.getDestinationConfiguration().evalResults !== 'repl-window') {
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
  return replSession.getReplSessionType(util.getConnectedState());
};

export const listSessions = (): ReplSessionInfo[] => {
  return sessionRegistry.listSessions().map((session) => ({
    replSessionKey: session.key,
    projectRoot: session.projectRoot,
    lastActivity: session.lastActivity,
    globs: session.globs,
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
      callback({ category: cat, text: m.text });
    } catch (error) {
      console.log('API onOutputLogged callback failed', error.message);
    }
  });
  return new vscode.Disposable(unsubscribe);
}
