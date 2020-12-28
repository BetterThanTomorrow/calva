import * as vscode from "vscode";
import * as state from "../state";
import * as utilities from '../utilities';

enum ProjectTypes {
    "Leiningen" = "Leiningen",
    "Clojure CLI" = "Clojure CLI",
    "shadow-cljs" = "shadow-cljs",
    "lein-shadow" = "lein-shadow",
    'generic' = 'generic'
}

enum CljsTypes {
    "Figwheel Main" = "Figwheel Main",
    "lein-figwheel" = "lein-figwheel",
    "shadow-cljs" = "shadow-cljs",
    "Nashorn" = "Nashorn",
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
        name: "Leiningen + Legacy Figwheel",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["lein-figwheel"]
    },
    {
        name: "Leiningen + Nashorn",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["Nashorn"]
    }];

const cljDefaults: ReplConnectSequence[] =
    [{
        name: "Clojure CLI",
        projectType: ProjectTypes["Clojure CLI"],
        cljsType: CljsTypes.none
    },
    {
        name: "Clojure CLI + Figwheel Main",
        projectType: ProjectTypes["Clojure CLI"],
        cljsType: CljsTypes["Figwheel Main"]
    },
    {
        name: "Clojure CLI + shadow-cljs",
        projectType: ProjectTypes["Clojure CLI"],
        cljsType: CljsTypes["shadow-cljs"],
        nReplPortFile: [".shadow-cljs", "nrepl.port"]
    },
    {
        name: "Clojure CLI + Legacy Figwheel",
        projectType: ProjectTypes["Clojure CLI"],
        cljsType: CljsTypes["lein-figwheel"]
    },
    {
        name: "Clojure CLI + Nashorn",
        projectType: ProjectTypes["Clojure CLI"],
        cljsType: CljsTypes["Nashorn"]
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
    "Nashorn": {
        name: "Nashorn",
        buildsRequired: false,
        isStarted: true,
        connectCode: "(do (require 'cljs.repl.nashorn) (cider.piggieback/cljs-repl (cljs.repl.nashorn/repl-env)))",
        isConnectedRegExp: "To quit, type: :cljs/quit"
    }
};

/** Retrieve the replConnectSequences from the config */
function getCustomConnectSequences(): ReplConnectSequence[] {
    let sequences: ReplConnectSequence[] = state.config().replConnectSequences;

    for (let sequence of sequences) {
        if (sequence.name == undefined ||
            sequence.projectType == undefined ||
            sequence.cljsType == undefined) {

            vscode.window.showWarningMessage("Check your calva.replConnectSequences. You need to supply `name`, `projectType`, and `cljsType` for every sequence.", ...["Roger That!"]);

            return [];
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
    const defSequences = projectTypes.reduce((seqs, projecType) => seqs.concat(defaultSequences[projecType]), []);
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
    defaultCljsTypes["lein-figwheel"].shouldOpenUrl = state.config().openBrowserWhenFigwheelStarted;
    return defaultCljsTypes[cljsType];
}

async function askForConnectSequence(cljTypes: string[], saveAs: string, logLabel: string): Promise<ReplConnectSequence> {
    // figure out what possible kinds of project we're in
    const sequences: ReplConnectSequence[] = getConnectSequences(cljTypes);
    const projectConnectSequenceName = await utilities.quickPickSingle({
        values: sequences.map(s => { return s.name }),
        placeHolder: "Please select a project type",
        saveAs: `${state.getProjectRootUri().toString()}/${saveAs}`,
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
    CljsTypeConfig
}
