import * as printer from '../printer';
import * as replSession from '../nrepl/repl-session';
import { cljsLib } from '../utilities';

type Result = {
  result: string;
  ns: string;
  output: string;
  errorOutput: string;
  sessionKey: string;
  error?: string;
  stacktrace?: any;
};

export const evaluateCode = async (
  sessionKey: 'clj' | 'cljs' | 'cljc' | undefined,
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
    throw new Error(
      `Can't retrieve REPL session for session key: ${sessionKey} (used ${sessionKeyToUse}).`
    );
  }
  const stdout = output
    ? output.stdout
    : (_m: string) => {
        // Do nothing
      };
  const stderr = output
    ? output.stdout
    : (_m: string) => {
        // Do nothing
      };
  const evaluation = session.eval(code, ns, {
    stdout: stdout,
    stderr: stderr,
    pprintOptions: printer.disabledPrettyPrinter,
    ...nReplEvalOptions,
  });
  let result: Result;
  try {
    result = {
      result: await evaluation.value,
      ns: evaluation.ns,
      output: evaluation.outPut,
      errorOutput: evaluation.errorOutput,
      sessionKey: sessionKeyToUse,
    };
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
        sessionKey: sessionKeyToUse,
        error: `${evalError}`,
        stacktrace,
      };
    }
  }
  return result;
};

export const currentSessionKey = () => {
  return replSession.getReplSessionType(cljsLib.getStateValue('connected'));
};
