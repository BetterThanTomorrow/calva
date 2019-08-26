import { workspace , window } from "vscode";
import { config } from "../state";

enum ProjectTypes {
    "Leiningen" = "Leiningen",
    "Clojure CLI" = "Clojure CLI",
    "shadow-cljs" = "shadow-cljs"
}

enum CljsTypes {
    "Figwheel Main" = "Figwheel Main",
    "lein-figwheel" = "lein-figwheel",
    "shadow-cljs" = "shadow-cljs"
}

interface CljsTypeConfig {
    name: string,
    startCode?: string,
    builds?: string[],
    isReadyToStartRegExp?: string | RegExp,
    openUrlRegExp?: string | RegExp,
    shouldOpenURL?: boolean,
    connectCode: string | Object,
    isConnectedRegExp?: string | RegExp,
    printThisLineRegExp?: string | RegExp
}

interface ReplConnectSequence {
    name: string,
    projectType: ProjectTypes,
    afterCLJReplJackInCode?: string,
    cljsType?: CljsTypes | CljsTypeConfig
}

const leiningenDefaults: ReplConnectSequence[] =
    [{
        name: "Leiningen",
        projectType: ProjectTypes.Leiningen
    },
    {
        name: "Leiningen + Figwheel",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["lein-figwheel"]
    },
    {
        name: "Leiningen + Figwheel Main",
        projectType: ProjectTypes.Leiningen,
        cljsType: CljsTypes["Figwheel Main"]
    }];

const cljDefaults: ReplConnectSequence[] =
    [{
        name: "Clojure CLI",
        projectType: ProjectTypes["Clojure CLI"]
    },
    {
        name: "Clojure CLI + Figwheel",
        projectType: ProjectTypes["Clojure CLI"],
        cljsType: CljsTypes["lein-figwheel"]
    },
    {
        name: "Clojure CLI + Figwheel Main",
        projectType: ProjectTypes["Clojure CLI"],
        cljsType: CljsTypes["Figwheel Main"]
    }];

const shadowCljsDefaults: ReplConnectSequence[] = [{
    name: "shadow-cljs",
    projectType: ProjectTypes["shadow-cljs"],
    cljsType: CljsTypes["shadow-cljs"]
}]

const defaultSequences = {
    "lein": leiningenDefaults,
    "clj": cljDefaults,
    "shadow-cljs": shadowCljsDefaults
};

const defaultCljsTypes: { [id: string]: CljsTypeConfig } = {
    "Figwheel Main": {
        name: "Figwheel Main",
        startCode: `(do (require 'figwheel.main.api) (figwheel.main.api/start %BUILDS%))`,
        builds: [],
        isReadyToStartRegExp: /Starting Server at|already running/,
        openUrlRegExp: /Starting Server at (\S+)/,
        shouldOpenURL: false,
        connectCode: `(do (use 'figwheel.main.api) (figwheel.main.api/cljs-repl %BUILD%))`,
        isConnectedRegExp: /To quit, type: :cljs\/quit/
    },
    "lein-figwheel": {
        name: "lein-figwheel",
        isReadyToStartRegExp: /Launching ClojureScript REPL for build/,
        openUrlRegExp: /Figwheel: Starting server at (\S+)/,
        shouldOpenURL: config().openBrowserWhenFigwheelStarted,
        connectCode: "(do (use 'figwheel-sidecar.repl-api) (if (not (figwheel-sidecar.repl-api/figwheel-running?)) (figwheel-sidecar.repl-api/start-figwheel!)) (figwheel-sidecar.repl-api/cljs-repl))",
        isConnectedRegExp: /To quit, type: :cljs\/quit/
    },
    "shadow-cljs": {
        name: "shadow-cljs",
        isReadyToStartRegExp: /To quit, type: :cljs\/quit/,
        connectCode: {
            build: `(shadow.cljs.devtools.api/nrepl-select %BUILD%)`,
            repl: `(shadow.cljs.devtools.api/%REPL%)`
        },
        shouldOpenURL: false,
        builds: [],
        isConnectedRegExp: /:selected/
    }
};

/** Retrieve the replConnectSequences from the config */
function getCustomConnectSequences(): ReplConnectSequence[] {
    let sequences = config().replConnectSequences;

    for (let sequence of sequences) {
        if (sequence.name == undefined || 
            sequence.projectType == undefined) {
            
            window.showWarningMessage("Check your calva.replConnectSequences. "+
            "You need to supply name and projectType for every sequence. " +
            "After fixing the customSequences can be used.");
            
            return [];
        } 
    }

    return sequences;
}

/**
 * Retrieve the replConnectSequences and returns only that if only one was defined.
 * Otherwise the user defined will be combined with the defaults one to be returned.
 * @param projectType what default Sequences would be used (leiningen, clj, shadow-cljs)
 */
function getConnectSequences(projectTypes: string[]): ReplConnectSequence[] {
    let customSequences = getCustomConnectSequences();

    let result = [];
    for (let pType of projectTypes) {
        console.log("pType", pType);
        console.log("pSeq", defaultSequences[pType]);
        result = result.concat(defaultSequences[pType]);
    }
    return result.concat(customSequences);
}

/**
 * Returns the CLJS-Type description of one of the build-in.
 * @param cljsType Build-in cljsType
 */
function getDefaultCljsType(cljsType: string): CljsTypeConfig {
    // TODO: Find a less hacky way to get dynamic config for lein-figwheel
    defaultCljsTypes["lein-figwheel"].shouldOpenURL = config().openBrowserWhenFigwheelStarted;
    return defaultCljsTypes[cljsType];
}

export {
    getConnectSequences,
    getDefaultCljsType,
    ReplConnectSequence,
    CljsTypeConfig
}