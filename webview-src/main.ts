import { ReplConsole } from "@calva/repl-interactor";
import * as lexer from "@calva/repl-interactor/js/clojure-lexer"
declare function acquireVsCodeApi(): { postMessage: (object: any) => void }
const message = acquireVsCodeApi();

let ns = "user";
let con = new ReplConsole(document.querySelector(".repl"), line => {
    message.postMessage({ type: "read-line", line: line})
});

let completionDiv = document.createElement("div");
completionDiv.className = "completion";

con.onRepaint = () => {
    if(con.readline) {
        completionDiv.style.visibility = "hidden"
        let context = con.readline.model.getText(0, con.readline.model.maxOffset);
        let pos = con.readline.getTokenCursor().previous();

        context = context.substring(0, pos.offsetStart)+"__prefix__"+context.substring(pos.offsetEnd);

        message.postMessage({ type: "complete", symbol: pos.getToken().raw, context})
    }
}

document.addEventListener("DOMContentLoaded", () => {
    con.input.focus();
    document.body.appendChild(completionDiv);
})


const motd = [
    "Some said the world should be in Perl, \nSome said in Lisp.\nNow, having given both a whirl,\nI held with those who favored Perl.\nBut I fear we passed to men\nA disappointing founding myth.\nAnd should we write it all again,\nI'd end it with\nA close-paren. -Randall Munroe",
    "I object to doing things that computers can do. -Olin Shivers",
    "Will write code that writes code that writes code that writes code for money.",
    "Anyone could learn Lisp in one day, except that if they already knew Fortran, it would take three days. -Marvin Minsky",
    "Your Kitten of Death awaits. -Christopher Rhodes.",
    "Syntactic sugar causes cancer of the semicolon. -Alan Perlis",
    "If you have a procedure with ten parameters, you probably missed some. -Alan Perlis",
    "Beware of the Turing tar-pit in which everything is possible but nothing of interest is easy. -Alan Perlis",
    "If you give someone Fortran, he has Fortran. If you give someone Lisp, he has any language he pleases. -Guy L. Steele Jr",
    "If you have more things than names, your design is broken- Stuart Halloway",
    "Made with secret alien technology."
]


function makeTd(className: string, text: string) {
    let td = document.createElement("td");
    td.className = className;
    td.innerText = text;
    return td;
}

function makeSpan(className: string, text: string) {
    let td = document.createElement("span");
    td.className = className;
    td.innerText = text;
    return td;
}

let scanner = new lexer.Scanner();

function createStackTrace(exception: any) {
    let div = document.createElement("div");
    div.className = "stacktrace"
    let control = document.createElement("div");
    control.className = "show-ctrl"
    div.appendChild(control)

    let table = document.createElement("table")
    div.appendChild(table);

    let label = document.createElement("label")
    label.textContent = "Show: ";
    control.appendChild(label);
    
    let clojure = makeSpan("toggle clj", "Clojure");

    clojure.onclick = () => div.classList.toggle("clj")

    let java = makeSpan("toggle java", "Java");
    java.onclick = () => div.classList.toggle("java")

    let tool = makeSpan("toggle tooling", "Tooling");
    tool.onclick =() => div.classList.toggle("tooling")
    
    let dup = makeSpan("toggle dup", "Duplicates");
    dup.onclick =() => div.classList.toggle("dup")

    control.appendChild(clojure)
    control.appendChild(java)
    control.appendChild(tool)
    control.appendChild(dup)

    let stack = [];
    for(let x of exception.stacktrace) {
        let line = document.createElement("tr");
        stack.push(line);

        line.appendChild(makeTd("file",(x.file.length ? x.file : "nil")+":"));
        line.appendChild(makeTd("line",x.line));

        for(let flag of x.flags) {
            line.classList.add(flag);
        }

        if(x.type == "java" || x.type == "unknown") {
            let td = makeTd("stack", x.class +"/");
            td.appendChild(makeSpan("name", x.method));
            line.appendChild(td);
        } else if(x.type == "clj"|| x.type == "REPL") {
            let td = makeTd("stack",x.ns +"/");
            let name = x.var.substr(x.ns.length+1);                
            td.appendChild(makeSpan("name", name));
            td.appendChild(makeSpan("fn", x.fn.substr(name.length)))
            line.appendChild(td);
        }
        
        if(x["file-url"] && x["file-url"].length) {
            line.classList.add("navigable");
            line.addEventListener("click", () => {
                message.postMessage({ type: "goto-file", file: x["file-url"], line: x.line });
            })
        } else
            line.classList.add("no-source")

        table.appendChild(line);
    }
    return div;
}

window.addEventListener("keydown", e => {
    if(e.keyCode == 68 && e.ctrlKey) {
        message.postMessage({ type: "interrupt" });
    }
})

function renderReplResponse(newNs: string, text: string) {
    let div = document.createElement("div")
    for(let tk of scanner.processLine(text)) {
        let el = document.createElement("span");
        el.className = tk.type;
        el.textContent = tk.raw;
        div.appendChild(el);
        ns = newNs;
    }
    con.printElement(div);
}

let originalText: string;
let selectionStart: number;
let selectionEnd: number;

function restorePrompt() {
    con.requestPrompt(ns+"=> ");
    if(originalText) {
        con.setText(originalText);
        [con.readline.selectionStart, con.readline.selectionEnd] = [selectionStart, selectionEnd];
        con.readline.repaint();
        selectionStart = selectionEnd = 0;
        originalText = null;
    }
}

window.onmessage = (msg) => {   
    if(msg.data.type == "init") {
        ns = msg.data.ns;
        con.requestPrompt(ns + "=> ")
    }

    if(msg.data.type == "ui-command") {
        if(con.commands[msg.data.value])
            con.commands[msg.data.value]();
    }

    if(msg.data.type == "repl-response") {
        renderReplResponse(msg.data.ns, msg.data.value);
        restorePrompt();
    }

    if(msg.data.type == "do-eval") {
        if(con.readline) {
            con.readline.promptElem.textContent = msg.data.ns+"=> ";
            originalText = con.readline.model.getText(0, con.readline.model.maxOffset);
            [selectionStart, selectionEnd] = [con.readline.selectionStart, con.readline.selectionEnd];
            con.setText(msg.data.value);
            con.submitLine(false);
        }
    }

    if(msg.data.type == "repl-error") {
        let div = document.createElement("div")
        div.className = "error"
        div.textContent = msg.data.ex;
        con.printElement(div);
        restorePrompt();
    }

    if(msg.data.type == "disconnected") {
        let div = document.createElement("div");
        div.className = "error";
        div.textContent = "REPL disconnected."
        con.printElement(div);
        ns = msg.data.ns;
        con.readline.freeze()
    }

    if(msg.data.type == "reconnected") {
        let div = document.createElement("div");
        ns = msg.data.ns;
        div.className = "winnage";
        div.textContent = "REPL reconnected."
        con.printElement(div);
        restorePrompt();
    }

    if(msg.data.type == "repl-ex") {
        let exception = JSON.parse(msg.data.ex);
        let stackView = createStackTrace(exception);
        con.printElement(stackView);
        restorePrompt();
    }
    
    if(msg.data.type == "stdout") {
        con.print(msg.data.value);
    }

    if(msg.data.type == "complete") {
        while(completionDiv.firstChild)
            completionDiv.removeChild(completionDiv.firstChild);

        let currentText = con.readline.getTokenCursor().getPrevToken().raw;

        for(let completion of msg.data.data.completions) {
            let comp = document.createElement("div");

            let icon = document.createElement("span");
            icon.className = "icon ic-"+completion.type;

            comp.appendChild(icon);

            comp.appendChild(makeSpan("completed", completion.candidate.substring(0, currentText.length)));
            comp.appendChild(makeSpan("rest", completion.candidate.substring(currentText.length)));



            completionDiv.appendChild(comp);
        }

        if(msg.data.data.completions.length) {
            let box = con.readline.getCaretOnScreen();
            completionDiv.style.left = box.x + "px";
            completionDiv.style.top = box.y-completionDiv.offsetHeight + "px";
            completionDiv.style.visibility = "visible"
        }
    }

    if(msg.data.type == "stderr") {
        let div = document.createElement("div")
        div.className = "error"
        div.textContent = msg.data.value;
        con.printElement(div);
    }    
}
message.postMessage({ type: "init"})
document.querySelector("#motd").textContent = motd[Math.floor(Math.random()*motd.length)];
