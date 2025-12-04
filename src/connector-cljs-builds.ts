import type { CljsTypeConfig, CljsTypes } from './nrepl/connect-sequence-types';
import { keywordize } from './util/string';

/**
 * Checks if a CLJS type configuration represents a shadow-cljs REPL.
 */
export function isShadowCljsReplType(cljsType: CljsTypeConfig | CljsTypes): boolean {
  if (typeof cljsType === 'string') {
    return cljsType === 'shadow-cljs';
  }

  if (typeof cljsType === 'object' && cljsType !== null) {
    return cljsType.name === 'shadow-cljs' || cljsType.dependsOn === 'shadow-cljs';
  }

  return false;
}

/**
 * Updates the init code with the selected build.
 * Handles both object-style and string-style init code formats.
 *
 * Object-style initCode has separate `repl` and `build` properties:
 * - `repl`: Used for node-repl and browser-repl, replaces %REPL%
 * - `build`: Used for named builds, replaces %BUILD% with keywordized build
 *
 * String-style initCode just replaces %BUILD% with the quoted build name.
 */
export function updateInitCode(
  build: string,
  initCode: string | { repl: string; build: string }
): string | undefined {
  if (build && typeof initCode === 'object') {
    if (['node-repl', 'browser-repl'].includes(build)) {
      return initCode.repl.replace('%REPL%', build);
    } else {
      return initCode.build.replace('%BUILD%', keywordize(build));
    }
  } else if (build && typeof initCode === 'string') {
    return initCode.replace('%BUILD%', `"${build}"`);
  }
  return undefined;
}

/**
 * Parses a Clojure vector result string into an array of strings.
 * Handles formats like '[:app :app-too]' or '[":app" ":app-too"]'
 */
export function parseClojureVectorResult(result: string): string[] {
  if (!result) {
    return [];
  }
  return result
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(/\s+/)
    .map((s) => s.trim())
    .map((s) => s.replace(/^"|"$/g, '')) // Strip quotes from string results
    .filter((s) => s.length > 0);
}

/**
 * Returns the Clojure code to query active builds for a given CLJS type.
 * Returns undefined if the type doesn't support build queries.
 */
export function getActiveBuildQueryCode(cljsTypeName: string): string | undefined {
  if (cljsTypeName.includes('shadow-cljs')) {
    return '(mapv str (shadow.cljs.devtools.api/active-builds))';
  } else if (cljsTypeName.includes('Figwheel Main')) {
    return '(vec (keys @figwheel.main/build-registry))';
  }
  return undefined;
}

/**
 * Normalizes a build key by removing the leading colon if present.
 * This allows consistent comparison between ':app' and 'app'.
 */
export function normalizeBuildKey(build: string): string {
  return build.startsWith(':') ? build.substring(1) : build;
}

/**
 * Builds that don't require active watchers to be available.
 * These are shadow-cljs built-in REPL types that start their own runtime.
 */
export const NO_WATCHER_REQUIRED_BUILDS = ['node-repl', 'browser-repl'] as const;

/**
 * Checks if a build requires an active watcher to be available.
 */
export function buildRequiresWatcher(build: string): boolean {
  const normalized = normalizeBuildKey(build);
  return !NO_WATCHER_REQUIRED_BUILDS.includes(
    normalized as typeof NO_WATCHER_REQUIRED_BUILDS[number]
  );
}

/**
 * Determines if a build is currently active (has a running watcher).
 * Returns true if:
 * - The build doesn't require a watcher (node-repl, browser-repl)
 * - No active builds info is available (we can't know, so assume active)
 * - The build is in the active builds list
 */
export function isBuildActive(build: string, activeBuilds: string[] | undefined): boolean {
  if (!buildRequiresWatcher(build)) {
    return true;
  }
  if (!activeBuilds) {
    return true; // Can't determine, assume available
  }
  const normalizedBuild = normalizeBuildKey(build);
  return activeBuilds.some((ab) => normalizeBuildKey(ab) === normalizedBuild);
}
