import { workspace , window } from "vscode";

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

interface CustomCljsType {
    name: string,
    startCode?: string,
    builds?: string[],
    isStartedRegExp?: string,
    connectCode: string | Object,
    isConnectedRegExp?: string,
    printThisLineRegExp?: string
}

interface CLJJackInCode {
    code: string,
    continueStdOutRegExp?: string
}

interface ReplConnectSequence {
    name: string,
    projectType: ProjectTypes,
    afterCLJReplJackInCode?: CLJJackInCode,
    cljsType?: CljsTypes | CustomCljsType
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

const defaultCljsTypes = {
    "Figwheel Main": {
        name: "Figwheel Main",
        startCode: `(do (require 'figwheel.main.api) (figwheel.main.api/start %BUILDS%))`,
        builds: [],
        isStartedRegExp: "Prompt will show",
        connectCode: `(do (use 'figwheel.main.api) (figwheel.main.api/cljs-repl %BUILD%))`,
        isConnectedRegExp: "To quit, type: :cljs/quit"
    },
    "lein-figwheel": {
        name: "lein-figwheel",
        connectCode: "(do (use 'figwheel-sidecar.repl-api) (if (not (figwheel-sidecar.repl-api/figwheel-running?)) (figwheel-sidecar.repl-api/start-figwheel!)) (figwheel-sidecar.repl-api/cljs-repl))",
        isConnectedRegExp: "Prompt will show"
    },
    "shadow-cljs": {
        name: "shadow-cljs",
        connectCode: {
            build: `(shadow.cljs.devtools.api/nrepl-select %BUILD%)`,
            repl: `(shadow.cljs.devtools.api/%REPL%)`
        },
        builds: [],
        isConnectedRegExp: /:selected/
    }
};

/** Retrieve the replConnectSequences from the config */
function getConfigCustomConnectSequences(): ReplConnectSequence[] {
    let result: ReplConnectSequence[] = workspace.getConfiguration('calva')
    .get<ReplConnectSequence[]>("replConnectSequences", []);

    for (let conSeq of result) {
        if (conSeq.name == undefined || 
            conSeq.projectType == undefined) {
            
            window.showWarningMessage("Check your calva.replConnectSequences. "+
            "You need to supply name and projectType for every sequence. " +
            "After fixing the customSequences can be used.");
            
            return [];
        } 
    }

    return result;
}

/**
 * Retrieve the replConnectSequences and returns only that if only one was defined.
 * Otherwise the user defined will be combined with the defaults one to be returned.
 * @param projectType what default Sequences would be used (leiningen, clj, shadow-cljs)
 */
function getConnectSequences(projectTypes: string[]): ReplConnectSequence[] {
    let customSequences = getConfigCustomConnectSequences();

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
function getDefaultCljsType(cljsType: string): CustomCljsType {
    return defaultCljsTypes[cljsType];
}

export {
    getConnectSequences,
    getDefaultCljsType,
    ReplConnectSequence,
    CustomCljsType
}