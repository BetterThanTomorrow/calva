import * as vscode from 'vscode';
import * as path from 'path';
import * as state from '../state';
import * as utilities from '../utilities';
import * as config from '../config';
import { ConnectType } from './connect-types';
import * as output from '../results-output/output';
import * as projectRoot from '../project-root';
import * as csTypes from './connect-sequence-types';

// Project types that only support connect (not jack-in)
// These have no commandLine and no startFunction in project-types.ts
const connectOnlyProjectTypes = ['scittle'];

const leiningenBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'Leiningen',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes.none,
  },
  {
    name: 'Leiningen + Figwheel Main',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['Figwheel Main'],
  },
  {
    name: 'Leiningen + shadow-cljs',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['shadow-cljs'],
  },
  {
    name: 'Leiningen + ClojureScript built-in for browser',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['ClojureScript built-in for browser'],
  },
  {
    name: 'Leiningen + ClojureScript built-in for node',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['ClojureScript built-in for node'],
  },
  {
    name: 'Leiningen + Legacy Figwheel',
    projectType: csTypes.ProjectTypes.Leiningen,
    cljsType: csTypes.CljsTypes['lein-figwheel'],
  },
];

const cljBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'deps.edn',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes.none,
  },
  {
    name: 'deps.edn + Figwheel Main',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['Figwheel Main'],
  },
  {
    name: 'deps.edn + shadow-cljs',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['shadow-cljs'],
  },
  {
    name: 'deps.edn + ClojureScript built-in for browser',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['ClojureScript built-in for browser'],
  },
  {
    name: 'deps.edn + ClojureScript built-in for node',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['ClojureScript built-in for node'],
  },
  {
    name: 'deps.edn + Legacy Figwheel',
    projectType: csTypes.ProjectTypes['deps.edn'],
    cljsType: csTypes.CljsTypes['lein-figwheel'],
  },
];

const shadowCljsBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'shadow-cljs',
    projectType: csTypes.ProjectTypes['shadow-cljs'],
    cljsType: csTypes.CljsTypes['shadow-cljs'],
  },
];

const leinShadowBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'Leiningen + lein-shadow',
    projectType: csTypes.ProjectTypes['lein-shadow'],
    cljsType: csTypes.CljsTypes['shadow-cljs'],
  },
];

const gradleBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'Gradle',
    projectType: csTypes.ProjectTypes.Gradle,
    cljsType: csTypes.CljsTypes.none,
  },
];

const genericBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'Generic',
    projectType: csTypes.ProjectTypes['generic'],
    cljsType: csTypes.CljsTypes.none,
  },
];

const cljProjectlessBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'Clojure (projectless)',
    projectType: csTypes.ProjectTypes['clj-projectless'],
    cljsType: csTypes.CljsTypes.none,
  },
];

const customBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'Custom',
    projectType: csTypes.ProjectTypes['custom'],
    cljsType: csTypes.CljsTypes.none,
  },
];

const cljsOnlyBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'ClojureScript nREPL Server',
    projectType: csTypes.ProjectTypes['cljs-only'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
  },
];

const babashkaBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'Babashka',
    projectType: csTypes.ProjectTypes['babashka'],
    cljsType: csTypes.CljsTypes.none,
  },
];

const nbbBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'nbb',
    projectType: csTypes.ProjectTypes['nbb'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
  },
];

const joyrideBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'joyride',
    projectType: csTypes.ProjectTypes['joyride'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
  },
];

const scittleBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'scittle',
    projectType: csTypes.ProjectTypes['scittle'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
  },
];

const squintBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'squint',
    projectType: csTypes.ProjectTypes['squint'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
  },
];

const basilispBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'basilisp',
    projectType: csTypes.ProjectTypes['basilisp'],
    cljsType: csTypes.CljsTypes.none,
  },
];

const letGoBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'let-go',
    projectType: csTypes.ProjectTypes['let-go'],
    cljsType: csTypes.CljsTypes.none,
  },
];

const epuppBuiltIns: csTypes.ReplConnectSequence[] = [
  {
    name: 'epupp',
    projectType: csTypes.ProjectTypes['epupp'],
    cljsType: csTypes.CljsTypes['ClojureScript nREPL'],
  },
];

const builtInSequences = {
  lein: leiningenBuiltIns,
  clj: cljBuiltIns,
  'shadow-cljs': shadowCljsBuiltIns,
  'lein-shadow': leinShadowBuiltIns,
  gradle: gradleBuiltIns,
  generic: genericBuiltIns,
  'clj-projectless': cljProjectlessBuiltIns,
  custom: customBuiltIns,
  babashka: babashkaBuiltIns,
  nbb: nbbBuiltIns,
  basilisp: basilispBuiltIns,
  'let-go': letGoBuiltIns,
  joyride: joyrideBuiltIns,
  scittle: scittleBuiltIns,
  squint: squintBuiltIns,
  epupp: epuppBuiltIns,
  'cljs-only': cljsOnlyBuiltIns,
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

/** Retrieve the replConnectSequences from the config */
function getCustomConnectSequences(): csTypes.ReplConnectSequence[] {
  const sequences: csTypes.ReplConnectSequence[] = config.getConfig().replConnectSequences;

  for (const sequence of sequences) {
    if (sequence.name == undefined || sequence.projectType == undefined) {
      void vscode.window.showWarningMessage(
        'Check your calva.replConnectSequences. You need to supply `name` and `projectType` for every sequence.',
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
 * User defined sequences will be combined with the built-in sequences.
 * @param projectType what built-in sequences would be used (leiningen, clj, shadow-cljs)
 */
function getConnectSequences(projectTypes: string[]): csTypes.ReplConnectSequence[] {
  const customSequences = getCustomConnectSequences();
  const builtInSeqs = projectTypes.reduce(
    (seqs, projectType) => seqs.concat(builtInSequences[projectType]),
    []
  );
  const builtInSeqProjectTypes = [...new Set(builtInSeqs.map((s) => s.projectType))];
  const sequences = customSequences
    .filter((customSequence) => builtInSeqProjectTypes.includes(customSequence.projectType))
    .concat(builtInSeqs);
  return sequences;
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
    const builtInSequence = sequences.find(
      (s) => s.name.toLocaleLowerCase() === userSpecifiedProjectType.toLocaleLowerCase()
    );

    if (builtInSequence) {
      output.appendLineOtherOut(
        [
          `Auto-selecting project type "${builtInSequence.name}".`,
          `You can change this from settings:`,
          connectSequencesDocLink,
          '\n',
        ].join('\n')
      );

      return builtInSequence;
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

  const builtInSequence = await getUserSpecifiedSequence(sequences, connectType, disableAutoSelect);

  let projectConnectSequenceName = builtInSequence?.name;

  if (!projectConnectSequenceName) {
    const filteredSequences =
      connectType === ConnectType.JackIn
        ? sequences.filter((s) => {
            // Allow sequences that define their own jack-in command
            if (s.customJackInCommandLine) {
              return true;
            }
            // Exclude connect-only project types (like scittle) that don't have a custom command
            if (connectOnlyProjectTypes.includes(s.projectType)) {
              return false;
            }
            // Exclude custom sequences without customJackInCommandLine
            if (s.projectType === 'custom') {
              return false;
            }
            return true;
          })
        : sequences;
    const pickedSequence = await utilities.quickPickSingle({
      title: `${menuTitleType}: Project Type/Connect Sequence`,
      values: filteredSequences.map((s) => s.name).map((a) => ({ label: a })),
      placeHolder: 'Please select a project type',
      saveAs: saveAsPath,
      autoSelect: true,
    });

    projectConnectSequenceName = pickedSequence?.label;

    if (projectConnectSequenceName) {
      output.appendLineOtherOut(`Connecting using "${projectConnectSequenceName}" project type.`);
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
  genericBuiltIns,
  cljsOnlyBuiltIns,
  cljBuiltIns,
  joyrideBuiltIns,
};

export * from './connect-sequence-types';
