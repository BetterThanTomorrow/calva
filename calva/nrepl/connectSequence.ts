import { workspace } from "vscode";

enum ProjectTypes {
    "Leiningen",
    "Clojure-CLI",
    "shadow-cljs"
}

enum CljsTypes {
    "Figwheel Main",
    "lein-figwheel",
    "shadow-cljs"
}

interface CustomCljsType {
    startCode?: string,
    isStartedRegExp?: string,
    connectCode: string,
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
        name: "Clojure-CLI",
        projectType: ProjectTypes["Clojure-CLI"]
    },
    {
        name: "Clojure-CLI + Figwheel",
        projectType: ProjectTypes["Clojure-CLI"],
        cljsType: CljsTypes["lein-figwheel"]
    },
    {
        name: "Clujure-CLI + Figwheel Main",
        projectType: ProjectTypes["Clojure-CLI"],
        cljsType: CljsTypes["Figwheel Main"]
    }];

const shadowCljsDefaults: ReplConnectSequence[] = [{
    name: "shadow-cljs",
    projectType: ProjectTypes["shadow-cljs"],
    cljsType: CljsTypes["shadow-cljs"]
}]

const defaultSequences = {
    "leiningen": leiningenDefaults,
    "clj": cljDefaults,
    "shadow-cljs": shadowCljsDefaults
};

/** Retrieve the replConnectSequences from the config */
function getConfigcustomConnectSequences(): ReplConnectSequence[] {
    return workspace.getConfiguration('calva')
        .get<ReplConnectSequence[]>("replConnectSequences", []);
}

/**
 * Retrieve the replConnectSequences and returns only that if only one was defined.
 * Otherwise the user defined will be combined with the defaults one to be returned.
 * @param projectType what default Sequences would be used (leiningen, clj, shadow-cljs)
 */
function getConnectSequences(projectType: string) {
    let customSequences = getConfigcustomConnectSequences();
    if (customSequences.length == 1) {
        return customSequences;
    }
    return defaultSequences[projectType].slice().push(customSequences.push());
}

export {
    getConnectSequences
}