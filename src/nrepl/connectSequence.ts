import * as vscode from "vscode";
import * as state from "../state";
import * as utilities from '../utilities';
import { getConfig } from '../config';

enum ProjectTypes {
    "Leiningen" = "Leiningen",
    "deps.edn" = "deps.edn",
    "shadow-cljs" = "shadow-cljs",
    "lein-shadow" = "lein-shadow",
    'generic' = 'generic'
}

enum CljsTypes {
    "Figwheel Main" = "Figwheel Main",
    "lein-figwheel" = "lein-figwheel",
    "shadow-cljs" = "shadow-cljs",
    "ClojureScript built-in for browser" = "ClojureScript built-in for browser",
    "ClojureScript built-in for node" = "ClojureScript built-in for node",
    "User provided" = "User provided",
    "none" = "none"
}

interface CljsTypeConfig {
    name: string,
    dependsOn?: CljsTypes,
    isStarted: boolean,
    startCode?: string,
    buildsRequired?: boolean,
    isReadyToStartRegExp?: string | RegExp,
    openUrlRegExp?: string | RegExp,
    shouldOpenUrl?: boolean,
    connectCode: string | Object,
    isConnectedRegExp?: string | RegExp,
    printThisLineRegExp?: string | RegExp
}

interface MenuSelections {
    leinProfiles?: string[],
    leinAlias?: string,
    cljAliases?: string[],
    cljsLaunchBuilds?: string[],
    cljsDefaultBuild?: string
}

interface ReplConnectSequence {
    name: string,
    projectType: ProjectTypes,
    afterCLJReplJackInCode?: string,
    cljsType: CljsTypes | CljsTypeConfig,
    menuSelections?: MenuSelections,
    nReplPortFile?: string[]
    jackInEnv?: Record<string, string>
}

const leiningenDefaults: ReplConnectSequence[] =
    [{
        name: "Leiningen",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes.none
    },
    {
        name: "Leiningen + Figwheel Main",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["Figwheel Main"]
    },
    {
        name: "Leiningen + shadow-cljs",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["shadow-cljs"],
        nReplPortFile: [".shadow-cljs", "nrepl.port"]
    },
    {
        name: "Leiningen + ClojureScript built-in for browser",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["ClojureScript built-in for browser"]
    },
    {
        name: "Leiningen + ClojureScript built-in for node",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["ClojureScript built-in for node"]
    },
    {
        name: "Leiningen + Legacy Figwheel",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["lein-figwheel"]
    }];

const cljDefaults: ReplConnectSequence[] =
    [{
        name: "deps.edn",
        projectType: ProjectTypes["deps.edn"],
        cljsType: CljsTypes.none
    },
    {
        name: "deps.edn + Figwheel Main",
        projectType: ProjectTypes["deps.edn"],
        cljsType: CljsTypes["Figwheel Main"]
    },
    {
        name: "deps.edn + shadow-cljs",
        projectType: ProjectTypes["deps.edn"],
        cljsType: CljsTypes["shadow-cljs"],
        nReplPortFile: [".shadow-cljs", "nrepl.port"]
    },
    {
        name: "deps.edn + ClojureScript built-in for browser",
        projectType: ProjectTypes["deps.edn"],
        cljsType: CljsTypes["ClojureScript built-in for browser"]
    },
    {
        name: "deps.edn + ClojureScript built-in for node",
        projectType: ProjectTypes["deps.edn"],
        cljsType: CljsTypes["ClojureScript built-in for node"]
    },
    {
        name: "deps.edn + Legacy Figwheel",
        projectType: ProjectTypes["deps.edn"],
        cljsType: CljsTypes["lein-figwheel"]
    }];

const shadowCljsDefaults: ReplConnectSequence[] = [{
    name: "shadow-cljs",
    projectType: ProjectTypes["shadow-cljs"],
    cljsType: CljsTypes["shadow-cljs"]
}]

const leinShadowDefaults: ReplConnectSequence[] = [{
    name: "Leiningen + lein-shadow",
    projectType: ProjectTypes["lein-shadow"],
    cljsType: CljsTypes["shadow-cljs"],
    nReplPortFile: [".shadow-cljs", "nrepl.port"]
}];

const genericDefaults: ReplConnectSequence[] = [{
    name: "Generic",
    projectType: ProjectTypes['generic'],
    cljsType: CljsTypes.none,
    nReplPortFile: ["nrepl.port"]
}];

const defaultSequences = {
    "lein": leiningenDefaults,
    "clj": cljDefaults,
    "shadow-cljs": shadowCljsDefaults,
    "lein-shadow": leinShadowDefaults,
    'generic': genericDefaults
};

const defaultCljsTypes: { [id: string]: CljsTypeConfig } = {
    "Figwheel Main": {
        name: "Figwheel Main",
        buildsRequired: true,
        isStarted: false,
        startCode: `(do (require 'figwheel.main.api) (figwheel.main.api/start %BUILDS%))`,
        isReadyToStartRegExp: /Prompt will show|Open(ing)? URL|already running/,
        openUrlRegExp: /(Starting Server at|Open(ing)? URL) (?<url>\S+)/,
        shouldOpenUrl: false,
        connectCode: `(do (use 'figwheel.main.api) (figwheel.main.api/cljs-repl %BUILD%))`,
        isConnectedRegExp: /To quit, type: :cljs\/quit/
    },
    "lein-figwheel": {
        name: "lein-figwheel",
        buildsRequired: false,
        isStarted: false,
        isReadyToStartRegExp: /Launching ClojureScript REPL for build/,
        openUrlRegExp: /Figwheel: Starting server at (?<url>\S+)/,
        // shouldOpenUrl: will be set at use-time of this config,
        connectCode: "(do (use 'figwheel-sidecar.repl-api) (if (not (figwheel-sidecar.repl-api/figwheel-running?)) (figwheel-sidecar.repl-api/start-figwheel!)) (figwheel-sidecar.repl-api/cljs-repl))",
        isConnectedRegExp: /To quit, type: :cljs\/quit/
    },
    "shadow-cljs": {
        name: "shadow-cljs",
        buildsRequired: true,
        isStarted: false,
        // isReadyToStartRegExp: /To quit, type: :cljs\/quit/,
        connectCode: {
            build: `(shadow.cljs.devtools.api/nrepl-select %BUILD%)`,
            repl: `(shadow.cljs.devtools.api/%REPL%)`
        },
        shouldOpenUrl: false,
        isConnectedRegExp: /To quit, type: :cljs\/quit/
        //isConnectedRegExp: /:selected/
    },
    "ClojureScript built-in for browser": {
        name: "ClojureScript built-in for browser",
        buildsRequired: false,
        isStarted: true,
        connectCode: "(do (require 'cljs.repl.browser) (cider.piggieback/cljs-repl (cljs.repl.browser/repl-env)))",
        isConnectedRegExp: "To quit, type: :cljs/quit"
    },
    "ClojureScript built-in for node": {
        name: "ClojureScript built-in for node",
        buildsRequired: false,
        isStarted: true,
        connectCode: "(do (require 'cljs.repl.node) (cider.piggieback/cljs-repl (cljs.repl.node/repl-env)))",
        isConnectedRegExp: "To quit, type: :cljs/quit"
    }
};

/** Retrieve the replConnectSequences from the config */
function getCustomConnectSequences(): ReplConnectSequence[] {
    let sequences: ReplConnectSequence[] = getConfig().replConnectSequences;

    for (let sequence of sequences) {
        if (sequence.name == undefined ||
            sequence.projectType == undefined ||
            sequence.cljsType == undefined) {

            vscode.window.showWarningMessage("Check your calva.replConnectSequences. You need to supply `name`, `projectType`, and `cljsType` for every sequence.", ...["Roger That!"]);

            return [];
        }
        if (sequence.projectType as string === 'Clojure CLI') {
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
    const defSequences = projectTypes.reduce((seqs, projectType) => seqs.concat(defaultSequences[projectType]), []);
    const defSequenceProjectTypes = [...new Set(defSequences.map(s => s.projectType))];
    const sequences = customSequences.filter(customSequence => defSequenceProjectTypes.includes(customSequence.projectType)).concat(defSequences);
    return sequences;
}

/**
 * Returns the CLJS-Type description of one of the build-in.
 * @param cljsType Build-in cljsType
 */
function getDefaultCljsType(cljsType: string): CljsTypeConfig {
    // TODO: Find a less hacky way to get dynamic config for lein-figwheel
    defaultCljsTypes["lein-figwheel"].shouldOpenUrl = getConfig().openBrowserWhenFigwheelStarted;
    return defaultCljsTypes[cljsType];
}

async function askForConnectSequence(cljTypes: string[], saveAs: string, logLabel: string): Promise<ReplConnectSequence> {
    // figure out what possible kinds of project we're in
    const sequences: ReplConnectSequence[] = getConnectSequences(cljTypes);
    const projectRootUri = state.getProjectRootUri();
    const saveAsFull = projectRootUri ? `${projectRootUri.toString()}/${saveAs}` : saveAs;
    const projectConnectSequenceName = await utilities.quickPickSingle({
        values: sequences.map(s => { return s.name }),
        placeHolder: "Please select a project type",
        saveAs: saveAsFull,
        autoSelect: true
    });
    if (!projectConnectSequenceName || projectConnectSequenceName.length <= 0) {
        state.analytics().logEvent("REPL", logLabel, "NoProjectTypePicked").send();
        return;
    }
    const sequence = sequences.find(seq => seq.name === projectConnectSequenceName);
    state.extensionContext.workspaceState.update('selectedCljTypeName', sequence.projectType);
    return sequence;
}

export {
    askForConnectSequence,
    getDefaultCljsType,
    CljsTypes,
    ReplConnectSequence,
    CljsTypeConfig,
    genericDefaults
}
