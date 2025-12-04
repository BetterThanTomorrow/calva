import * as vscode from 'vscode';
import * as path from 'path';
import * as state from '../state';
import * as utilities from '../utilities';
import * as config from '../config';
import { ConnectType } from './connect-types';
import * as output from '../results-output/output';
import * as projectRoot from '../project-root';
import * as csTypes from './connect-sequence-types';

const leiningenDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'Leiningen',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + Figwheel Main',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['Figwheel Main'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + shadow-cljs',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['shadow-cljs'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + ClojureScript built-in for browser',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['ClojureScript built-in for browser'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + ClojureScript built-in for node',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['ClojureScript built-in for node'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'Leiningen + Legacy Figwheel',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['lein-figwheel'],
    nReplPortFile: ['.nrepl-port'],
  },
];

const cljDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'deps.edn',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + Figwheel Main',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['Figwheel Main'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + shadow-cljs',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['shadow-cljs'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + ClojureScript built-in for browser',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['ClojureScript built-in for browser'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + ClojureScript built-in for node',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['ClojureScript built-in for node'],
    nReplPortFile: ['.nrepl-port'],
  },
  {
    name: 'deps.edn + Legacy Figwheel',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['lein-figwheel'],
    nReplPortFile: ['.nrepl-port'],
  },
];

const shadowCljsDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'shadow-cljs',
    projectType: csTypes.ProjectTypes['shadow-cljs'],
    cljsType: csTypes.CljsTypes['shadow-cljs'],
    nReplPortFile: ['.shadow-cljs', 'nrepl.port'],
  },
];

const leinShadowDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'Leiningen + lein-shadow',
    projectType: csTypes.ProjectTypes['lein-shadow'],
    cljsType: csTypes.CljsTypes['shadow-cljs'],
    nReplPortFile: ['.shadow-cljs', 'nrepl.port'],
  },
];

const gradleDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'Gradle',
    projectType: csTypes.ProjectTypes.Gradle,
    cljsType: csTypes.CljsTypes.none,
  },
];

const genericDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'Generic',
    projectType: csTypes.ProjectTypes['generic'],
    cljsType: csTypes.CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
];

const cljProjectlessDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'Clojure (projectless)',
    projectType: csTypes.ProjectTypes['clj-projectless'],
    cljsType: csTypes.CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
];

const customDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'Custom',
    projectType: csTypes.ProjectTypes['custom'],
    cljsType: csTypes.CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
  },
];

const cljsOnlyDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'ClojureScript nREPL Server',
    projectType: csTypes.ProjectTypes['cljs-only'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
    nReplPortFile: ['.nrepl-port'],
    replSessionNames: { primary: 'cljs' },
    replSessionFilePatterns: { primary: ['*.cljs'] },
  },
];

const babashkaDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'Babashka',
    projectType: csTypes.ProjectTypes['babashka'],
    cljsType: csTypes.CljsTypes.none,
    nReplPortFile: ['.bb-nrepl.port'],
    replSessionNames: { primary: 'bb' },
  },
];

const nbbDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'nbb',
    projectType: csTypes.ProjectTypes['nbb'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
    nReplPortFile: ['.nrepl-port'],
    replSessionNames: { primary: 'nbb' },
  },
];

const joyrideDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'joyride',
    projectType: csTypes.ProjectTypes['joyride'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
    replSessionNames: { primary: 'joyride' },
  },
];

const scittleDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'scittle',
    projectType: csTypes.ProjectTypes['scittle'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
    replSessionNames: { primary: 'scittle' },
    defaultPort: 1339,
  },
];

const basilispDefaults: csTypes.ReplConnectSequence[] = [
  {
    name: 'basilisp',
    projectType: csTypes.ProjectTypes['basilisp'],
    cljsType: csTypes.CljsTypes.none,
    nReplPortFile: ['.nrepl-port'],
    replSessionNames: { primary: 'basilisp' },
  },
];

const defaultSequences = {
  lein: leiningenDefaults,
  clj: cljDefaults,
  'shadow-cljs': shadowCljsDefaults,
  'lein-shadow': leinShadowDefaults,
  gradle: gradleDefaults,
  generic: genericDefaults,
  'clj-projectless': cljProjectlessDefaults,
  custom: customDefaults,
  babashka: babashkaDefaults,
  nbb: nbbDefaults,
  basilisp: basilispDefaults,
  joyride: joyrideDefaults,
  scittle: scittleDefaults,
  'cljs-only': cljsOnlyDefaults,
};

const defaultCljsTypes: { [id: string]: csTypes.CljsTypeConfig } = {
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
  [
    `Connecting using "${project}" project type.`,
    `You can make Calva auto-select this.`,
    connectSequencesDocLink,
    '\n',
  ].join('\n');

/** Retrieve the replConnectSequences from the config */
function getCustomConnectSequences(): csTypes.ReplConnectSequence[] {
  const sequences: csTypes.ReplConnectSequence[] = config.getConfig().replConnectSequences;

  for (const sequence of sequences) {
    if (sequence.name == undefined || sequence.projectType == undefined) {
      void vscode.window.showWarningMessage(
        'Check your calva.replConnectSequences. You need to supply `name`, `projectType`, and `cljsType` for every sequence.',
        ...['Roger That!']
      );

      return [];
    }
    if ((sequence.projectType as string) === 'Clojure CLI') {
      sequence.projectType = csTypes.ProjectTypes['deps.edn'];
    }

    if (sequence.replSessionNames) {
      const keys = Object.values(sequence.replSessionNames).filter(
        (key): key is string => typeof key === 'string'
      );
      const validKeyRegExp = /^[\p{L}\d_-]+$/u;
      for (const key of keys) {
        if (!validKeyRegExp.test(key)) {
          void vscode.window.showWarningMessage(
            `Invalid session key "${key}" in connect sequence "${sequence.name}". Session keys must only contain letters, numbers, underscores, and dashes.`,
            ...['Roger That!']
          );
          return [];
        }
      }
    }

    if (sequence.replSessionFilePatterns) {
      const isPatternValue = (value: unknown): value is string | string[] => {
        if (typeof value === 'string') {
          return value.trim().length > 0;
        }
        if (Array.isArray(value)) {
          return (
            value.length > 0 &&
            value.every((pattern) => typeof pattern === 'string' && pattern.trim().length > 0)
          );
        }
        return false;
      };

      const isTierConfig = (value: unknown): value is csTypes.SessionFilePatternsRulesConfig =>
        typeof value === 'object' && value !== null && !Array.isArray(value);

      const isValidTierEntry = (tierValue?: string | string[]): boolean =>
        tierValue ? isPatternValue(tierValue) : false;

      const isValidPatternEntry = (
        value: string | string[] | csTypes.SessionFilePatternsRulesConfig
      ): boolean => {
        if (isPatternValue(value)) {
          return true;
        }
        if (isTierConfig(value)) {
          return (
            isValidTierEntry(value['always-claim']) || isValidTierEntry(value['is-fallback-for'])
          );
        }
        return false;
      };

      for (const [name, value] of Object.entries(sequence.replSessionFilePatterns)) {
        if (!isValidPatternEntry(value)) {
          void vscode.window.showWarningMessage(
            `Invalid file pattern configuration for session "${name}" in connect sequence "${sequence.name}". Provide a pattern string/array or an object with always-claim/is-fallback-for pattern arrays.`,
            ...['Roger That!']
          );
          return [];
        }
      }
    }
  }

  return sequences;
}

/**
 * User defined sequences will be combined with the default sequences.
 * @param projectType what default sequences would be used (leiningen, clj, shadow-cljs)
 */
function getConnectSequences(projectTypes: string[]): csTypes.ReplConnectSequence[] {
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
  output.appendLineOtherOut(defaultProjectSettingMsg(project));
}

/**
 * Returns the CLJS-Type description of one of the build-in.
 * @param cljsType Build-in cljsType
 */
function getDefaultCljsType(cljsType: string): csTypes.CljsTypeConfig {
  // TODO: Find a less hacky way to get dynamic config for lein-figwheel
  defaultCljsTypes['lein-figwheel'].shouldOpenUrl =
    config.getConfig().openBrowserWhenFigwheelStarted;
  return defaultCljsTypes[cljsType];
}

async function getUserSpecifiedSequence(
  sequences: csTypes.ReplConnectSequence[],
  connectType: ConnectType,
  disableAutoSelect: boolean
): Promise<csTypes.ReplConnectSequence | undefined> {
  const autoSelectedSequences = disableAutoSelect
    ? []
    : sequences.filter((s) =>
        connectType === ConnectType.Connect ? s.autoSelectForConnect : s.autoSelectForJackIn
      );
  const candidatePaths = await projectRoot.findProjectRoots();
  const active_uri = vscode.window.activeTextEditor?.document.uri;
  const closestRootPath: vscode.Uri = active_uri
    ? projectRoot.findClosestParent(active_uri, candidatePaths)
    : undefined;
  const autoSelectedSequence =
    autoSelectedSequences.find(
      (s) =>
        s.projectRootPath &&
        vscode.workspace.asRelativePath(path.join(...s.projectRootPath)) ===
          vscode.workspace.asRelativePath(closestRootPath)
    ) || autoSelectedSequences.shift();
  const userSpecifiedProjectType = autoSelectedSequence?.name;

  if (userSpecifiedProjectType) {
    const defaultSequence = sequences.find(
      (s) => s.name.toLocaleLowerCase() === userSpecifiedProjectType.toLocaleLowerCase()
    );

    if (defaultSequence) {
      output.appendLineOtherOut(
        [
          `Auto-selecting project type "${defaultSequence.name}".`,
          `You can change this from settings:`,
          connectSequencesDocLink,
          '\n',
        ].join('\n')
      );

      return defaultSequence;
    } else {
      output.appendLineOtherErr(`Project type "${userSpecifiedProjectType}" not found.`);
      output.appendLineOtherOut(
        [`You need to update the auto-select setting.`, connectSequencesDocLink, '\n'].join('\n')
      );
    }
  }
}

async function askForConnectSequence(
  cljTypes: string[],
  connectType: ConnectType,
  disableAutoSelect: boolean
): Promise<csTypes.ReplConnectSequence> {
  const [saveAs, logLabel, menuTitleType] =
    connectType === ConnectType.Connect
      ? ['connect-type', 'ConnectInterrupted', 'Connect']
      : ['jack-in-type', 'JackInInterrupted', 'Jack-in'];
  const sequences: csTypes.ReplConnectSequence[] = getConnectSequences(cljTypes);

  const projectRootUri = state.getProjectRootUri();
  const saveAsPath = projectRootUri ? `${projectRootUri.toString()}/${saveAs}` : saveAs;

  const defaultSequence = await getUserSpecifiedSequence(sequences, connectType, disableAutoSelect);

  let projectConnectSequenceName = defaultSequence?.name;

  if (!projectConnectSequenceName) {
    const pickedSequence = await utilities.quickPickSingle({
      title: `${menuTitleType}: Project Type/Connect Sequence`,
      values: sequences
        .filter((s) => !(s.projectType === 'custom' && !s.customJackInCommandLine))
        .map((s) => s.name)
        .map((a) => ({ label: a })),
      placeHolder: 'Please select a project type',
      saveAs: saveAsPath,
      autoSelect: true,
    });

    projectConnectSequenceName = pickedSequence.label;

    if (projectConnectSequenceName) {
      informAboutDefaultProjectForJackIn(projectConnectSequenceName);
    }
  }

  if (!projectConnectSequenceName || projectConnectSequenceName.length <= 0) {
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
  genericDefaults,
  cljsOnlyDefaults,
  cljDefaults,
  joyrideDefaults,
};

export * from './connect-sequence-types';
