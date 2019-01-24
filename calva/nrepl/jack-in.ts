import * as vscode from "vscode";
import * as utilities from "../utilities";
import * as fs from "fs";
import * as state from "../state"
import { spawn, ChildProcess, exec } from "child_process";
import connector from "../connector";
import { openReplWindow } from "../repl-window";
import statusbar from "../statusbar";
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
    'clj': isWin ? findInPath("clj.ps1") : findInPath("clj"),
    'boot': isWin ? findInPath("boot.exe") : findInPath("boot"),
    'shadow-cljs': isWin ? findInPath("shadow-cljs.cmd") : findInPath("shadow-cljs")
}

/** If this looks like a string and we are under windows, escape it in a powershell compatible way. */
function escapeString(str: string) {
    if(str.startsWith('"') && str.endsWith('"') && isWin)
        return str.replace(/\\"/g, "\\`\"");
    return str;
}

/** Searched top to bottom, if the key exists as a file, return the project type. */
const projectTypeDetect: {[id: string]: ProjectType} = {
    'shadow-cljs.edn': "shadow-cljs",
    'project.clj': "lein",
    'build.boot': "boot",
    'deps.edn': "clj"
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

function injectCljDependencies() {
    let out: string[] = [];
    for(let dep in injectDependencies)
        out.push(dep+" {:mvn/version \\\""+injectDependencies[dep]+"\\\"}")
    return "{:deps {"+out.join(' ')+"}}";
}

function injectBootDependencies() {
    let out: string[] = [];
    for(let dep in injectDependencies) {
        out.push("-d", dep+":"+injectDependencies[dep]);
    }
    return out;
}

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
        args: [...injectLeinDependencies(), "repl"] // you're on your own here, have to install your own nrepl. boo.
    },
    "boot": {
        args: [...injectBootDependencies(), "-i", initEval, "repl"]
    },
    "clj": {
        args: ["-Sdeps", `"${injectCljDependencies()}"`, "-e", initEval]
    },
    "shadow-cljs": {
        args: ""
    }
}

//

// cljs-repls

// figwheel-sidecar
// fighweel-main
// weasel

export function detectProjectType() {
    let rootDir = utilities.getProjectDir();
    for(let file in projectTypeDetect) {
        if(fs.existsSync(rootDir+"/"+file))
            return projectTypeDetect[file];
    }
}

let processes = new Set<ChildProcess>();

export async function calvaJackIn() {        
    let type = detectProjectType();
    let executable = execPath[type];


    if(!executable)
        throw new Error(type+" is not on your PATH");
    let args = projectTypeConfig[type].args;

    if(executable.endsWith(".ps1")) {
        args = args.map(escapeString) as Array<string>;
        args.unshift(executable);
        executable = "powershell.exe";
    }
    if(executable.endsWith(".bat")) {
        // mmm. dos.
        args = args.map(x => x.replace(/"/, '^"'));
    }
    let watcher = fs.watch(utilities.getProjectDir(), async (eventType, filename) => {
        if(filename == ".nrepl-port") {
            state.cursor.set("launching", null)
            watcher.close();
            await connector.connect(true);
            openReplWindow("clj");
        }
    })

    state.cursor.set("launching", type)
    statusbar.update();
    let child = spawn(executable, args, { detached: false, cwd: utilities.getProjectDir(), shell: true })
    processes.add(child);
    console.log("Launching clojure with: "+executable+" "+args.join(' '));
    child.stderr.on("data", data => {
        console.log(data.toString())
    })
    child.stdout.on("data", data => {
        console.log(data.toString())
    })
    child.on("error", data => {
        // Look for this under lein:
        //   Warning: cider-nrepl requires Leiningen 2.8.3 or greater.
        //   Warning: cider-nrepl will not be included in your project.
        console.error(data.toString());
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