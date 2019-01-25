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
type ProjectType = "shadow-cljs" | "lein" | "boot" | "clj"

/** Finds a file in PATH */
function findInPath(name: string) {
    const paths = process.env.PATH.split(isWin ? ";" : ":");
    for(let path of paths) {
        let fullPath = path+(isWin ? "\\" : "/")+name;
        if(fs.existsSync(fullPath))
            return fullPath;
    }
}

/** The paths to all cli tools */
const execPath = {
    'lein': isWin ? findInPath("lein.bat") : findInPath("lein"),
    'clj': isWin ? findInPath("clojure.ps1") : findInPath("clojure"),
    'boot': isWin ? findInPath("boot.exe") : findInPath("boot"),
    'shadow-cljs': isWin ? findInPath("npx.cmd") : findInPath("npx")
}

/** If this looks like a string and we are under windows, escape it in a powershell compatible way. */
function escapeString(str: string) {
    if(str.startsWith('"') && str.endsWith('"') && isWin)
        return str.replace(/\\"/g, "\\`\"");
    return str;
}

/** Searched top to bottom, if the key exists as a file, return the project type. */

const projectTypes = [["shadow-cljs", "shadow-cljs.edn"],
                      ["lein", "project.clj"],
                      ["boot", "build.boot"],
                      ["clj", "deps.edn"]];

export function detectProjectType() {
    let rootDir = utilities.getProjectDir();
    return projectTypes.filter(x => fs.existsSync(rootDir+"/"+x[1])).map(x => x[0]);
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

/**
 * Builds the clojure-cli arguments to inject dependencies.
 */
function injectCljDependencies() {
    let out: string[] = [];
    for(let dep in injectDependencies)
        out.push(dep+" {:mvn/version \\\""+injectDependencies[dep]+"\\\"}")
    return "{:deps {"+out.join(' ')+"}}";
}

/**
 * Builds the boot arguments to inject dependencies.
 */
function injectBootDependencies() {
    let out: string[] = [];
    for(let dep in injectDependencies) {
        out.push("-d", dep+":"+injectDependencies[dep]);
    }
    return out;
}
/**
 * Builds the shadow-cljs arguments to inject dependencies.
 */
function injectShadowCljsDependencies() {
    let out: string[] = [];
    for(let dep in injectDependencies) {
        out.push("-d", dep+":"+injectDependencies[dep]);
    }
    return out;
}

/**
 * Builds the lein arguments to inject dependencies.
 */
function injectLeinDependencies() {
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

const initEval = '"(require (quote cider-nrepl.main)) (cider-nrepl.main/init [\\"cider.nrepl/cider-middleware\\"])"';

const projectTypeConfig: {[id: string]: any} = {
    "lein": {
        args: [...injectLeinDependencies(), "repl", ":headless"] 
    },
    "boot": {
        args: [...injectBootDependencies(), "-i", initEval, "repl"]
    },
    "clj": {
        args: ["-Sdeps", `"${injectCljDependencies()}"`,  "-m", "nrepl.cmdline", "--middleware", '["cider.nrepl/cider-middleware"]']
    },
    "shadow-cljs": {
        args: ["shadow-cljs", ...injectShadowCljsDependencies(), "watch"]
    }
}

//

// cljs-repls

// figwheel-sidecar
// fighweel-main
// weasel


let processes = new Set<ChildProcess>();

let jackInChannel = vscode.window.createOutputChannel("Calva Jack-In");

export async function calvaJackIn() {
    let types = detectProjectType();
    if(types.length == 0) {
        vscode.window.showErrorMessage("Cannot find project, no project.clj, build.boot, deps.edn or shadow-cljs.edn");
        return;
    }
    let type: string;
    if(types.length > 1) {
        type = await vscode.window.showQuickPick(types, {placeHolder: "Please select a project type"})
        if(!type)
            return;
    } else
        type = types[0];
    
    let executable = execPath[type];

    if(!executable)
        vscode.window.showErrorMessage(executable+" is not on your PATH, please add it.")
        
    let args = projectTypeConfig[type].args;

    if(executable.endsWith(".ps1")) {
        // launch powershell scripts through powershell, doing crazy powershell escaping.
        args = args.map(escapeString) as Array<string>;
        args.unshift(executable);
        executable = "powershell.exe";
    }

    if(type == "shadow-cljs") {
        let builds = await vscode.window.showQuickPick(shadow.shadowBuilds(), { canPickMany: true, placeHolder: "Select builds to jack-in"})
        if(!builds || !builds.length)
            return;
        args = [...args, ...builds];
    }

    let watcher = fs.watch(shadow.nreplPortDir(), async (eventType, filename) => {
        if(filename == ".nrepl-port" || filename == "nrepl.port") {
            state.cursor.set("launching", null)
            watcher.close();
            await connector.connect(true);
            openReplWindow("clj");
        }
    })

    state.cursor.set("launching", type)
    statusbar.update();


    let child = spawn(`"${executable}"`, args, { detached: false, shell: isWin && (type == "lein" || type == "shadow-cljs"), cwd: utilities.getProjectDir() })
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