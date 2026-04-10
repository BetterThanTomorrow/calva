enum ProjectTypes {
  'Leiningen' = 'Leiningen',
  'deps.edn' = 'deps.edn',
  'shadow-cljs' = 'shadow-cljs',
  'lein-shadow' = 'lein-shadow',
  'Gradle' = 'Gradle',
  'babashka' = 'babashka',
  'nbb' = 'nbb',
  'basilisp' = 'basilisp',
  'let-go' = 'let-go',
  'joyride' = 'joyride',
  'scittle' = 'scittle',
  'squint' = 'squint',
  'epupp' = 'epupp',
  'generic' = 'generic',
  'clj-projectless' = 'clj-projectless',
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
  primary?: string;
  secondary?: string;
}

type FilePatternsValue = string | string[];

interface SessionFilePatternsRulesConfig {
  'always-claim'?: FilePatternsValue;
  'is-fallback-for'?: FilePatternsValue;
}

type SessionFilePatternsConfigValue = FilePatternsValue | SessionFilePatternsRulesConfig;

type SessionFilePatternsConfig = Record<string, SessionFilePatternsConfigValue>;

type SelectedPortBehaviour = 'connect' | 'prompt';

interface ReplConnectSequence {
  name: string;
  projectType: ProjectTypes;
  customJackInCommandLine?: string;
  autoSelectForConnect?: boolean;
  autoSelectForJackIn?: boolean;
  projectRootPath?: string[];
  afterPrimaryReplConnectedCode?: string;
  /** @deprecated Use afterPrimaryReplConnectedCode instead. */
  afterCLJReplJackInCode?: string;
  cljsType?: CljsTypes | CljsTypeConfig;
  menuSelections?: MenuSelections;
  nReplPortFile?: string[];
  extraNReplMiddleware?: string[];
  jackInEnv?: Record<string, string>;
  replSessionNames?: SessionNamesConfig;
  replSessionFilePatterns?: SessionFilePatternsConfig;
  fallbackPort?: number;
  selectedPortBehaviour?: SelectedPortBehaviour;
}

export {
  ProjectTypes,
  CljsTypes,
  CljsTypeConfig,
  MenuSelections,
  SessionNamesConfig,
  SessionFilePatternsRulesConfig,
  SessionFilePatternsConfig,
  SelectedPortBehaviour,
  ReplConnectSequence,
};
