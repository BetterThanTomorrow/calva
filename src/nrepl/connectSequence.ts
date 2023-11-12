import * as vscode from 'vscode';
import * as path from 'path';
import * as state from '../state';
import * as utilities from '../utilities';
import { Config, getConfig } from '../config';
import * as outputWindow from '../results-output/results-doc';
import { formatAsLineComments } from '../results-output/util';
import { ConnectType } from './connect-types';

enum ProjectTypes {
  'Leiningen' = 'Leiningen',
  'deps.edn' = 'deps.edn',
  'shadow-cljs' = 'shadow-cljs',
  'lein-shadow' = 'lein-shadow',
  'Gradle' = 'Gradle',
  'babashka' = 'babashka',
  'nbb' = 'nbb',
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

interface ReplConnectSequence {
  name: string;
  projectType: ProjectTypes;
  customJackInCommandLine?: string;
  autoSelectForConnect?: boolean;
  autoSelectForJackIn?: boolean;
  projectRootPath?: string[];
  afterCLJReplJackInCode?: string;
  cljsType: CljsTypes | CljsTypeConfig;
  menuSelections?: MenuSelections;
  nReplPortFile?: string[];
  jackInEnv?: Record<string, string>;
}

const leiningenDefaults: ReplConnectSequence[] = [
  {
    name: 'Leiningen',
    projectType: ProjectTypes.Leiningen,
    cljsType: CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + Figwheel Main',
    projectType: ProjectTypes.Leiningen,
    cljsType: CljsTypes['Figwheel Main'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + shadow-cljs',
    projectType: ProjectTypes.Leiningen,
    cljsType: CljsTypes['shadow-cljs'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + ClojureScript built-in for browser',
    projectType: ProjectTypes.Leiningen,
    cljsType: CljsTypes['ClojureScript built-in for browser'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + ClojureScript built-in for node',
    projectType: ProjectTypes.Leiningen,
    cljsType: CljsTypes['ClojureScript built-in for node'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + Legacy Figwheel',
    projectType: ProjectTypes.Leiningen,
    cljsType: CljsTypes['lein-figwheel'],
    nReplPortFile: ['.nrepl-port'],
  },
];

const cljDefaults: ReplConnectSequence[] = [
  {
    name: 'deps.edn',
    projectType: ProjectTypes['deps.edn'],
    cljsType: CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + Figwheel Main',
    projectType: ProjectTypes['deps.edn'],
    cljsType: CljsTypes['Figwheel Main'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + shadow-cljs',
    projectType: ProjectTypes['deps.edn'],
    cljsType: CljsTypes['shadow-cljs'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + ClojureScript built-in for browser',
    projectType: ProjectTypes['deps.edn'],
    cljsType: CljsTypes['ClojureScript built-in for browser'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + ClojureScript built-in for node',
    projectType: ProjectTypes['deps.edn'],
    cljsType: CljsTypes['ClojureScript built-in for node'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + Legacy Figwheel',
    projectType: ProjectTypes['deps.edn'],
    cljsType: CljsTypes['lein-figwheel'],
    nReplPortFile: ['.nrepl-port'],
  },
];

const shadowCljsDefaults: ReplConnectSequence[] = [
  {
    name: 'shadow-cljs',
    projectType: ProjectTypes['shadow-cljs'],
    cljsType: CljsTypes['shadow-cljs'],
    nReplPortFile: ['.shadow-cljs', 'nrepl.port'],
  },
];

const leinShadowDefaults: ReplConnectSequence[] = [
  {
    name: 'Leiningen + lein-shadow',
    projectType: ProjectTypes['lein-shadow'],
    cljsType: CljsTypes['shadow-cljs'],
    nReplPortFile: ['.shadow-cljs', 'nrepl.port'],
  },
];

const gradleDefaults: ReplConnectSequence[] = [
  {
    name: 'Gradle',
    projectType: ProjectTypes.Gradle,
    cljsType: CljsTypes.none,
  },
];

const genericDefaults: ReplConnectSequence[] = [
  {
    name: 'Generic',
    projectType: ProjectTypes['generic'],
    cljsType: CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
];

const customDefaults: ReplConnectSequence[] = [
  {
    name: 'Custom',
    projectType: ProjectTypes['custom'],
    cljsType: CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
];

const cljsOnlyDefaults: ReplConnectSequence[] = [
  {
    name: 'ClojureScript nREPL Server',
    projectType: ProjectTypes['cljs-only'],
    cljsType: CljsTypes['ClojureScript nREPL'],
    nReplPortFile: ['.nrepl-port'],
  },
];

const babashkaDefaults: ReplConnectSequence[] = [
  {
    name: 'Babashka',
    projectType: ProjectTypes['babashka'],
    cljsType: CljsTypes.none,
    nReplPortFile: ['.bb-nrepl.port'],
  },
];

const nbbDefaults: ReplConnectSequence[] = [
  {
    name: 'nbb',
    projectType: ProjectTypes['nbb'],
    cljsType: CljsTypes['ClojureScript nREPL'],
    nReplPortFile: ['.nrepl-port'],
  },
];

const joyrideDefaults: ReplConnectSequence[] = [
  {
    name: 'joyride',
    projectType: ProjectTypes['joyride'],
    cljsType: CljsTypes['ClojureScript nREPL'],
  },
];

const defaultSequences = {
  lein: leiningenDefaults,
  clj: cljDefaults,
  'shadow-cljs': shadowCljsDefaults,
  'lein-shadow': leinShadowDefaults,
  gradle: gradleDefaults,
  generic: genericDefaults,
  custom: customDefaults,
  babashka: babashkaDefaults,
  nbb: nbbDefaults,
  joyride: joyrideDefaults,
  'cljs-only': cljsOnlyDefaults,
};

const defaultCljsTypes: { [id: string]: CljsTypeConfig } = {
  'Figwheel Main': {
    name: 'Figwheel Main',
    buildsRequired: true,
    isStarted: false,
    startCode: `(do (require 'figwheel.main.api) (figwheel.main.api/start %BUILDS%))`,
    isReadyToStartRegExp: /Prompt will show|Open(ing)? URL|already running/,
    openUrlRegExp: /(Starting Server at|Open(ing)? URL) (?<url>\S+)/,
    shouldOpenUrl: false,
    connectCode: `(do (use 'figwheel.main.api) (figwheel.main.api/cljs-repl %BUILD%))`,
    isConnectedRegExp: /To quit, type: :cljs\/quit/,
  },
  'lein-figwheel': {
    name: 'lein-figwheel',
    buildsRequired: false,
    isStarted: false,
    isReadyToStartRegExp: /Launching ClojureScript REPL for build/,
    openUrlRegExp: /Figwheel: Starting server at (?<url>\S+)/,
    // shouldOpenUrl: will be set at use-time of this config,
    connectCode:
      "(do (use 'figwheel-sidecar.repl-api) (if (not (figwheel-sidecar.repl-api/figwheel-running?)) (figwheel-sidecar.repl-api/start-figwheel!)) (figwheel-sidecar.repl-api/cljs-repl))",
    isConnectedRegExp: /To quit, type: :cljs\/quit/,
  },
  'shadow-cljs': {
    name: 'shadow-cljs',
    buildsRequired: true,
    isStarted: false,
    // isReadyToStartRegExp: /To quit, type: :cljs\/quit/,
    startCode:
      "(do (require 'shadow.cljs.devtools.server) (shadow.cljs.devtools.server/start!) (require 'shadow.cljs.devtools.api) (doseq [build [%BUILDS%]] (shadow.cljs.devtools.api/watch build)))",
    connectCode: {
      build: `(do (require 'shadow.cljs.devtools.api) (shadow.cljs.devtools.api/nrepl-select %BUILD%))`,
      repl: `(do (require 'shadow.cljs.devtools.api) (shadow.cljs.devtools.api/%REPL%))`,
    },
    shouldOpenUrl: false,
    isConnectedRegExp: /To quit, type: :cljs\/quit/,
    // isConnectedRegExp: /:selected/,
  },
  'ClojureScript built-in for browser': {
    name: 'ClojureScript built-in for browser',
    buildsRequired: false,
    isStarted: true,
    connectCode:
      "(do (require 'cljs.repl.browser) (cider.piggieback/cljs-repl (cljs.repl.browser/repl-env)))",
    isConnectedRegExp: 'To quit, type: :cljs/quit',
  },
  'ClojureScript built-in for node': {
    name: 'ClojureScript built-in for node',
    buildsRequired: false,
    isStarted: true,
    connectCode:
      "(do (require 'cljs.repl.node) (cider.piggieback/cljs-repl (cljs.repl.node/repl-env)))",
    isConnectedRegExp: 'To quit, type: :cljs/quit',
  },
  'ClojureScript nREPL': {
    name: 'ClojureScript nREPL',
    buildsRequired: false,
    isStarted: true,
    connectCode: ':always-succeeding-connect-code',
    isConnectedRegExp: 'always-succeeding-connect-code',
  },
};

const connectSequencesDocLink = `  - See https://calva.io/connect-sequences/`;

const defaultProjectSettingMsg = (project: string) =>
  formatAsLineComments(
    [
      `Connecting using "${project}" project type.`,
      `You can make Calva auto-select this.`,
      connectSequencesDocLink,
      '\n',
    ].join('\n')
  );

/** Retrieve the replConnectSequences from the config */
function getCustomConnectSequences(): ReplConnectSequence[] {
  const sequences: ReplConnectSequence[] = getConfig().replConnectSequences;

  for (const sequence of sequences) {
    if (sequence.name == undefined || sequence.projectType == undefined) {
      void vscode.window.showWarningMessage(
        'Check your calva.replConnectSequences. You need to supply `name`, `projectType`, and `cljsType` for every sequence.',
        ...['Roger That!']
      );

      return [];
    }
    if ((sequence.projectType as string) === 'Clojure CLI') {
      sequence.projectType = ProjectTypes['deps.edn'];
    }
  }

  return sequences;
}

/**
 * User defined sequences will be combined with the default sequences.
 * @param projectType what default sequences would be used (leiningen, clj, shadow-cljs)
 */
function getConnectSequences(projectTypes: string[]): ReplConnectSequence[] {
  const customSequences = getCustomConnectSequences();
  const defSequences = projectTypes.reduce(
    (seqs, projectType) => seqs.concat(defaultSequences[projectType]),
    []
  );
  const defSequenceProjectTypes = [...new Set(defSequences.map((s) => s.projectType))];
  const sequences = customSequences
    .filter((customSequence) => defSequenceProjectTypes.includes(customSequence.projectType))
    .concat(defSequences);
  return sequences;
}

function informAboutDefaultProjectForJackIn(project: string) {
  outputWindow.appendLine(defaultProjectSettingMsg(project));
}

/**
 * Returns the CLJS-Type description of one of the build-in.
 * @param cljsType Build-in cljsType
 */
function getDefaultCljsType(cljsType: string): CljsTypeConfig {
  // TODO: Find a less hacky way to get dynamic config for lein-figwheel
  defaultCljsTypes['lein-figwheel'].shouldOpenUrl = getConfig().openBrowserWhenFigwheelStarted;
  return defaultCljsTypes[cljsType];
}

function getUserSpecifiedSequence(
  sequences: ReplConnectSequence[],
  connectType: ConnectType,
  disableAutoSelect: boolean
): ReplConnectSequence | undefined {
  const autoSelectedSequence = disableAutoSelect
    ? undefined
    : sequences.find((s) =>
        connectType === ConnectType.Connect ? s.autoSelectForConnect : s.autoSelectForJackIn
      );
  const userSpecifiedProjectType = autoSelectedSequence?.name;

  if (userSpecifiedProjectType) {
    const defaultSequence = sequences.find(
      (s) => s.name.toLocaleLowerCase() === userSpecifiedProjectType.toLocaleLowerCase()
    );

    if (defaultSequence) {
      outputWindow.appendLine(
        formatAsLineComments(
          [
            `Auto-selecting project type "${defaultSequence.name}".`,
            `You can change this from settings:`,
            connectSequencesDocLink,
            '\n',
          ].join('\n')
        )
      );

      return defaultSequence;
    } else {
      outputWindow.appendLine(
        formatAsLineComments(
          [
            `Project type "${userSpecifiedProjectType}" not found.`,
            `You need to update the auto-select setting.`,
            connectSequencesDocLink,
            '\n',
          ].join('\n')
        )
      );
    }
  }
}

async function askForConnectSequence(
  cljTypes: string[],
  connectType: ConnectType,
  disableAutoSelect: boolean
): Promise<ReplConnectSequence> {
  const [saveAs, logLabel, menuTitleType] =
    connectType === ConnectType.Connect
      ? ['connect-type', 'ConnectInterrupted', 'Connect']
      : ['jack-in-type', 'JackInInterrupted', 'Jack-in'];
  const sequences: ReplConnectSequence[] = getConnectSequences(cljTypes);

  const projectRootUri = state.getProjectRootUri();
  const saveAsPath = projectRootUri ? `${projectRootUri.toString()}/${saveAs}` : saveAs;

  const defaultSequence = getUserSpecifiedSequence(sequences, connectType, disableAutoSelect);

  const projectConnectSequenceName =
    defaultSequence?.name ??
    (await utilities.quickPickSingle({
      title: `${menuTitleType}: Project Type/Connect Sequence`,
      values: sequences
        .filter((s) => !(s.projectType === 'custom' && !s.customJackInCommandLine))
        .map((s) => s.name)
        .map((a) => ({ label: a })),
      placeHolder: 'Please select a project type',
      saveAs: saveAsPath,
      autoSelect: true,
    }));

  !defaultSequence && void informAboutDefaultProjectForJackIn(projectConnectSequenceName);

  if (!projectConnectSequenceName || projectConnectSequenceName.length <= 0) {
    state.analytics().logEvent('REPL', logLabel, 'NoProjectTypePicked').send();
    return;
  }
  const sequence = sequences.find((seq) => seq.name === projectConnectSequenceName);

  if (
    sequence.projectRootPath &&
    state.getProjectRootUri().fsPath !==
      state.resolvePath(path.join(...sequence.projectRootPath)).fsPath
  ) {
    throw new Error(
      `The connect sequence "${sequence.name}" is configured for project root "${path.join(
        ...sequence.projectRootPath
      )}. Please select a different connect sequence or change the project root setting for the sequence.`
    );
  }

  void state.extensionContext.workspaceState.update('selectedCljTypeName', sequence.projectType);
  return sequence;
}

export {
  getCustomConnectSequences,
  askForConnectSequence,
  getConnectSequences,
  getDefaultCljsType,
  CljsTypes,
  ReplConnectSequence,
  CljsTypeConfig,
  genericDefaults,
  cljsOnlyDefaults,
  cljDefaults,
  joyrideDefaults,
};
