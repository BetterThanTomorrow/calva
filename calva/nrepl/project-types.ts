import * as state from '../state';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as utilities from '../utilities';
import _ from 'lodash';

import { CljsTypes, ReplConnectSequence } from './connectSequence';
const { parseForms, parseEdn } = require('../../cljs-out/cljs-lib');

export const isWin = /^win/.test(process.platform);

export type ProjectType = {
    name: string;
    cljsTypes: string[];
    cmd: string;
    winCmd: string;
    commandLine: (cljsType: CljsTypes) => any;
    useWhenExists: string;
    nReplPortFile: () => string;
};

export function nreplPortFile(subPath: string): string {
    try {
        return path.resolve(state.getProjectRoot(), subPath);
    } catch (e) {
        console.log(e);
    }
    return subPath;
}

export function shadowConfigFile() {
    return state.getProjectRoot() + '/shadow-cljs.edn';
}

export function shadowBuilds() {
    let parsed = parseEdn(fs.readFileSync(shadowConfigFile(), 'utf8').toString()),
        builds: string[] = _.map(parsed.builds, (_v, key) => { return ":" + key });
    builds.push("node-repl");
    builds.push("browser-repl")
    return builds;
}


const cliDependencies = {
    "nrepl": "0.6.0",
    "cider/cider-nrepl": "0.21.1",
}

const cljsDependencies: { [id: string]: Object } = {
    "lein-figwheel": {
        "cider/piggieback": "0.4.1",
        "figwheel-sidecar": "0.5.18"
    },
    "Figwheel Main": {
        "cider/piggieback": "0.4.1",
        "com.bhauman/figwheel-main": "0.2.3"
    },
    "shadow-cljs": {
        "cider/cider-nrepl": "0.21.1",
    },
    "User provided": {}
}

const leinPluginDependencies = {
    "cider/cider-nrepl": "0.21.1"
}
const leinDependencies = {
    "nrepl": "0.6.0",
}
const middleware = ["cider.nrepl/cider-middleware"];
const cljsMiddleware = ["cider.piggieback/wrap-cljs-repl"];

const projectTypes: { [id: string]: ProjectType } = {
    "lein": {
        name: "Leiningen",
        cljsTypes: ["Figwheel", "Figwheel Main"],
        cmd: "lein",
        winCmd: "cmd.exe",
        useWhenExists: "project.clj",
        nReplPortFile: () => {
            return nreplPortFile(".nrepl-port");
        },
        /** Build the Commandline args for a lein-project. 
         * 1. Parsing the project.clj
         * 2. Let the user choose a alias
         * 3. Let the user choose profiles to use
         * 4. Add nedded middleware deps to args
         * 5. Add all profiles choosed by the user
         * 6. Use alias if selected otherwise repl :headless
        */
        commandLine: async (cljsType: CljsTypes) => {
            let out: string[] = [];
            let dependencies = { ...leinDependencies, ...(cljsType ? cljsDependencies[cljsType] : {}) };
            let keys = Object.keys(dependencies);
            let data = fs.readFileSync(path.resolve(state.getProjectRoot(), "project.clj"), 'utf8').toString();
            let parsed;
            try {
                parsed = parseForms(data);
            } catch (e) {
                vscode.window.showErrorMessage("Could not parse project.clj");
                throw e;
            }
            let profiles: string[] = [];
            let alias: string;
            const defproject = parsed.find(x => x[0] == "defproject");

            if (defproject) {
                let aliasesIndex = defproject.indexOf("aliases");
                if (aliasesIndex > -1) {
                    try {
                        let aliases: string[] = [];
                        const aliasesMap = defproject[aliasesIndex + 1];
                        aliases = [...profiles, ...Object.keys(aliasesMap).map((v, k) => { return v })];
                        if (aliases.length) {
                            aliases.unshift("No alias");
                            alias = await utilities.quickPickSingle({ values: aliases, saveAs: `${state.getProjectRoot()}/lein-cli-alias`, placeHolder: "Choose alias to run" });
                            alias = (alias == "No alias") ? undefined : alias;
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage("The project.clj file is not sane. " + error.message);
                        console.log(error);
                    }
                }
            }

            if (defproject != undefined) {
                let profilesIndex = defproject.indexOf("profiles");
                if (profilesIndex > -1) {
                    try {
                        const profilesMap = defproject[profilesIndex + 1];
                        profiles = [...profiles, ...Object.keys(profilesMap).map((v, k) => { return ":" + v })];
                        if (profiles.length) {
                            profiles = await utilities.quickPickMulti({ values: profiles, saveAs: `${state.getProjectRoot()}/lein-cli-profiles`, placeHolder: "Pick any profiles to launch with" });
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage("The project.clj file is not sane. " + error.message);
                        console.log(error);
                    }
                }
            }

            if (isWin) {
                out.push("/d", "/c", "lein");
            }
            const q = isWin ? '' : "'",
                dQ = '"',
                s = isWin ? "^ " : " ";

            for (let i = 0; i < keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":dependencies", "conj", `${q + "[" + dep + dQ + dependencies[dep] + dQ + "]" + q}`, '--');
            }

            keys = Object.keys(leinPluginDependencies);
            for (let i = 0; i < keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":plugins", "conj", `${q + "[" + dep + dQ + leinPluginDependencies[dep] + dQ + "]" + q}`, '--');
            }

            const useMiddleware = [...middleware, ...(cljsType ? cljsMiddleware : [])];
            for (let mw of useMiddleware) {
                out.push("update-in", `${q + '[:repl-options' + s + ':nrepl-middleware]' + q}`, "conj", `'["${mw}"]'`, '--');
            }

            if (profiles.length) {
                out.push("with-profile", profiles.map(x => `+${x.substr(1)}`).join(','));
            }

            if (alias) {
                out.push(alias);
            } else {
                out.push("repl", ":headless");
            }

            return out;
        }
    },
    /* // Works but analysing the possible launch environment is unsatifactory for now, use the cli :)
    "boot": {
        name: "Boot",
        cmd: "boot",
        winCmd: "boot.exe",
        useWhenExists: "build.boot",      
        commandLine: () => {
            let out: string[] = [];
            for(let dep in cliDependencies)
                out.push("-d", dep+":"+cliDependencies[dep]);
            return [...out, "-i", initEval, "repl"];
        }
    },
    */
    "clj": {
        name: "Clojure CLI",
        cljsTypes: ["Figwheel", "Figwheel Main"],
        cmd: "clojure",
        winCmd: "powershell.exe",
        useWhenExists: "deps.edn",
        nReplPortFile: () => {
            return nreplPortFile(".nrepl-port");
        },
        /** Build the Commandline args for a clj-project.
         * 1. Read the deps.edn and parsed it 
         * 2. Present the user all found aliases
         * 3. Define needed dependencies and middlewares used by calva
         * 4. Check if the selected aliases have main-opts
         * 5. If main-opts in alias => just use aliases
         * 6. if no main-opts => supply our own main to run nrepl with middlewares
         */
        commandLine: async (cljsType) => {
            let out: string[] = [];
            let data = fs.readFileSync(path.join(state.getProjectRoot(), "deps.edn"), 'utf8').toString();
            let parsed;
            try {
                parsed = parseEdn(data);
            } catch (e) {
                vscode.window.showErrorMessage("Could not parse deps.edn");
                throw e;
            }
            let aliases: string[] = [];
            if (parsed.aliases != undefined) {
                aliases = await utilities.quickPickMulti({ values: Object.keys(parsed.aliases).map(x => ":" + x), saveAs: `${state.getProjectRoot()}/clj-cli-aliases`, placeHolder: "Pick any aliases to launch with" });
            }

            const dependencies = { ...cliDependencies, ...(cljsType ? cljsDependencies[cljsType] : {}) },
                useMiddleware = [...middleware, ...(cljsType ? cljsMiddleware : [])];
            const aliasesOption = aliases.length > 0 ? `-A${aliases.join("")}` : '';
            let aliasHasMain: boolean = false;
            for (let ali in aliases) {
                let aliasKey = aliases[ali].substr(1);
                let alias = parsed.aliases[aliasKey];
                aliasHasMain = (alias["main-opts"] != undefined);
                if (aliasHasMain)
                    break;
            }

            const dQ = isWin ? '""' : '"';
            for (let dep in dependencies)
                out.push(dep + ` {:mvn/version ${dQ}${dependencies[dep]}${dQ}}`)

            let args = ["-Sdeps", `'${"{:deps {" + out.join(' ') + "}}"}'`];

            if (aliasHasMain) {
                args.push(aliasesOption);
            } else {
                args.push(aliasesOption, "-m", "nrepl.cmdline", "--middleware", `"[${useMiddleware.join(' ')}]"`);
            }

            if (isWin) {
                args.unshift("clojure");
            }
            return args;
        }
    },
    "shadow-cljs": {
        name: "shadow-cljs",
        cljsTypes: [],
        cmd: "npx",
        winCmd: "npx.cmd",
        useWhenExists: "shadow-cljs.edn",
        nReplPortFile: () => {
            return nreplPortFile(path.join(".shadow-cljs", "nrepl.port"));
        },
        /**
         *  Build the Commandline args for a shadow-project.
         */
        commandLine: async (cljsType) => {
            let args: string[] = [];
            for (let dep in { ...(cljsType ? cljsDependencies[cljsType] : {})})
                args.push("-d", dep + ":" + cljsDependencies[cljsType][dep]);

            const foundBuilds = await shadowBuilds();
            let selectedBuilds = await utilities.quickPickMulti({ values: foundBuilds.filter(x => x[0] == ":"), placeHolder: "Select builds to start", saveAs: `${state.getProjectRoot()}/shadowcljs-jack-in` })
            if (!selectedBuilds || !selectedBuilds.length)
                return;
            return ["shadow-cljs", ...args, "watch", ...selectedBuilds];
        }
    }
}

/** Given the name of a project in project types, find that project. */
export function getProjectTypeForName(name: string) {
    for (let id in projectTypes)
        if (projectTypes[id].name == name)
            return projectTypes[id];
}

export async function detectProjectTypes(): Promise<string[]> {
    let rootDir = state.getProjectRoot(),
        cljProjTypes = []
    for (let clj in projectTypes) {
        try {
            fs.accessSync(rootDir + "/" + projectTypes[clj].useWhenExists);
            cljProjTypes.push(clj);
        } catch (_e) { }
    }
    return cljProjTypes;
}

export function getCljsTypeName(connectSequence: ReplConnectSequence) {
    let cljsTypeName;
    if (connectSequence.cljsType == undefined) {
        cljsTypeName = "";
    }
    else if (typeof connectSequence.cljsType == "string") {
        cljsTypeName = connectSequence.cljsType;
    }
    else {
        cljsTypeName = "custom";
    }
    return cljsTypeName;
}