import * as state from '../state';
import * as vscode from 'vscode';
import * as child from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { parseEdn } from '../../out/cljs-lib/cljs-lib';

export type JackInDependencyKey = 'nrepl' | 'cider-nrepl' | 'cider/piggieback';

export type JackInDependencyVersions = Partial<Record<JackInDependencyKey, string>>;

const JACK_IN_DEPENDENCY_LIBRARIES: Record<JackInDependencyKey, string> = {
  nrepl: 'nrepl/nrepl',
  'cider-nrepl': 'cider/cider-nrepl',
  'cider/piggieback': 'cider/piggieback',
};

const JACK_IN_DEPENDENCY_KEYS = Object.keys(JACK_IN_DEPENDENCY_LIBRARIES) as JackInDependencyKey[];

const GLOBAL_STATE_KEY = 'calva.jackIn.latestDependencyVersions';

let refreshPromise: Promise<void> | null = null;

function execFileAsync(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    child.execFile(
      command,
      args,
      { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const execError = error as NodeJS.ErrnoException & {
            stdout?: string;
            stderr?: string;
          };
          execError.stdout = stdout;
          execError.stderr = stderr;
          reject(execError);
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

function parseFindVersionsOutput(output: string): string | undefined {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return parseEdn(line);
      } catch (error) {
        console.warn('[Calva] Failed to parse find-versions output line', line, error);
        return undefined;
      }
    })
    .map((data) => (data ? data['mvn/version'] : undefined))
    .find((version) => typeof version === 'string');
}

function getDepsCljJarPath(): string | undefined {
  const context = state.extensionContext;
  if (!context) {
    return undefined;
  }
  const jarPath = path.join(context.extensionPath, 'deps.clj.jar');
  return fs.existsSync(jarPath) ? jarPath : undefined;
}

async function fetchLatestVersion(library: string): Promise<string> {
  const args = ['-X:deps', 'find-versions', ':lib', library, ':n', '1'];
  const errors: string[] = [];

  try {
    const { stdout } = await execFileAsync('clojure', args);
    const version = parseFindVersionsOutput(stdout);
    if (version) {
      return version;
    }
    errors.push(`clojure output missing version for ${library}`);
  } catch (error) {
    errors.push(`clojure failed: ${(error as Error).message}`);
  }

  const depsCljJarPath = getDepsCljJarPath();
  if (depsCljJarPath) {
    try {
      const { stdout } = await execFileAsync('java', ['-jar', depsCljJarPath, ...args]);
      const version = parseFindVersionsOutput(stdout);
      if (version) {
        return version;
      }
      errors.push(`deps.clj output missing version for ${library}`);
    } catch (error) {
      errors.push(`deps.clj failed: ${(error as Error).message}`);
    }
  } else {
    errors.push('deps.clj.jar not available');
  }

  throw new Error(errors.join(' | '));
}

function getStoredJackInDependencyVersions(): JackInDependencyVersions {
  const context = state.extensionContext;
  if (!context) {
    return {};
  }
  const stored = context.globalState.get<JackInDependencyVersions>(GLOBAL_STATE_KEY, {});
  return { ...stored };
}

async function storeJackInDependencyVersions(versions: JackInDependencyVersions) {
  const context = state.extensionContext;
  if (!context) {
    return;
  }
  const current = getStoredJackInDependencyVersions();
  const merged: JackInDependencyVersions = { ...current, ...versions };
  await context.globalState.update(GLOBAL_STATE_KEY, merged);
}

function getConfiguredJackInDependencyVersions(): JackInDependencyVersions {
  const config = vscode.workspace.getConfiguration('calva');
  const inspected = config.inspect<JackInDependencyVersions>('jackInDependencyVersions');
  if (!inspected) {
    return {};
  }
  const sources = [
    inspected.globalValue,
    inspected.globalLanguageValue,
    inspected.workspaceValue,
    inspected.workspaceLanguageValue,
    inspected.workspaceFolderValue,
    inspected.workspaceFolderLanguageValue,
  ].filter((value): value is JackInDependencyVersions => Boolean(value));

  return sources.reduce((acc, value) => ({ ...acc, ...value }), {} as JackInDependencyVersions);
}

function getDefaultJackInDependencyVersions(): JackInDependencyVersions {
  const config = vscode.workspace.getConfiguration('calva');
  const inspected = config.inspect<JackInDependencyVersions>('jackInDependencyVersions');
  return inspected?.defaultValue;
}

function isFullyPopulated(
  versions: JackInDependencyVersions
): versions is Record<JackInDependencyKey, string> {
  return JACK_IN_DEPENDENCY_KEYS.every((key) => {
    const value = versions[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export type VersionSource = 'configured' | 'stored' | 'default';

export type JackInVersionsDetail = {
  effective: Record<JackInDependencyKey, string>;
  sources: Record<JackInDependencyKey, VersionSource>;
  storedLatest: JackInDependencyVersions;
  configured: JackInDependencyVersions;
  defaults: JackInDependencyVersions;
};

export function getJackInVersionsDetail(): JackInVersionsDetail {
  const stored = getStoredJackInDependencyVersions();
  const configured = getConfiguredJackInDependencyVersions();
  const defaults = getDefaultJackInDependencyVersions();

  const effective: Record<JackInDependencyKey, string> = {} as Record<JackInDependencyKey, string>;
  const sources: Record<JackInDependencyKey, VersionSource> = {} as Record<
    JackInDependencyKey,
    VersionSource
  >;

  for (const key of JACK_IN_DEPENDENCY_KEYS) {
    const configuredValue = configured[key];
    const storedValue = stored[key];
    const defaultValue = defaults[key] ?? '';

    if (typeof configuredValue === 'string' && configuredValue.trim().length > 0) {
      effective[key] = configuredValue;
      sources[key] = 'configured';
    } else if (typeof storedValue === 'string' && storedValue.trim().length > 0) {
      effective[key] = storedValue;
      sources[key] = 'stored';
    } else {
      effective[key] = defaultValue;
      sources[key] = 'default';
    }
  }

  return { effective, sources, storedLatest: stored, configured, defaults };
}

export function getEffectiveJackInDependencyVersions(): Record<JackInDependencyKey, string> {
  return getJackInVersionsDetail().effective;
}

export async function refreshJackInDependencyVersions(): Promise<void> {
  const context = state.extensionContext;
  if (!context) {
    return;
  }

  if (refreshPromise !== null) {
    return refreshPromise;
  }

  const stored = getStoredJackInDependencyVersions();
  if (isFullyPopulated(stored)) {
    console.info(
      '[Calva] Jack-in dependency versions already populated in global storage:',
      stored
    );
    return;
  }

  const missingKeys = JACK_IN_DEPENDENCY_KEYS.filter((key) => {
    const value = stored[key];
    return !(typeof value === 'string' && value.trim().length > 0);
  });

  console.info('[Calva] Refreshing jack-in dependency versions. Missing keys:', missingKeys);

  const promise = (async () => {
    const fetched: JackInDependencyVersions = {};

    for (const key of missingKeys) {
      const lib = JACK_IN_DEPENDENCY_LIBRARIES[key];
      try {
        const version = await fetchLatestVersion(lib);
        fetched[key] = version;
        console.info(`[Calva] Latest version for ${lib} resolved to ${version}`);
      } catch (error) {
        console.warn(
          `[Calva] Failed to fetch latest version for ${lib}: ${(error as Error).message}`
        );
      }
    }

    if (Object.keys(fetched).length > 0) {
      await storeJackInDependencyVersions(fetched);
      console.info('[Calva] Updated latest jack-in versions in global storage:', fetched);
    } else {
      console.info('[Calva] No new jack-in versions fetched.');
    }
  })().finally(() => {
    refreshPromise = null;
  });

  refreshPromise = promise;
  return promise;
}
