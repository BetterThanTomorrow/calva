import * as cp from 'child_process';

const OUTPUT_LIMIT = 4000;
const processClosures = new WeakMap<cp.ChildProcessWithoutNullStreams, Promise<void>>();

export interface BabashkaStartupOptions {
  executable?: string;
  cwd: string;
  getPort: () => Promise<number>;
  canConnect: (port: number) => Promise<boolean>;
  spawn?: typeof cp.spawn;
  timeoutMs?: number;
  intervalMs?: number;
}

function appendOutput(current: string, chunk: Buffer): string {
  return `${current}${chunk.toString()}`.slice(-OUTPUT_LIMIT);
}

function startupError(reason: string, stdout: string, stderr: string): Error {
  return new Error(`${reason}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}

function observeProcessClosure(child: cp.ChildProcessWithoutNullStreams): Promise<void> {
  const closure = new Promise<void>((resolve) => child.once('close', () => resolve()));
  processClosures.set(child, closure);
  return closure;
}

function captureProcessOutput(child: cp.ChildProcessWithoutNullStreams) {
  const output = { stdout: '', stderr: '', failure: undefined as string | undefined };
  child.stdout.on('data', (chunk: Buffer) => (output.stdout = appendOutput(output.stdout, chunk)));
  child.stderr.on('data', (chunk: Buffer) => (output.stderr = appendOutput(output.stderr, chunk)));
  child.once('error', (error) => (output.failure = `Could not start Babashka: ${error.message}`));
  child.once('exit', (code, signal) => {
    output.failure = `Babashka exited before opening its nREPL port (exit code ${code}, signal ${signal}).`;
  });
  return output;
}

function spawnBabashka(
  options: BabashkaStartupOptions,
  port: number
): cp.ChildProcessWithoutNullStreams {
  if (!options.executable) {
    throw new Error('Babashka executable `bb` was not found on PATH.');
  }
  return (options.spawn ?? cp.spawn)(options.executable, ['nrepl-server', String(port)], {
    cwd: options.cwd,
    stdio: 'pipe',
  });
}

async function reportStartupFailure(
  child: cp.ChildProcessWithoutNullStreams,
  error: unknown,
  output: { stdout: string; stderr: string; failure: string | undefined }
): Promise<never> {
  const reason = error instanceof Error ? error.message : String(error);
  const cleanupFailure = await stopAfterFailedStartup(child);
  if (cleanupFailure) {
    output.failure = `${output.failure ? `${output.failure}; ` : ''}${cleanupFailure}`;
  }
  const detail = getFailureDetail(reason, output.failure);
  throw startupError(`${reason}${detail}`, output.stdout, output.stderr);
}

async function stopAfterFailedStartup(
  child: cp.ChildProcessWithoutNullStreams
): Promise<string | undefined> {
  try {
    await stopBabashkaProcess(child);
    return undefined;
  } catch (error) {
    return String(error);
  }
}

function getFailureDetail(reason: string, failure: string | undefined): string {
  return failure && !reason.includes(failure) ? `\n${failure}` : '';
}

export async function stopBabashkaProcess(
  child: cp.ChildProcessWithoutNullStreams,
  timeoutMs = 5000
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const closed = processClosures.get(child) ?? observeProcessClosure(child);
  child.kill();
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('Timed out waiting for Babashka process to exit')),
      timeoutMs
    );
  });
  try {
    await Promise.race([closed, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForReadiness(
  child: cp.ChildProcessWithoutNullStreams,
  port: number,
  canConnect: (port: number) => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
  getFailure: () => string | undefined
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const failure = getFailure();
    if (failure) {
      throw new Error(failure);
    }
    if (await canConnect(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for Babashka nREPL server on port ${port}.`);
}

export async function startBabashkaServer(
  options: BabashkaStartupOptions
): Promise<{ port: number; process: cp.ChildProcessWithoutNullStreams }> {
  const port = await options.getPort();
  const child = spawnBabashka(options, port);
  void observeProcessClosure(child);
  const output = captureProcessOutput(child);

  try {
    await waitForReadiness(
      child,
      port,
      options.canConnect,
      options.timeoutMs ?? 10_000,
      options.intervalMs ?? 50,
      () => output.failure
    );
    return { port, process: child };
  } catch (error) {
    return reportStartupFailure(child, error, output);
  }
}
