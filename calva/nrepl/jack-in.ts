import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as path from "path";
import * as state from "../state"
import * as connector from "../connector";
import statusbar from "../statusbar";
import { parseEdn, parseForms } from "../../cljs-out/cljs-lib";

const isWin = /^win/.test(process.platform);

export async function detectProjectType(): Promise<string[]> {
    let rootDir = connector.getProjectRoot(),
        cljProjTypes = []
    for (let clj in projectTypes) {
        try {
            fs.accessSync(rootDir + "/" + projectTypes[clj].useWhenExists);
            cljProjTypes.push(clj);
        } catch (_e) { }
    }
    return cljProjTypes;
}

const cliDependencies = {
    "nrepl": "0.6.0",
    "cider/cider-nrepl": "0.22.0-beta10",
}
const figwheelDependencies = {
    "cider/piggieback": "0.4.1",
    "figwheel-sidecar": "0.5.18"
}
const shadowDependencies = {
    "cider/cider-nrepl": "0.22.0-beta10",
}
const leinPluginDependencies = {
    "cider/cider-nrepl": "0.22.0-beta10"
}
const leinDependencies = {
    "nrepl": "0.6.0",
}
const middleware = ["cider.nrepl/cider-middleware"];
const cljsMiddleware = ["cider.piggieback/wrap-cljs-repl"];

const projectTypes: { [id: string]: connector.ProjectType } = {
    "lein": {
        name: "Leiningen",
        cljsTypes: ["Figwheel", "Figwheel Main"],
        cmd: "lein",
        winCmd: "cmd.exe",
        useWhenExists: "project.clj",
        nReplPortFile: () => {
            return connector.nreplPortFile(".nrepl-port");
        },
        /** Build the Commandline args for a lein-project. 
         * 1. Parsing the project.clj
         * 2. Let the user choose a alias
         * 3. Let the user choose profiles to use
         * 4. Add nedded middleware deps to args
         * 5. Add all profiles choosed by the user
         * 6. Use alias if selected otherwise repl :headless
        */
        commandLine: async (includeCljs) => {
            let out: string[] = [];
            let dependencies = includeCljs ? { ...leinDependencies, ...figwheelDependencies } : leinDependencies;
            let keys = Object.keys(dependencies);
            let data = fs.readFileSync(path.resolve(connector.getProjectRoot(), "project.clj"), 'utf8').toString();
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
                            alias = await utilities.quickPickSingle({ values: aliases, saveAs: `${connector.getProjectRoot()}/lein-cli-alias`, placeHolder: "Choose alias to run" });
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
                            profiles = await utilities.quickPickMulti({ values: profiles, saveAs: `${connector.getProjectRoot()}/lein-cli-profiles`, placeHolder: "Pick any profiles to launch with" });
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

            const useMiddleware = includeCljs ? [...middleware, ...cljsMiddleware] : middleware;
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
            return connector.nreplPortFile(".nrepl-port");
        },
        /** Build the Commandline args for a clj-project.
         * 1. Read the deps.edn and parsed it 
         * 2. Present the user all found aliases
         * 3. Define needed dependencies and middlewares used by calva
         * 4. Check if the selected aliases have main-opts
         * 5. If main-opts in alias => just use aliases
         * 6. if no main-opts => supply our own main to run nrepl with middlewares
         */
        commandLine: async (includeCljs) => {
            let out: string[] = [];
            let data = fs.readFileSync(path.join(connector.getProjectRoot(), "deps.edn"), 'utf8').toString();
            let parsed;
            try {
                parsed = parseEdn(data);
            } catch (e) {
                vscode.window.showErrorMessage("Could not parse deps.edn");
                throw e;
            }
            let aliases:string[] = [];
            if (parsed.aliases != undefined) {
                aliases = await utilities.quickPickMulti({ values: Object.keys(parsed.aliases).map(x => ":" + x), saveAs: `${connector.getProjectRoot()}/clj-cli-aliases`, placeHolder: "Pick any aliases to launch with" });
            }

            const dependencies = includeCljs ? { ...cliDependencies, ...figwheelDependencies } : cliDependencies,
                useMiddleware = includeCljs ? [...middleware, ...cljsMiddleware] : middleware;
            const aliasesOption = aliases.length > 0 ? `-A${aliases.join("")}` : '';
            let aliasHasMain:boolean = false;
            for (let ali in aliases) {
                let aliasKey = aliases[ali].substr(1);
                let alias =  parsed.aliases[aliasKey];
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
            return connector.nreplPortFile(path.join(".shadow-cljs", "nrepl.port"));
        },
        /**
         *  Build the Commandline args for a shadow-project.
         */
        commandLine: async (_includeCljs) => {
            let args: string[] = [];
            for (let dep in shadowDependencies)
                args.push("-d", dep + ":" + shadowDependencies[dep]);

            const shadowBuilds = await connector.shadowBuilds();
            let builds = await utilities.quickPickMulti({ values: shadowBuilds.filter(x => x[0] == ":"), placeHolder: "Select builds to start", saveAs: `${connector.getProjectRoot()}/shadowcljs-jack-in` })
            if (!builds || !builds.length)
                return;
            return ["shadow-cljs", ...args, "watch", ...builds];
        }
    }
}

/** Given the name of a project in project types, find that project. */
function getProjectTypeForName(name: string) {
    for (let id in projectTypes)
        if (projectTypes[id].name == name)
            return projectTypes[id];
}

let watcher: fs.FSWatcher;
const TASK_NAME = "Calva Jack-in";

async function executeJackInTask(projectType: connector.ProjectType, projectTypeSelection: any, executable: string, args: any, cljTypes: string[], outputChannel: vscode.OutputChannel) {
    state.cursor.set("launching", projectTypeSelection);
    statusbar.update();
    const nReplPortFile = projectType.nReplPortFile();
    const env = { ...process.env, ...state.config().jackInEnv } as {
        [key: string]: string;
    };
    const execution = isWin ?
        new vscode.ProcessExecution(executable, args, {
            cwd: connector.getProjectRoot(),
            env: env,
        }) :
        new vscode.ShellExecution(executable, args, {
            cwd: connector.getProjectRoot(),
            env: env,
        });
    const taskDefinition: vscode.TaskDefinition = {
        type: isWin ? "process" : "shell",
        label: "Calva: Jack-in"
    };
    const task = new vscode.Task(taskDefinition, connector.getProjectWsFolder(), TASK_NAME, "Calva", execution);

    state.analytics().logEvent("REPL", "JackInExecuting", JSON.stringify(cljTypes)).send();

    vscode.tasks.executeTask(task).then((v) => {
        // Create a watcher to wait for the nREPL port file to appear with new content, and connect + open the repl window at that point.
        const portFileDir = path.dirname(nReplPortFile),
            portFileBase = path.basename(nReplPortFile);
        if (watcher != undefined) {
            watcher.removeAllListeners();
        }
      
        watcher = fs.watch(portFileDir, async (eventType, fileName) => {
            if (fileName == portFileBase) {
                if (!fs.existsSync(nReplPortFile)) {
                    return;
                }
                const port = fs.readFileSync(nReplPortFile, 'utf8');
                if (!port) { // On Windows we get two events, one for file creation and one for the change of content
                    return;  // If there is no port to be read yet, wait for the next event instead.
                }
                const chan = state.outputChannel();
                setTimeout(() => { chan.show() }, 1000);
                state.cursor.set("launching", null);
                watcher.removeAllListeners();
                await connector.connect(true, true);
                chan.appendLine("Jack-in done.\nUse the VS Code task management UI to control the life cycle of the Jack-in task.");
            }
        });
    }, (reason) => {
        watcher.removeAllListeners();
        outputChannel.appendLine("Error in Jack-in: " + reason);
    });
}

export async function calvaJackIn() {
    const outputChannel = state.outputChannel();
    try {
        await connector.initProjectDir();
    } catch {
        return;
    }
    state.analytics().logEvent("REPL", "JackInInitiated").send();
    outputChannel.appendLine("Jacking in...");

    // figure out what possible kinds of project we're in
    let cljTypes = await detectProjectType();
    if (cljTypes.length == 0) {
        vscode.window.showErrorMessage("Cannot find project, no project.clj, deps.edn or shadow-cljs.edn.");
        state.analytics().logEvent("REPL", "JackInInterrupted", "FailedFindingProjectType").send();
        return;
    }

    // Show a prompt to pick one if there are multiple
    let menu: string[] = [];
    for (const clj of cljTypes) {
        menu.push(projectTypes[clj].name);
        const customCljsRepl = connector.getCustomCLJSRepl();
        const cljsTypes = projectTypes[clj].cljsTypes.slice();
        if (customCljsRepl) {
            cljsTypes.push(customCljsRepl.name);
        }
        for (const cljs of cljsTypes) {
            menu.push(`${projectTypes[clj].name} + ${cljs}`);
        }
    }
    let projectTypeSelection = await utilities.quickPickSingle({ values: menu, placeHolder: "Please select a project type", saveAs: `${connector.getProjectRoot()}/jack-in-type`, autoSelect: true });
    if (!projectTypeSelection) {
        state.analytics().logEvent("REPL", "JackInInterrupted", "NoProjectTypePicked").send();
        return;
    }

    // Resolve the selection to an entry in projectTypes
    const projectTypeName: string = projectTypeSelection.replace(/ \+ .*$/, "");
    let projectType = getProjectTypeForName(projectTypeName);
    state.extensionContext.workspaceState.update('selectedCljTypeName', projectTypeName);
    let matched = projectTypeSelection.match(/ \+ (.*)$/);
    const selectedCljsType = projectType.name == "shadow-cljs" ? "shadow-cljs" : matched != null ? matched[1] : "";
    state.extensionContext.workspaceState.update('selectedCljsTypeName', selectedCljsType);
    if (!projectType) {
        state.analytics().logEvent("REPL", "JackInInterrupted", "NoProjectTypeForBuildName").send();
        return;
    }

    let executable = isWin ? projectType.winCmd : projectType.cmd;

    // Ask the project type to build up the command line. This may prompt for further information.
    let args = await projectType.commandLine(selectedCljsType != "");

    executeJackInTask(projectType, projectTypeSelection, executable, args, cljTypes, outputChannel);
}
