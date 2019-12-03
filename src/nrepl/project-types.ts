import * as state from '../state';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as utilities from '../utilities';
import * as pprint from '../printer';

import { keywordize, unKeywordize } from '../util/string';
import { CljsTypes, ReplConnectSequence } from './connectSequence';
const { parseForms, parseEdn } = require('../../out/cljs-lib/cljs-lib');

export const isWin = /^win/.test(process.platform);

export type ProjectType = {
    name: string;
    cljsTypes: string[];
    cmd: string;
    winCmd: string;
    commandLine: (connectSequence: ReplConnectSequence, cljsType: CljsTypes) => any;
    useWhenExists: string;
    nReplPortFile: string[];
};

export function nreplPortFile(connectSequence: ReplConnectSequence): string {
    let subPath: string = ".nrepl-port";
    if (connectSequence.nReplPortFile) {
        subPath = path.join(...connectSequence.nReplPortFile);
    } else {
        const projectType: ProjectType | string = connectSequence.projectType;
        subPath = path.join(...getProjectTypeForName(projectType).nReplPortFile)
    }
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

export function shadowBuilds(): string[] {
    const parsed = parseEdn(fs.readFileSync(shadowConfigFile(), 'utf8').toString());
    return [...Object.keys(parsed.builds).map((key: string) => { return ":" + key }), ...["node-repl", "browser-repl"]];
}

const NREPL_VERSION = "0.6.0",
    CIDER_NREPL_VERSION = "0.22.4",
    PIGGIEBACK_VERSION = "0.4.1",
    SIDECAR_VERSION = "0.5.18",
    FIGWHEEL_MAIN_VERSION = "0.2.3";

const cliDependencies = {
    "nrepl": NREPL_VERSION,
    "cider/cider-nrepl": CIDER_NREPL_VERSION,
}

const cljsCommonDependencies = {
    "cider/piggieback": PIGGIEBACK_VERSION
}

const cljsDependencies: { [id: string]: Object } = {
    "lein-figwheel": {
        "figwheel-sidecar": SIDECAR_VERSION
    },
    "Figwheel Main": {
        "com.bhauman/figwheel-main": FIGWHEEL_MAIN_VERSION
    },
    "shadow-cljs": {
        "cider/cider-nrepl": CIDER_NREPL_VERSION,
    },
    "Nashorn": {
    },
    "User provided": {
    }
}

const leinPluginDependencies = {
    "cider/cider-nrepl": CIDER_NREPL_VERSION
}
const leinDependencies = {
    "nrepl": NREPL_VERSION,
}
const middleware = ["cider.nrepl/cider-middleware"];
const cljsMiddleware = ["cider.piggieback/wrap-cljs-repl"];

const serverPrinterDependencies = pprint.getServerSidePrinterDependencies();

const projectTypes: { [id: string]: ProjectType } = {
    "lein": {
        name: "Leiningen",
        cljsTypes: ["Figwheel", "Figwheel Main"],
        cmd: "lein",
        winCmd: "cmd.exe",
        useWhenExists: "project.clj",
        nReplPortFile: [".nrepl-port"],
        /** Build the Commandline args for a lein-project. 
         * 1. Parsing the project.clj
         * 2. Let the user choose a alias
         * 3. Let the user choose profiles to use
         * 4. Add nedded middleware deps to args
         * 5. Add all profiles choosed by the user
         * 6. Use alias if selected otherwise repl :headless
        */
        commandLine: async (connectSequence: ReplConnectSequence, cljsType: CljsTypes) => {
            let out: string[] = [];
            const dependencies = { ...leinDependencies,
                ...(cljsType ? { ...cljsCommonDependencies, ...cljsDependencies[cljsType] } : {}),
                ...serverPrinterDependencies
            };
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
                        const menuSelections = connectSequence.menuSelections,
                            leinAlias = menuSelections ? menuSelections.leinAlias : undefined;
                        if (leinAlias) {
                            alias = unKeywordize(leinAlias);
                        } else if (leinAlias === null) {
                            alias = undefined;
                        } else {
                            let aliases: string[] = [];
                            const aliasesMap = defproject[aliasesIndex + 1];
                            aliases = [...profiles, ...Object.keys(aliasesMap).map((v, k) => { return v })];
                            if (aliases.length) {
                                aliases.unshift("No alias");
                                alias = await utilities.quickPickSingle({
                                    values: aliases,
                                    saveAs: `${state.getProjectRoot()}/lein-cli-alias`,
                                    placeHolder: "Choose alias to launch with"
                                });
                                alias = (alias == "No alias") ? undefined : alias;
                            }
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage("The project.clj file is not sane. " + error.message);
                        console.log(error);
                    }
                }
            }

            if (defproject != undefined) {
                const profilesIndex = defproject.indexOf("profiles"),
                    menuSelections = connectSequence.menuSelections,
                    launchProfiles = menuSelections ? menuSelections.leinProfiles : undefined;
                if (launchProfiles) {
                    profiles = [...profiles, ...launchProfiles.map(keywordize)];
                } else {
                    let projectProfiles = profilesIndex > -1 ? Object.keys(defproject[profilesIndex + 1]) : [];
                    const myProfiles = state.config().myLeinProfiles;
                    if (myProfiles && myProfiles.length) {
                        projectProfiles = [...projectProfiles, ...myProfiles];
                    }
                    if (projectProfiles.length) {
                        profiles = [...profiles, ...projectProfiles.map(keywordize)];
                        if (profiles.length) {
                            profiles = await utilities.quickPickMulti({
                                values: profiles,
                                saveAs: `${state.getProjectRoot()}/lein-cli-profiles`,
                                placeHolder: "Pick any profiles to launch with"
                            });
                        }
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
                out.push("with-profile", profiles.map(x => `+${unKeywordize(x)}`).join(','));
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
        nReplPortFile: [".nrepl-port"],
        /** Build the Commandline args for a clj-project.
         * 1. Read the deps.edn and parsed it 
         * 2. Present the user all found aliases
         * 3. Define needed dependencies and middlewares used by calva
         * 4. Check if the selected aliases have main-opts
         * 5. If main-opts in alias => just use aliases
         * 6. if no main-opts => supply our own main to run nrepl with middlewares
         */
        commandLine: async (connectSequence, cljsType) => {
            let out: string[] = [];
            let data = fs.readFileSync(path.join(state.getProjectRoot(), "deps.edn"), 'utf8').toString();
            let parsed;
            try {
                parsed = parseEdn(data);
            } catch (e) {
                vscode.window.showErrorMessage("Could not parse deps.edn");
                throw e;
            }
            const menuSelections = connectSequence.menuSelections,
                launchAliases = menuSelections ? menuSelections.cljAliases : undefined;
            let aliases: string[] = [];
            if (launchAliases) {
                aliases = launchAliases.map(keywordize);
            } else {
                let projectAliases = parsed.aliases != undefined ? Object.keys(parsed.aliases) : [];
                const myAliases = state.config().myCljAliases;
                if (myAliases && myAliases.length) {
                    projectAliases = [...projectAliases, ...myAliases];
                }
                if (projectAliases.length) {
                    aliases = await utilities.quickPickMulti({
                        values: projectAliases.map(keywordize),
                        saveAs: `${state.getProjectRoot()}/clj-cli-aliases`,
                        placeHolder: "Pick any aliases to launch with"
                    });
                }
            }

            const dependencies = { 
                ...cliDependencies, 
                ...(cljsType ? { ...cljsCommonDependencies, ...cljsDependencies[cljsType] } : {}),
                ...serverPrinterDependencies
            },
                useMiddleware = [...middleware, ...(cljsType ? cljsMiddleware : [])];
            const aliasesOption = aliases.length > 0 ? `-A${aliases.join("")}` : '';
            let aliasHasMain: boolean = false;
            for (let ali in aliases) {
                const aliasKey = unKeywordize(aliases[ali]);
                if (parsed.aliases) {
                    let alias = parsed.aliases[aliasKey];
                    aliasHasMain = alias && alias["main-opts"] != undefined;
                }
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
        nReplPortFile: [".shadow-cljs", "nrepl.port"],
        /**
         *  Build the Commandline args for a shadow-project.
         */
        commandLine: async (connectSequence, cljsType) => {
            const chan = state.outputChannel(),
                dependencies = {
                    ...(cljsType ? { ...cljsCommonDependencies, ...cljsDependencies[cljsType] } : {}),
                    ...serverPrinterDependencies
                };
            let args: string[] = [];
            for (let dep in dependencies)
                args.push("-d", dep + ":" + dependencies[dep]);

            const foundBuilds = await shadowBuilds(),
                menuSelections = connectSequence.menuSelections,
                selectedBuilds = menuSelections ? menuSelections.cljsLaunchBuilds : await utilities.quickPickMulti({
                    values: foundBuilds.filter(x => x[0] == ":"),
                    placeHolder: "Select builds to start", saveAs: `
                    ${state.getProjectRoot()}/shadowcljs-jack-in`
                }),
                aliases: string[] = menuSelections && menuSelections.cljAliases ? menuSelections.cljAliases.map(keywordize) : []; // TODO do the same as clj to prompt the user with a list of aliases

            const aliasesOption = aliases.length > 0 ? `-A${aliases.join("")}` : '';
            if (aliasesOption && aliasesOption.length) {
                args.push(aliasesOption);
            }

            if (selectedBuilds && selectedBuilds.length) {
                return ["shadow-cljs", ...args, "watch", ...selectedBuilds];
            } else {
                chan.show();
                chan.appendLine("Aborting. No valid shadow-cljs build selected.");
                throw "No shadow-cljs build selected"
            }
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

export function getAllProjectTypes(): string[] {
    return [...Object.keys(projectTypes)];
}

export function getCljsTypeName(connectSequence: ReplConnectSequence) {
    let cljsTypeName: string;
    if (connectSequence.cljsType == undefined) {
        cljsTypeName = "";
    } else if (typeof connectSequence.cljsType == "string") {
        cljsTypeName = connectSequence.cljsType;
    } else if (connectSequence.cljsType.dependsOn != undefined) {
        cljsTypeName = connectSequence.cljsType.dependsOn;
    } else {
        cljsTypeName = "custom";
    }
    return cljsTypeName;
}