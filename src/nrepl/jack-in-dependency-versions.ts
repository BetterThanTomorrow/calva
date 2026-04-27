import * as state from '../state';
import * as vscode from 'vscode';
import * as child from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as cljsLib from '../../out/cljs-lib/cljs-lib';
import * as jackInVersionResolution from './jack-in-version-resolution';

export type JackInDependencyKey = 'nrepl' | 'cider-nrepl' | 'cider/piggieback';

export type JackInDependencyVersions = Partial<Record<JackInDependencyKey, string>>;
export type JackInDependencyLatestVersions = Partial<
  Record<JackInDependencyKey, jackInVersionResolution.JackInLatestVersionInfo>
>;

const JACK_IN_DEPENDENCY_LIBRARIES: Record<JackInDependencyKey, string> = {
  nrepl: 'nrepl/nrepl',
  'cider-nrepl': 'cider/cider-nrepl',
  'cider/piggieback': 'cider/piggieback',
};

const JACK_IN_DEPENDENCY_KEYS = Object.keys(JACK_IN_DEPENDENCY_LIBRARIES) as JackInDependencyKey[];
const FIND_VERSIONS_COUNT = '40';

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

function parseFindVersionsOutput(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return cljsLib.parseEdn(line);
      } catch (error) {
        console.warn('[Calva] Failed to parse find-versions output line', line, error);
        return undefined;
      }
    })
    .map((data) => (data ? data['mvn/version'] : undefined))
    .filter(
      (version): version is string => typeof version === 'string' && version.trim().length > 0
    );
}

function getDepsCljJarPath(): string | undefined {
  const context = state.extensionContext;
  if (!context) {
    return undefined;
  }
  const jarPath = path.join(context.extensionPath, 'deps.clj.jar');
  return fs.existsSync(jarPath) ? jarPath : undefined;
}

async function fetchLatestVersion(
  library: string
): Promise<jackInVersionResolution.JackInLatestVersionInfo> {
  const args = ['-X:deps', 'find-versions', ':lib', library, ':n', FIND_VERSIONS_COUNT];
  const errors: string[] = [];

  try {
    const { stdout } = await execFileAsync('clojure', args);
    const versions = parseFindVersionsOutput(stdout);
    const latest = jackInVersionResolution.selectLatestStableAndPrerelease(versions);
    if (latest.stable || latest.prerelease) {
      return latest;
    }
    errors.push(`clojure output missing versions for ${library}`);
  } catch (error) {
    errors.push(`clojure failed: ${(error as Error).message}`);
  }

  const depsCljJarPath = getDepsCljJarPath();
  if (depsCljJarPath) {
    try {
      const { stdout } = await execFileAsync('java', ['-jar', depsCljJarPath, ...args]);
      const versions = parseFindVersionsOutput(stdout);
      const latest = jackInVersionResolution.selectLatestStableAndPrerelease(versions);
      if (latest.stable || latest.prerelease) {
        return latest;
      }
      errors.push(`deps.clj output missing versions for ${library}`);
    } catch (error) {
      errors.push(`deps.clj failed: ${(error as Error).message}`);
    }
  } else {
    errors.push('deps.clj.jar not available');
  }

  throw new Error(errors.join(' | '));
}

function normalizeStoredLatestVersionValue(
  value: unknown
): jackInVersionResolution.JackInLatestVersionInfo | undefined {
  if (typeof value === 'string') {
    const normalized = jackInVersionResolution.selectLatestStableAndPrerelease([value]);
    if (normalized.stable || normalized.prerelease) {
      return normalized;
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const stableRaw = (value as { stable?: unknown }).stable;
  const prereleaseRaw = (value as { prerelease?: unknown }).prerelease;
  const stable =
    typeof stableRaw === 'string' && stableRaw.trim().length > 0 ? stableRaw : undefined;
  const prerelease =
    typeof prereleaseRaw === 'string' && prereleaseRaw.trim().length > 0
      ? prereleaseRaw
      : undefined;

  if (!stable && !prerelease) {
    return undefined;
  }

  return { stable, prerelease };
}

function getStoredJackInDependencyVersions(): JackInDependencyLatestVersions {
  const context = state.extensionContext;
  if (!context) {
    return {};
  }

  const stored = context.globalState.get<Partial<Record<JackInDependencyKey, unknown>>>(
    GLOBAL_STATE_KEY,
    {}
  );
  const normalized: JackInDependencyLatestVersions = {};

  for (const key of JACK_IN_DEPENDENCY_KEYS) {
    const entry = normalizeStoredLatestVersionValue(stored[key]);
    if (entry) {
      normalized[key] = entry;
    }
  }

  return normalized;
}

async function storeJackInDependencyVersions(versions: JackInDependencyLatestVersions) {
  const context = state.extensionContext;
  if (!context) {
    return;
  }
  const current = getStoredJackInDependencyVersions();
  const merged: JackInDependencyLatestVersions = { ...current, ...versions };
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

export type VersionSource = 'configured' | 'stored' | 'default';

export type JackInVersionsDetail = {
  effective: Record<JackInDependencyKey, string>;
  sources: Record<JackInDependencyKey, VersionSource>;
  storedLatest: JackInDependencyLatestVersions;
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
    const defaultValue = defaults[key] ?? '';

    if (typeof configuredValue === 'string' && configuredValue.trim().length > 0) {
      effective[key] = configuredValue;
      sources[key] = 'configured';
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

export function formatLatestVersionsReport(indent = ''): string {
  const detail = getJackInVersionsDetail();
  const lines = [`${indent}Latest available nREPL dependency versions found on Clojars:`];
  for (const dep of JACK_IN_DEPENDENCY_KEYS) {
    const latest = detail.storedLatest[dep];
    const stable = latest?.stable ?? 'unknown';
    const prereleaseSuffix = latest?.prerelease ? ` (prerelease: ${latest.prerelease})` : '';
    const formatted = `${stable}${prereleaseSuffix}`;
    lines.push(`${indent}  ${dep}: ${formatted}`);
  }
  return lines.join('\n');
}

export function formatEffectiveVersionsReport(indent = ''): string {
  const detail = getJackInVersionsDetail();
  const lines = [`${indent}Effective nREPL dependency versions:`];
  for (const dep of JACK_IN_DEPENDENCY_KEYS) {
    const source = detail.sources[dep];
    const sourceLabel = source === 'configured' ? 'configured in settings' : 'Calva defaults';
    lines.push(`${indent}  ${dep}: ${detail.effective[dep]} (${sourceLabel})`);
  }
  return lines.join('\n');
}

export async function refreshJackInDependencyVersions(): Promise<void> {
  const context = state.extensionContext;
  if (!context) {
    return;
  }

  if (refreshPromise !== null) {
    return refreshPromise;
  }

  console.info('[Calva] Refreshing jack-in dependency versions');

  const promise = (async () => {
    const fetched: JackInDependencyLatestVersions = {};

    for (const key of JACK_IN_DEPENDENCY_KEYS) {
      const lib = JACK_IN_DEPENDENCY_LIBRARIES[key];
      try {
        const versions = await fetchLatestVersion(lib);
        fetched[key] = versions;
        const stableLabel = versions.stable ?? 'unknown';
        const prerelease = versions.prerelease;
        const s = `[Calva] Latest stable version for ${lib} resolved to`;
        if (prerelease) {
          console.info(`${s} ${stableLabel}, prerelease ${prerelease}`);
        } else {
          console.info(`${s} ${stableLabel}`);
        }
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
