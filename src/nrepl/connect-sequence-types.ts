enum ProjectTypes {
  'Leiningen' = 'Leiningen',
  'deps.edn' = 'deps.edn',
  'shadow-cljs' = 'shadow-cljs',
  'lein-shadow' = 'lein-shadow',
  'Gradle' = 'Gradle',
  'babashka' = 'babashka',
  'nbb' = 'nbb',
  'basilisp' = 'basilisp',
  'joyride' = 'joyride',
  'generic' = 'generic',
  'custom' = 'custom',
  'cljs-only' = 'cljs-only',
}

enum CljsTypes {
  'Figwheel Main' = 'Figwheel Main',
  'lein-figwheel' = 'lein-figwheel',
  'shadow-cljs' = 'shadow-cljs',
  'ClojureScript built-in for browser' = 'ClojureScript built-in for browser',
  'ClojureScript built-in for node' = 'ClojureScript built-in for node',
  'ClojureScript nREPL' = 'ClojureScript nREPL',
  'User provided' = 'User provided',
  'none' = 'none',
}

interface CljsTypeConfig {
  name: string;
  dependsOn?: CljsTypes;
  isStarted: boolean;
  startCode?: string;
  buildsRequired?: boolean;
  isReadyToStartRegExp?: string | RegExp;
  openUrlRegExp?: string | RegExp;
  shouldOpenUrl?: boolean;
  connectCode: string | { build: string; repl: string };
  isConnectedRegExp?: string | RegExp;
  printThisLineRegExp?: string | RegExp;
}

interface MenuSelections {
  leinProfiles?: string[];
  leinAlias?: string;
  cljAliases?: string[];
  cljsLaunchBuilds?: string[];
  cljsDefaultBuild?: string;
}

interface SessionNamesConfig {
  main?: string;
  promoted?: string;
}

type GlobValue = string | string[];

interface SessionGlobTierConfig {
  'always-claim'?: GlobValue;
  'is-fallback-for'?: GlobValue;
}

type SessionGlobsConfigValue = GlobValue | SessionGlobTierConfig;

type SessionGlobsConfig = Record<string, SessionGlobsConfigValue>;

interface ReplConnectSequence {
  name: string;
  projectType: ProjectTypes;
  customJackInCommandLine?: string;
  autoSelectForConnect?: boolean;
  autoSelectForJackIn?: boolean;
  projectRootPath?: string[];
  afterMainReplConnectedCode?: string;
  /** @deprecated Use afterMainReplConnectedCode instead. */
  afterCLJReplJackInCode?: string;
  cljsType: CljsTypes | CljsTypeConfig;
  menuSelections?: MenuSelections;
  nReplPortFile?: string[];
  extraNReplMiddleware?: string[];
  jackInEnv?: Record<string, string>;
  replSessionNames?: SessionNamesConfig;
  replSessionGlobs?: SessionGlobsConfig;
}

export {
  ProjectTypes,
  CljsTypes,
  CljsTypeConfig,
  MenuSelections,
  SessionNamesConfig,
  SessionGlobTierConfig,
  SessionGlobsConfig,
  ReplConnectSequence,
};
