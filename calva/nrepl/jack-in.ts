import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as state from "../state"
import { spawn, ChildProcess, exec } from "child_process";
import connector from "../connector";
import { openReplWindow } from "../repl-window";
import statusbar from "../statusbar";
import * as shadow from "../shadow"
import * as edn from 'jsedn';

const isWin = /^win/.test(process.platform);

/** Finds a file in PATH */
function findInPath(name: string) {
    const paths = process.env.PATH.split(isWin ? ";" : ":");
    for(let path of paths) {
        let fullPath = path+(isWin ? "\\" : "/")+name;
        if(fs.existsSync(fullPath))
            return fullPath;
    }
}

/** If this looks like a string and we are under windows, escape it in a powershell compatible way. */
function escapeString(str: string) {
    if(str.startsWith('"') && str.endsWith('"') && isWin)
        return str.replace(/\\"/g, "\\`\"");
    return str;
}

export function detectProjectType() {
    let rootDir = utilities.getProjectDir();
    let out = [];
    for(let x in projectTypes)
        if(fs.existsSync(rootDir+"/"+projectTypes[x].useWhenExists))
            out.push(x);
    return out;
}

const injectDependencies = {
    "cider/cider-nrepl": "0.20.0",
    "cider/piggieback": "0.3.10"
}

const leinPluginDependencies = {
    "cider/cider-nrepl": "0.20.0",
}

const leinDependencies = {
    "nrepl": "0.5.3",
    "cider/piggieback": "0.3.10"
}

const middleware = ["cider.nrepl/cider-middleware", "cider.piggieback/wrap-cljs-repl"];

const initEval = '"(require (quote cider-nrepl.main)) (cider-nrepl.main/init [\\"cider.nrepl/cider-middleware\\", \\"cider.piggieback/wrap-cljs-repl\\"])"';


const projectTypes: {[id: string]: {name: string, cmd: string, winCmd: string, commandLine: () => any, useWhenExists: string, useShell?: boolean}} = {
    "lein": {
        name: "Leiningen",
        cmd: "lein",
        winCmd: "lein.bat",
        useShell: true,
        useWhenExists: "project.clj",
        commandLine: async() => {
            let out: string[] = [];
            let keys = Object.keys(leinDependencies);
            
            let data = fs.readFileSync(utilities.getProjectDir()+"/project.clj", 'utf8').toString();
            let parsed;
            try {
                parsed = edn.parse(data);
            } catch(e) {
                vscode.window.showErrorMessage("Could not parse project.clj");
                throw e;
            }
            let profiles: string[] = [];
            if(parsed instanceof edn.List) {
                for(let i = 3; i<parsed.val.length; i += 2) {
                    let e = parsed.val[i];
                    if(e instanceof edn.Keyword && e.name == ":profiles") {
                        profiles = [...profiles, ...parsed.val[i+1].keys.map(x => x.name)]
                    }
                }
                if(profiles.length)
                    profiles = await utilities.quickPickMulti({ values: profiles, saveAs: "lein-cli-profiles", placeHolder: "Pick any profiles to launch with"});
            }

            for(let i=0; i<keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":dependencies", "conj", `"[${dep} \\"${leinDependencies[dep]}\\"]"`, '--');
            }
        
            keys = Object.keys(leinPluginDependencies);
            for(let i=0; i<keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":plugins", "conj", `"[${dep} \\"${leinPluginDependencies[dep]}\\"]"`, '--');
            }

            for(let mw of middleware) {
                out.push("update-in", '"[:repl-options :nrepl-middleware]"', "conj", `"[\\"${mw.replace('"', '\\"')}\\"]"`, '--');
            }

            if(profiles.length) {
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
            let data = fs.readFileSync(utilities.getProjectDir()+"/deps.edn", 'utf8').toString();
            let parsed;
            try {
                parsed = edn.parse(data);
            } catch(e) {
                vscode.window.showErrorMessage("Could not parse deps.edn");
                throw e;
            }
            let aliases = [];
            if(parsed.exists(edn.kw(":aliases"))) {
                aliases = await utilities.quickPickMulti({ values: parsed.at(edn.kw(':aliases')).keys.map(x => x.name), saveAs: "clj-cli-aliases", placeHolder: "Pick any aliases to launch with"});
            }
            

            for(let dep in injectDependencies)
                out.push(dep+" {:mvn/version \\\""+injectDependencies[dep]+"\\\"}")
            return ["-Sdeps", `"${"{:deps {"+out.join(' ')+"}}"}"`,  "-m", "nrepl.cmdline", "--middleware", `"[${middleware.join(' ')}]"`, ...aliases.map(x => "-A"+x)]
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
            for(let dep in injectDependencies)
                args.push("-d", dep+":"+injectDependencies[dep]);

            let builds = await utilities.quickPickMulti({ values: shadow.shadowBuilds().filter(x => x[0] == ":"), placeHolder: "Select builds to jack-in", saveAs: "shadowcljs-jack-in"})
            if(!builds || !builds.length)
                return;
            return ["shadow-cljs", ...args, "watch", ...builds];
        }
    }
}

/** Given the name of a project in project types, find that project. */
function getProjectTypeForName(name: string) {
    for(let id in projectTypes)
        if(projectTypes[id].name == name)
            return projectTypes[id];
}
//

// cljs-repls

// figwheel-sidecar
// fighweel-main
// weasel


let processes = new Set<ChildProcess>();

let jackInChannel = vscode.window.createOutputChannel("Calva Jack-In");

export async function calvaJackIn() {
    // Are there running jack-in processes? If so we must kill them to proceed.
    if(processes.size) {
        let result = await vscode.window.showWarningMessage("Already jacked-in, kill existing process?", {title: "OK"}, {title: "Cancel", isCloseAffordance: true});
        if(result && result.title == "OK") {
            killAllProcesses();
        } else
            return;
    }
    // figure out what possible kinds of project we're in
    let types = detectProjectType();
    if(types.length == 0) {
        vscode.window.showErrorMessage("Cannot find project, no project.clj, build.boot, deps.edn or shadow-cljs.edn");
        return;
    }

    // Show a prompt to pick one if there are multiple
    let buildName = await utilities.quickPickSingle({ values: types.map(x => projectTypes[x].name), placeHolder: "Please select a project type", saveAs: "jack-in-type", autoSelect: true });
    if(!buildName)
        return;

    // Resolve the selection to an entry in projectTypes
    let build = getProjectTypeForName(buildName);
    if(!build)
        return;

    // Now look in our $PATH variable to check the appropriate command exists.
    let executable = findInPath(isWin ? build.winCmd : build.cmd);

    if(!executable)  {
        // It doesn't, do not proceed
        vscode.window.showErrorMessage(build.cmd+" is not on your PATH, please add it.")
        return;
    }

    // Ask the project type to build up the command line. This may prompt for further information.
    let args = await build.commandLine();

    if(executable.endsWith(".ps1")) {
        // launch powershell scripts through powershell, doing crazy powershell escaping.
        args = args.map(escapeString) as Array<string>;
        args.unshift(executable);
        executable = "powershell.exe";
    }

    // Create a watcher to wait for the nREPL port file to appear, and connect + open the repl window at that point.
    let watcher = fs.watch(shadow.nreplPortDir(), async (eventType, filename) => {
        if(filename == ".nrepl-port" || filename == "nrepl.port") {
            state.cursor.set("launching", null)
            watcher.close();
            await connector.connect(true);
            openReplWindow("clj");
        }
    })

    state.cursor.set("launching", buildName)
    statusbar.update();

    // spawn the command line.
    let child = spawn(executable != "powershell.exe" ? `"${executable}"` : executable, args, { detached: false, shell: isWin && build.useShell, cwd: utilities.getProjectDir() })
    processes.add(child); // keep track of processes.

    jackInChannel.clear();
    jackInChannel.show(true);
    jackInChannel.appendLine("Launching clojure with: "+executable+" "+args.join(' '));

    child.stderr.on("data", data => {
        jackInChannel.appendLine(utilities.stripAnsi(data.toString()))
    })
    child.stdout.on("data", data => {
        jackInChannel.appendLine(utilities.stripAnsi(data.toString()))
    })
    child.on("error", data => {
        // Look for this under lein:
        //   Warning: cider-nrepl requires Leiningen 2.8.3 or greater.
        //   Warning: cider-nrepl will not be included in your project.
        jackInChannel.appendLine(utilities.stripAnsi(data.toString()))
    })
    child.on("disconnect", data => {
        console.error(utilities.stripAnsi(data.toString()))
    })
    child.on("close", data => {
        console.error(utilities.stripAnsi(data.toString()))
    })
    child.on("message", data => {
        console.error(utilities.stripAnsi(data.toString()))
    })
    child.once("exit", (code, signal) => {
        processes.delete(child);
        watcher.close();
    })
}

process.on("exit", killAllProcesses)
export function killAllProcesses() {
    processes.forEach(x => {
        if(!isWin) {
            x.kill("SIGTERM");
        } else {
            // windows sux. brutally destroy the process.
            exec('taskkill /PID ' + x.pid + ' /T /F');
        }        
    });
}