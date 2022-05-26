import * as printer from '../printer';
import * as state from '../state';
import * as replSession from '../nrepl/repl-session';

type Result = {
  result: string;
  ns: string;
  output: string;
  errorOutput: string;
};

export async function evaluateCode(
  sessionKey: 'clj' | 'cljs',
  code: string,
  output?: {
    stdout: (m: string) => void;
    stderr: (m: string) => void;
  }
): Promise<Result> {
  const session = replSession.getSession(sessionKey);
  if (!session) {
    throw new Error(`Can't retrieve REPL session for session key: ${sessionKey}.`);
  }
  const stdout = output
    ? output.stdout
    : (m: string) => {
        state.outputChannel().append(m);
      };
  const stderr = output
    ? output.stdout
    : (m: string) => {
        state.outputChannel().append(`Error: ${m}`);
      };
  const evaluation = session.eval(code, undefined, {
    stdout: stdout,
    stderr: stderr,
    pprintOptions: printer.disabledPrettyPrinter,
  });
  return {
    result: await evaluation.value,
    ns: evaluation.ns,
    output: evaluation.outPut,
    errorOutput: evaluation.errorOutput,
  };
}
