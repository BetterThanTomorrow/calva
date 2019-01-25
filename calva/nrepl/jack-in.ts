import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as state from "../state"
import { spawn, ChildProcess, exec } from "child_process";
import connector from "../connector";
import { openReplWindow } from "../repl-window";
import statusbar from "../statusbar";
import * as shadow from "../shadow"

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
    for(let x in projectTypeConfig)
        if(fs.existsSync(rootDir+"/"+projectTypeConfig[x].useWhenExists))
            out.push(x);
    return out;
}

const injectDependencies = {
    "cider/cider-nrepl": "0.20.0",
}

const leinPluginDependencies = {
    "cider/cider-nrepl": "0.20.0",
}

const leinDependencies = {
    "nrepl": "0.5.3",
}

const middleware = ["cider.nrepl/cider-middleware"];

const initEval = '"(require (quote cider-nrepl.main)) (cider-nrepl.main/init [\\"cider.nrepl/cider-middleware\\"])"';


const projectTypeConfig: {[id: string]: {name: string, cmd: string, winCmd: string, commandLine: () => any, useWhenExists: string, useShell?: boolean}} = {
    "lein": {
        name: "Leiningen",
        cmd: "lein",
        winCmd: "lein.bat",
        useShell: true,
        useWhenExists: "project.clj",
        commandLine: () => {
            let out: string[] = [];
            let keys = Object.keys(leinDependencies);
            
            for(let i=0; i<keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":dependencies", "conj", `"[${dep} \\"${leinDependencies[dep]}\\"]"`, '--');
            }
        
            keys = Object.keys(leinPluginDependencies);
            for(let i=0; i<keys.length; i++) {
                let dep = keys[i];
                out.push("update-in", ":plugins", "conj", `"[${dep} \\"${leinPluginDependencies[dep]}\\"]"`, '--');
            }
            return out;
        }
    },
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
    "clj": {
        name: "Clojure CLI",
        cmd: "clojure",
        winCmd: "clojure.ps1",        
        useWhenExists: "deps.edn",
        commandLine: () => {
            let out: string[] = [];
            for(let dep in injectDependencies)
                out.push(dep+" {:mvn/version \\\""+injectDependencies[dep]+"\\\"}")
            return ["-Sdeps", `"${"{:deps {"+out.join(' ')+"}}"}"`,  "-m", "nrepl.cmdline", "--middleware", '["cider.nrepl/cider-middleware"]']
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

function getProjectTypeForName(name: string) {
    for(let id in projectTypeConfig)
        if(projectTypeConfig[id].name == name)
            return projectTypeConfig[id];
}
//

// cljs-repls

// figwheel-sidecar
// fighweel-main
// weasel


let processes = new Set<ChildProcess>();

let jackInChannel = vscode.window.createOutputChannel("Calva Jack-In");

export async function calvaJackIn() {
    if(processes.size) {
        let result = await vscode.window.showWarningMessage("Already jacked-in, kill existing process?", {title: "OK"}, {title: "Cancel", isCloseAffordance: true});
        if(result && result.title == "OK") {
            killAllProcesses();
        } else
            return;
    }
    let buildName: string;
    let types = detectProjectType();
    if(types.length == 0) {
        vscode.window.showErrorMessage("Cannot find project, no project.clj, build.boot, deps.edn or shadow-cljs.edn");
        return;
    }

    buildName = await utilities.quickPickSingle({ values: types.map(x => projectTypeConfig[x].name), placeHolder: "Please select a project type", saveAs: "jack-in-type", autoSelect: true });
    if(!buildName)
        return;

    let build = getProjectTypeForName(buildName);
    if(!build)
        return;

    let executable = findInPath(isWin ? build.winCmd : build.cmd);

    if(!executable)
        vscode.window.showErrorMessage(build.cmd+" is not on your PATH, please add it.")

    let args = await build.commandLine();

    if(executable.endsWith(".ps1")) {
        // launch powershell scripts through powershell, doing crazy powershell escaping.
        args = args.map(escapeString) as Array<string>;
        args.unshift(executable);
        executable = "powershell.exe";
    }

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

    let child = spawn(executable != "powershell.exe" ? `"${executable}"` : executable, args, { detached: false, shell: isWin && build.useShell, cwd: utilities.getProjectDir() })
    processes.add(child);
    jackInChannel.clear();
    jackInChannel.show(true);
    jackInChannel.appendLine("Launching clojure with: "+executable+" "+args.join(' '));
    child.stderr.on("data", data => {
        jackInChannel.appendLine(data.toString())
    })
    child.stdout.on("data", data => {
        jackInChannel.appendLine(data.toString())
    })
    child.on("error", data => {
        // Look for this under lein:
        //   Warning: cider-nrepl requires Leiningen 2.8.3 or greater.
        //   Warning: cider-nrepl will not be included in your project.
        jackInChannel.appendLine(data.toString())
    })
    child.on("disconnect", data => {
        console.error(data.toString())
    })
    child.on("close", data => {
        console.error(data.toString())
    })
    child.on("message", data => {
        console.error(data.toString())
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
            exec('taskkill /PID ' + x.pid + ' /T /F');
        }        
    });
}