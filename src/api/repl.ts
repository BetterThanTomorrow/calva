import * as printer from '../printer';
import * as replSession from '../nrepl/repl-session';
import { cljsLib } from '../utilities';

type Result = {
  result: string;
  ns: string;
  output: string;
  errorOutput: string;
};

export const evaluateCode = async (
  sessionKey: 'clj' | 'cljs' | 'cljc' | undefined,
  code: string,
  output?: {
    stdout: (m: string) => void;
    stderr: (m: string) => void;
  },
  opts = { ns: 'user' }
): Promise<Result> => {
  const session = replSession.getSession(sessionKey || undefined);
  if (!session) {
    throw new Error(`Can't retrieve REPL session for session key: ${sessionKey}.`);
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
  const evaluation = session.eval(code, undefined, {
    stdout: stdout,
    stderr: stderr,
    pprintOptions: printer.disabledPrettyPrinter,
    ...opts,
  });
  return {
    result: await evaluation.value,
    ns: evaluation.ns,
    output: evaluation.outPut,
    errorOutput: evaluation.errorOutput,
  };
};

export const currentSessionKey = () => {
  return replSession.getReplSessionType(cljsLib.getStateValue('connected'));
};
