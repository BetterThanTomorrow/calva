import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as state from "../state"
import connector from "../connector";
import statusbar from "../statusbar";
import * as shadow from "../shadow"
//const { parseEdn, parseForms } = require('../../cljs-out/cljs-lib');
import { parseEdn, parseForms } from "../../cljs-out/cljs-lib";

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

export function detectProjectType(): string[] {
    let rootDir = utilities.getProjectDir(),
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
    "cider/cider-nrepl": "0.21.1",
}
const figwheelDependencies = {
    "cider/piggieback": "0.4.1",
    "figwheel-sidecar": "0.5.18"
}
const shadowDependencies = {
    "cider/cider-nrepl": "0.21.1",
}
const leinPluginDependencies = {
    "cider/cider-nrepl": "0.21.1"
}
const leinDependencies = {
    "nrepl": "0.6.0",
}
const middleware = ["cider.nrepl/cider-middleware"];
const cljsMiddleware = ["cider.piggieback/wrap-cljs-repl"];

const initEval = '"(require (quote cider-nrepl.main)) (cider-nrepl.main/init [\\"cider.nrepl/cider-middleware\\", \\"cider.piggieback/wrap-cljs-repl\\"])"';

const projectTypes: {
    [id: string]: {
        name: string,
        cljsTypes: string[],
        cmd: string,
        winCmd: string,
        commandLine: (includeCljs: boolean) => any,
        useWhenExists: string,
        useShell?: boolean
    }
} = {
    "lein": {
        name: "Leiningen",
        cljsTypes: ["Figwheel", "Figwheel Main"],
        cmd: "lein",
        winCmd: "lein.bat",
        useShell: true,
        useWhenExists: "project.clj",
        commandLine: async (includeCljs) => {
            let out: string[] = [];
            let dependencies = includeCljs ? { ...leinDependencies, ...figwheelDependencies } : leinDependencies;
            let keys = Object.keys(dependencies);

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
                out.push("update-in", ":dependencies", "conj", `"[${dep} \\"${dependencies[dep]}\\"]"`, '--');
            }

            keys = Object.keys(leinPluginDependencies);
            for (let i = 0; i < keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":plugins", "conj", `"[${dep} \\"${leinPluginDependencies[dep]}\\"]"`, '--');
            }

            const useMiddleware = includeCljs ? [...middleware, ...cljsMiddleware] : middleware;
            for (let mw of useMiddleware) {
                out.push("update-in", '"[:repl-options :nrepl-middleware]"', "conj", `"[\\"${mw.replace('"', '\\"')}\\"]"`, '--');
            }

            if (profiles.length) {
                out.push("with-profile", profiles.map(x => `+${x.substr(1)}`).join(','));
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
        winCmd: "clojure.ps1",
        useWhenExists: "deps.edn",
        commandLine: async (includeCljs) => {
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

            const dependencies = includeCljs ? { ...cliDependencies, ...figwheelDependencies } : cliDependencies,
                useMiddleware = includeCljs ? [...middleware, ...cljsMiddleware] : middleware;
            const aliasesOption = aliases.length > 0 ? `-A${aliases.join("")}` : ''
            for (let dep in dependencies)
                out.push(dep + " {:mvn/version \\\"" + dependencies[dep] + "\\\"}")
            return ["-Sdeps", `"${"{:deps {" + out.join(' ') + "}}"}"`, aliasesOption, "-m", "nrepl.cmdline", "--middleware", `"[${useMiddleware.join(' ')}]"`]
        }
    },
    "shadow-cljs": {
        name: "shadow-cljs",
        cljsTypes: [],
        cmd: "npx",
        winCmd: "npx.cmd",
        useShell: true,
        useWhenExists: "shadow-cljs.edn",
        commandLine: async (_includeCljs) => {
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
            watcher.removeAllListeners();
        }
        // Create a watcher to wait for the nREPL port file to appear, and connect + open the repl window at that point.
        watcher = fs.watch(utilities.getProjectDir(), async (eventType, filename) => {
            if (filename == ".nrepl-port") {
                const chan = state.outputChannel();
                setTimeout(() => { chan.show() }, 1000);
                state.cursor.set("launching", null);
                watcher.close();
                await connector.connect(true, true);
                chan.appendLine("Jack-in done.\nUse the VS Code task management UI to control the life cycle of the Jack-in task.");
            }
        })
    }
});

export async function calvaJackIn() {
    const outputChannel = state.outputChannel();

    state.analytics().logEvent("REPL", "JackInInitiated").send();
    outputChannel.appendLine("Jacking in...");

    // figure out what possible kinds of project we're in
    let cljTypes = detectProjectType();
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
    let projectTypeSelection = await utilities.quickPickSingle({ values: menu, placeHolder: "Please select a project type", saveAs: "jack-in-type", autoSelect: true });
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

    // Now look in our $PATH variable to check the appropriate command exists.
    const cmd = isWin ? projectType.winCmd : projectType.cmd;
    let executable = findInPath(cmd);
    let integrated_shell;

    if (!executable) {
        // It doesn't, do not proceed
        state.analytics().logEvent("REPL", "JackInInterrupted", "CommandNotInPath").send();
        vscode.window.showErrorMessage(cmd + " is not on your PATH, please add it.")
        return;
    }

    // Ask the project type to build up the command line. This may prompt for further information.
    let args = await projectType.commandLine(selectedCljsType != "");

    let shellSettingsShouldBeChangedByUs = false;
    let shellSettingsChangedByUs = false;

    if (executable.endsWith(".ps1")) {
        // launch powershell scripts through powershell, doing crazy powershell escaping.
        args = args.map(escapeString) as Array<string>;
        args.unshift(executable);
        executable = "powershell.exe";
    } else if (executable.endsWith(".bat")) {
        // Current workaround for the not working powershell etc. changes to cmd.exe and later back to whaterver was set before
        let windowsterminalssettings  = vscode.workspace.getConfiguration("terminal.integrated.shell").inspect("windows");
        integrated_shell = windowsterminalssettings.workspaceFolderValue || windowsterminalssettings.workspaceValue;
        if (!integrated_shell || !integrated_shell.endsWith("cmd.exe")) {
            shellSettingsShouldBeChangedByUs = true;
            outputChannel.appendLine("Jack-in needs to use cmd.exe to work. Allow the (temporary) switch, please.");
            await vscode.workspace.getConfiguration()
                .update("terminal.integrated.shell.windows", "C:\\Windows\\System32\\cmd.exe")
                .then(
                    () => {
                        shellSettingsChangedByUs = true;
                    },
                    (reason) => {
                        outputChannel.appendLine("Jack-in aborted, since it won't work without using cmd.exe");
                    }
                );
        }
    }

    if (shellSettingsShouldBeChangedByUs && !shellSettingsChangedByUs) {
        state.analytics().logEvent("REPL", "JackInInterrupted", "Powershell user wont allow change of shell setting").send();
        return;
    }
    state.cursor.set("launching", projectTypeSelection)
    statusbar.update();

    const env = { ...process.env, ...state.config().jackInEnv } as { [key: string]: string; };

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

    state.analytics().logEvent("REPL", "JackInExecuting", JSON.stringify(cljTypes)).send();
    vscode.tasks.executeTask(task).then(
        (v) => {
        },
        (reason) => {
            watcher.close()
            outputChannel.appendLine("Error in Jack-in: " + reason);
        });

    if (executable.endsWith(".bat") && shellSettingsChangedByUs) {
        setTimeout(() => { // Need to give the task shell time to start
            vscode.workspace.getConfiguration()
                .update("terminal.integrated.shell.windows", integrated_shell)
                .then(() => {
                    integrated_shell = undefined;
                });
        }, 2000);
    }
}
