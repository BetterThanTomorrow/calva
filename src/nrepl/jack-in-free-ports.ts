import * as childProcess from 'child_process';
import { promisify } from 'util';

const execFile = promisify(childProcess.execFile);
const isWin = process.platform === 'win32';
const pollIntervalMs = 250;
const terminateTimeoutMs = 5000;
const forceKillTimeoutMs = 2000;
const maxDescriptionChars = 120;
const windowsProcessParentsScript =
  'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }';

type Log = (message: string) => void;

export type PortHolder = {
  pid: number;
  description: string;
};

export type ProcessParent = {
  pid: number;
  parentPid: number;
};

export type DescendantPidsRequest = {
  parents: ProcessParent[];
  rootPid: number;
};

function uniquePids(pids: number[]): number[] {
  return [...new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0))];
}

export function parseLsofPids(stdout: string): number[] {
  return uniquePids(stdout.split(/\r?\n/).map((line) => Number(line.trim())));
}

export function parseNetstatListeningPids(stdout: string, port: number): number[] {
  return uniquePids(
    stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter(
        ([protocol, localAddress, , state]) =>
          protocol === 'TCP' && state === 'LISTENING' && localAddress?.endsWith(`:${port}`)
      )
      .map(([, , , , pid]) => Number(pid))
  );
}

export function parseProcessParents(stdout: string): ProcessParent[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([pid, parentPid]) => Number.isInteger(pid) && Number.isInteger(parentPid))
    .map(([pid, parentPid]) => ({ pid, parentPid }));
}

export function descendantPids({ parents, rootPid }: DescendantPidsRequest): Set<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const { pid, parentPid } of parents) {
    childrenByParent.set(parentPid, [...(childrenByParent.get(parentPid) ?? []), pid]);
  }
  const descendants = new Set<number>();
  const pending = [rootPid];
  while (pending.length > 0) {
    const pid = pending.pop();
    if (!descendants.has(pid)) {
      descendants.add(pid);
      pending.push(...(childrenByParent.get(pid) ?? []));
    }
  }
  return descendants;
}

async function stdoutOf(command: string, args: string[]): Promise<string> {
  try {
    return (await execFile(command, args)).stdout;
  } catch (e) {
    return e?.stdout ?? '';
  }
}

async function listeningPids(port: number): Promise<number[]> {
  return isWin
    ? parseNetstatListeningPids(await stdoutOf('netstat', ['-ano', '-p', 'tcp']), port)
    : parseLsofPids(await stdoutOf('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']));
}

async function processDescription(pid: number): Promise<string> {
  const stdout = isWin
    ? await stdoutOf('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])
    : await stdoutOf('ps', ['-o', 'command=', '-p', `${pid}`]);
  const description = stdout.trim() || 'unknown process';
  return description.length > maxDescriptionChars
    ? `${description.slice(0, maxDescriptionChars)}...`
    : description;
}

export async function portHolders(port: number): Promise<PortHolder[]> {
  const pids = await listeningPids(port);
  return Promise.all(
    pids.map(async (pid) => ({ pid, description: await processDescription(pid) }))
  );
}

export async function processParents(): Promise<ProcessParent[]> {
  return parseProcessParents(
    isWin
      ? await stdoutOf('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          windowsProcessParentsScript,
        ])
      : await stdoutOf('ps', ['-A', '-o', 'pid=,ppid='])
  );
}

async function signal(pid: number, unixSignal: NodeJS.Signals): Promise<void> {
  if (isWin) {
    await stdoutOf('taskkill', ['/PID', `${pid}`, '/T', '/F']);
    return;
  }
  try {
    process.kill(pid, unixSignal);
  } catch (e) {
    console.error(`Could not send ${unixSignal} to PID ${pid}:`, e);
  }
}

async function waitUntilFree(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await listeningPids(port)).length === 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return (await listeningPids(port)).length === 0;
}

export async function freePort(port: number, log: Log): Promise<void> {
  const pids = await listeningPids(port);
  if (pids.length === 0) {
    return;
  }
  for (const pid of pids) {
    log(`Port ${port} is in use by PID ${pid} (${await processDescription(pid)}). Stopping it.`);
    await signal(pid, 'SIGTERM');
  }
  if (await waitUntilFree(port, terminateTimeoutMs)) {
    return;
  }
  for (const pid of await listeningPids(port)) {
    await signal(pid, 'SIGKILL');
  }
  if (!(await waitUntilFree(port, forceKillTimeoutMs))) {
    log(`Port ${port} is still in use after trying to stop the processes listening on it.`);
  }
}
