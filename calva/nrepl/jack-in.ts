import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as state from "../state"
import connector from "../connector";
import { openReplWindow } from "../repl-window";
import statusbar from "../statusbar";
import * as shadow from "../shadow"
const { parseEdn, parseForms } = require('../../cljs-out/cljs-lib');

const isWin = /^win/.test(process.platform);

/** Finds a file in PATH */
function findInPath(name: string) {
    const paths = process.env.PATH.split(isWin ? ";" : ":");
    for (let path of paths) {
        let fullPath = path + (isWin ? "\\" : "/") + name;
        if (fs.existsSync(fullPath))
            return fullPath;
    }
}

/** If this looks like a string and we are under windows, escape it in a powershell compatible way. */
function escapeString(str: string) {
    if (str.startsWith('"') && str.endsWith('"') && isWin)
        return str.replace(/\\"/g, "\\`\"");
    return str;
}

export function detectProjectType() {
    let rootDir = utilities.getProjectDir();
    let out = [];
    for (let x in projectTypes)
        if (fs.existsSync(rootDir + "/" + projectTypes[x].useWhenExists))
            out.push(x);
    return out;
}

const injectDependencies = {
    "cider/cider-nrepl": "0.21.1",
    "cider/piggieback": "0.4.0",
    "figwheel-sidecar": "0.5.18"
}

const shadowDependencies = {
    "cider/cider-nrepl": "0.21.1"
}

const leinPluginDependencies = {
    "cider/cider-nrepl": "0.21.1"
}

const leinDependencies = {
    "nrepl": "0.6.0",
    "cider/piggieback": "0.4.0",
    "figwheel-sidecar": "0.5.18"
}

const middleware = ["cider.nrepl/cider-middleware", "cider.piggieback/wrap-cljs-repl"];

const initEval = '"(require (quote cider-nrepl.main)) (cider-nrepl.main/init [\\"cider.nrepl/cider-middleware\\", \\"cider.piggieback/wrap-cljs-repl\\"])"';


const projectTypes: { [id: string]: { name: string, cmd: string, winCmd: string, commandLine: () => any, useWhenExists: string, useShell?: boolean } } = {
    "lein": {
        name: "Leiningen",
        cmd: "lein",
        winCmd: "lein.bat",
        useShell: true,
        useWhenExists: "project.clj",
        commandLine: async () => {
            let out: string[] = [];
            let keys = Object.keys(leinDependencies);

            let data = fs.readFileSync(utilities.getProjectDir() + "/project.clj", 'utf8').toString();
            let parsed;
            try {
                parsed = parseForms(data);
            } catch (e) {
                vscode.window.showErrorMessage("Could not parse project.clj");
                throw e;
            }
            let profiles: string[] = [];
            const defproject = parsed.find(x => x[0] == "defproject");
            if (defproject != undefined) {
                let profilesIndex = defproject.indexOf("profiles");
                if (profilesIndex > -1) {
                    try {
                        const profilesMap = defproject[profilesIndex + 1];
                        profiles = [...profiles, ...Object.keys(profilesMap).map((v, k) => { return ":" + v })];
                        if (profiles.length) {
                            profiles = await utilities.quickPickMulti({ values: profiles, saveAs: "lein-cli-profiles", placeHolder: "Pick any profiles to launch with" });
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage("The project.clj file is not sane. " + error.message);
                        console.log(error);
                    }
                }
            }

            for (let i = 0; i < keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":dependencies", "conj", `"[${dep} \\"${leinDependencies[dep]}\\"]"`, '--');
            }

            keys = Object.keys(leinPluginDependencies);
            for (let i = 0; i < keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":plugins", "conj", `"[${dep} \\"${leinPluginDependencies[dep]}\\"]"`, '--');
            }

            for (let mw of middleware) {
                out.push("update-in", '"[:repl-options :nrepl-middleware]"', "conj", `"[\\"${mw.replace('"', '\\"')}\\"]"`, '--');
            }

            if (profiles.length) {
                out.push("with-profile", profiles.map(x => x.substr(1)).join(','));
            }
            //out.push("update-in", ":middleware", "conj", `cider-nrepl.plugin/middleware`, '--')
            out.push("repl", ":headless");
            return out;
        }
    },
    /* // Works but analysing the possible launch environment is unsatifactory for now, use the cli :)
    "boot": {
        name: "Boot",
        cmd: "boot",
        winCmd: "boot.exe",
        useShell: true,
        useWhenExists: "build.boot",      
        commandLine: () => {
            let out: string[] = [];
            for(let dep in injectDependencies)
                out.push("-d", dep+":"+injectDependencies[dep]);
            return [...out, "-i", initEval, "repl"];
        }
    },
    */
    "clj": {
        name: "Clojure CLI",
        cmd: "clojure",
        winCmd: "clojure.ps1",
        useWhenExists: "deps.edn",
        commandLine: async () => {
            let out: string[] = [];
            let data = fs.readFileSync(utilities.getProjectDir() + "/deps.edn", 'utf8').toString();
            let parsed;
            try {
                parsed = parseEdn(data);
            } catch (e) {
                vscode.window.showErrorMessage("Could not parse deps.edn");
                throw e;
            }
            let aliases = [];
            if (parsed.aliases != undefined) {
                aliases = await utilities.quickPickMulti({ values: Object.keys(parsed.aliases).map(x => ":" + x), saveAs: "clj-cli-aliases", placeHolder: "Pick any aliases to launch with" });
            }


            for (let dep in injectDependencies)
                out.push(dep + " {:mvn/version \\\"" + injectDependencies[dep] + "\\\"}")
            return ["-Sdeps", `"${"{:deps {" + out.join(' ') + "}}"}"`, "-m", "nrepl.cmdline", "--middleware", `"[${middleware.join(' ')}]"`, ...aliases.map(x => "-A" + x)]
        }
    },
    "shadow-cljs": {
        name: "ShadowCLJS",
        cmd: "npx",
        winCmd: "npx.cmd",
        useShell: true,
        useWhenExists: "shadow-cljs.edn",
        commandLine: async () => {
            let args: string[] = [];
            for (let dep in shadowDependencies)
                args.push("-d", dep + ":" + shadowDependencies[dep]);

            let builds = await utilities.quickPickMulti({ values: shadow.shadowBuilds().filter(x => x[0] == ":"), placeHolder: "Select builds to start", saveAs: "shadowcljs-jack-in" })
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

vscode.tasks.onDidStartTaskProcess(e => {
    if (e.execution.task.name == TASK_NAME) {
        if (watcher != undefined) {
            watcher.close();
        }
        // Create a watcher to wait for the nREPL port file to appear, and connect + open the repl window at that point.
        watcher = fs.watch(shadow.nreplPortDir(), async (eventType, filename) => {
            if (filename == ".nrepl-port" || filename == "nrepl.port") {
                state.cursor.set("launching", null)
                watcher.close();
                await connector.connect(true);
                openReplWindow("clj");
            }
        })
    }
});

export async function calvaJackIn() {
    const outputChannel = state.outputChannel();

    state.analytics().logEvent("REPL", "JackInInitiated").send();
    outputChannel.appendLine("Jacking in.");

    // figure out what possible kinds of project we're in
    let types = detectProjectType();
    if (types.length == 0) {
        vscode.window.showErrorMessage("Cannot find project, no project.clj, build.boot, deps.edn or shadow-cljs.edn");
        state.analytics().logEvent("REPL", "JackInInterrupted", "FailedFindingProjectType").send();
        return;
    }

    // Show a prompt to pick one if there are multiple
    let buildName = await utilities.quickPickSingle({ values: types.map(x => projectTypes[x].name), placeHolder: "Please select a project type", saveAs: "jack-in-type", autoSelect: true });
    if (!buildName) {
        state.analytics().logEvent("REPL", "JackInInterrupted", "NoBuildNamePicked").send();
        return;
    }

    // Resolve the selection to an entry in projectTypes
    let build = getProjectTypeForName(buildName);
    if (!build) {
        state.analytics().logEvent("REPL", "JackInInterrupted", "NoProjectTypeForBuildName").send();
        return;
    }

    // Now look in our $PATH variable to check the appropriate command exists.
    let executable = findInPath(isWin ? build.winCmd : build.cmd);

    if (!executable) {
        // It doesn't, do not proceed
        state.analytics().logEvent("REPL", "JackInInterrupted", "CommandNotInPath").send();
        vscode.window.showErrorMessage(build.cmd + " is not on your PATH, please add it.")
        return;
    }

    // Ask the project type to build up the command line. This may prompt for further information.
    let args = await build.commandLine();

    if (executable.endsWith(".ps1")) {
        // launch powershell scripts through powershell, doing crazy powershell escaping.
        args = args.map(escapeString) as Array<string>;
        args.unshift(executable);
        executable = "powershell.exe";
    }

    state.cursor.set("launching", buildName)
    statusbar.update();

    const env = { ...process.env, ...state.config().jackInEnv };

    const execution = new vscode.ShellExecution(executable, args, {
        cwd: utilities.getProjectDir(),
        env: env
    });

    const taskDefinition: vscode.TaskDefinition = {
        type: "shell",
        label: "Calva: Jack-in"
    };

    const folder = vscode.workspace.workspaceFolders[0];
    const task = new vscode.Task(taskDefinition, folder, TASK_NAME, "Calva", execution);

    state.analytics().logEvent("REPL", "JackInExecuting", JSON.stringify(types)).send();

    vscode.tasks.executeTask(task).then(
        (v) => {
        },
        (reason) => {
            watcher.close()
            outputChannel.appendLine("Error in Jack-in: " + reason);
        });
}
