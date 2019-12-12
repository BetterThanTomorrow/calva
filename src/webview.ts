import { ReplConsole } from "./webview/repl-console";
import * as lexer from "./cursor-doc/clojure-lexer";
var Ansi = require('ansi-to-html');
import "../assets/styles/webview.scss";
import escapeHTML = require("escape-html");
import * as paredit from "./cursor-doc/paredit";
import { ModelEdit, ModelEditSelection } from "./cursor-doc/model";

declare function acquireVsCodeApi(): { postMessage: (object: any) => void }
const message = acquireVsCodeApi();

const ansi = new Ansi();

let evaluationForm = "";
let evaluationNS = "";
let inEvaluation = false;
let inUserInput = false;
let ns = "user";
let con = new ReplConsole(document.querySelector(".repl"), (line, pprint) => {
    if (!inUserInput) {
        inEvaluation = true;
        message.postMessage({ type: "read-line", line: line, pprint: pprint })
    } else {
        inUserInput = false;
        let input = document.getElementById("repl-user-input-input") as HTMLInputElement;
        message.postMessage({ type: "user-input", line: input.value })
        let el = document.createElement("div");
        el.innerHTML = ansi.toHtml(escapeHTML(input.value));
        el.className = "output";
        con.printElement(el);
        removeUserInput();
    }
});

let completionDiv = document.createElement("div");
completionDiv.className = "completion";

let docDiv = document.createElement("div");
docDiv.className = "documentation";
con.addHistoryListener(line => {
    message.postMessage({ type: "history", line })
})

con.addCompletionListener(e => {
    if (e.type == "show") {
        if (con.readline) {
            let context = con.readline.model.getText(0, con.readline.model.maxOffset);
            let pos = con.readline.getTokenCursor().previous();
            if (pos.isWhiteSpace()) {
                if (pos.backwardList()) {
                    message.postMessage({ type: "info", ns: ns, symbol: pos.getToken().raw });
                }
            } else {
                context = context.substring(0, pos.offsetStart) + "__prefix__" + context.substring(pos.offsetEnd);
                message.postMessage({ type: "complete", symbol: pos.getToken().raw, context })
            }
        }
    } else if (e.type == "clear") {
        docDiv.style.visibility = "hidden";
        completionDiv.style.visibility = "hidden";
        completions = [];
    }
});

document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(completionDiv);
    document.body.appendChild(docDiv);
})


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

    let all = makeSpan("toggle none", "None");
    all.onclick = () => {
        const newState = all.textContent == "None",
            newTitle = all.textContent == "None" ? "All" : "None";
        for (let category of ["clj", "java", "tooling", "dup"]) {
            div.classList.toggle(category, newState);
            all.textContent = newTitle;
        }
    };

    let clojure = makeSpan("toggle clj", "Clojure");
    clojure.onclick = () => div.classList.toggle("clj");

    let java = makeSpan("toggle java", "Java");
    java.onclick = () => div.classList.toggle("java");

    let tool = makeSpan("toggle tooling", "Tooling");
    tool.onclick = () => div.classList.toggle("tooling");

    let dup = makeSpan("toggle dup", "Duplicates");
    dup.onclick = () => div.classList.toggle("dup");

    control.appendChild(all)
    control.appendChild(clojure)
    control.appendChild(java)
    control.appendChild(tool)
    control.appendChild(dup)

    // make the 'none' view the default.
    all.click();

    let stack = [];
    for (let x of exception.stacktrace) {
        let line = document.createElement("tr");
        stack.push(line);

        line.appendChild(makeTd("file", (x.file.length ? x.file : "nil") + ":"));
        line.appendChild(makeTd("line", x.line));

        for (let flag of x.flags) {
            line.classList.add(flag);
        }

        if (x.type == "java" || x.type == "unknown") {
            let td = makeTd("stack", x.class + "/");
            td.appendChild(makeSpan("name", x.method));
            line.appendChild(td);
        } else if (x.type == "clj" || x.type == "REPL") {
            let td = makeTd("stack", x.ns + "/");
            let name = x.var.substr(x.ns.length + 1);
            td.appendChild(makeSpan("name", name));
            td.appendChild(makeSpan("fn", x.fn.substr(name.length)))
            line.appendChild(td);
        }

        if (x["file-url"] && x["file-url"].length) {
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

function setCompletionIndex(idx: number) {
    completionDiv.children.item(selectedCompletion).classList.remove("active");
    selectedCompletion = idx;
    completionDiv.children.item(selectedCompletion).classList.add("active");
    completionDiv.children.item(selectedCompletion).scrollIntoView({ block: "nearest" });
    message.postMessage({ type: "info", ns: ns, symbol: completions[selectedCompletion] });
}

let hasSelection = false;

window.addEventListener("mousedown", e => {
    message.postMessage({ type: "focus" });
    hasSelection = false;
})

window.addEventListener("mouseup", e => {
    message.postMessage({ type: "focus" });
    if (!hasSelection) {
        con.input.focus();
    }
})

window.addEventListener('dblclick', function (e: MouseEvent) {
    message.postMessage({ type: "focus" });
    if (con.readline && !inEvaluation) {
        if (con.readline.withinBoundingClientRect(e.pageX, e.pageY)) {
            let pageOffset = con.readline.pageToOffset(e.pageX, e.pageY);
            let cursor = con.readline.model.getTokenCursor(pageOffset);
            if (cursor.withinString()) {
                let [selectionStart, selectionEnd] = con.readline.model.getWordSelection(pageOffset);
                con.readline.withUndo(() => {
                    con.readline.selection = new ModelEditSelection(selectionStart, selectionEnd);
                    con.readline.repaint();
                })
            } else {
                con.readline.withUndo(() => {
                    paredit.growSelection(con.readline)
                    con.readline.repaint();
                })
            }
        }
    }
});

window.addEventListener("focus", e => {
    message.postMessage({ type: "focus" });
    con.input.focus();
});

window.addEventListener("blur", e => {
    message.postMessage({ type: "blur" });
});


document.addEventListener("selectionchange", e => {
    const s = document.getSelection();
    hasSelection = s.focusOffset != s.anchorOffset;
});

window.addEventListener("keydown", e => {
    if (e.keyCode == 68 && e.ctrlKey) {
        message.postMessage({ type: "interrupt" });
    }
    //// Handle completion popup
    if (completions.length) {
        if (e.keyCode == 38) { // upArrow
            let n = selectedCompletion - 1;
            if (n < 0)
                n = completions.length - 1;
            setCompletionIndex(n);
            e.stopImmediatePropagation()
            e.preventDefault();
        }
        if (e.keyCode == 40) { // upArrow
            setCompletionIndex((selectedCompletion + 1) % completions.length);
            e.stopImmediatePropagation()
            e.preventDefault();
        }
        if (e.keyCode == 34) { // page up
            setCompletionIndex(Math.min((selectedCompletion + 21), completions.length - 1));
            e.stopImmediatePropagation()
            e.preventDefault();
        }
        if (e.keyCode == 33) { // page down
            setCompletionIndex(Math.max((selectedCompletion - 21), 0));
            e.stopImmediatePropagation()
            e.preventDefault();
        }
        if (e.keyCode == 36) { // home
            setCompletionIndex(0);
            e.stopImmediatePropagation()
            e.preventDefault();
        }
        if (e.keyCode == 35) { // end
            setCompletionIndex(completions.length - 1);
            e.stopImmediatePropagation()
            e.preventDefault();
        }
        if (e.keyCode == 27 && completions.length) {
            docDiv.style.visibility = "hidden";
            completionDiv.style.visibility = "hidden";
            completions = [];
            e.stopImmediatePropagation()
            e.preventDefault();
        }
        if (e.keyCode == 9 || e.keyCode == 13) { // tab or enter
            let tk = con.readline.getTokenCursor(con.readline.selectionEnd, true)
            if (tk.isWhiteSpace())
                tk.previous();
            let start = tk.offsetStart
            let end = tk.offsetEnd;
            con.readline.withUndo(() => {
                con.readline.model.edit([
                    new ModelEdit('changeRange', [start, end, completions[selectedCompletion]])
                ], {});
            });
            con.readline.selectionStart = con.readline.selectionEnd = start + completions[selectedCompletion].length;
            docDiv.style.visibility = "hidden";
            completionDiv.style.visibility = "hidden";
            completions = [];
            con.readline.repaint();
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    } else {
        if (e.keyCode == 0x20 && e.ctrlKey) {
            con.readline.maybeShowCompletion();
            e.stopImmediatePropagation()
            e.preventDefault();
        }
    }
    if (e.ctrlKey || e.metaKey) {
        switch (e.keyCode) {
            case 67: // C /- don't prevent default here or we'll loose the "cut" "copy" and "paste" events!
            case 86: // V |
            case 88: // X v
                break;
            default:
                e.preventDefault();
        }
    }
}, { capture: true, passive: false })

function renderReplResponse(newNs: string, text: string) {
    let div = document.createElement("div"),
        line = null,
        content = null;
    // the code cannot handle '\n\r' line endings
    // so ensure we remove the '\r'.
    text = text.replace(/\r/g, "")
    div.className = "repl-response";
    for (let tk of scanner.processLine(text)) {
        if (!line || tk.raw == "\n") {
            line = document.createElement("div");
            content = document.createElement("div");
            line.appendChild(content);
            div.appendChild(line);
        }
        let el = document.createElement("span");
        line.className = "line";
        content.className = "content";
        el.className = tk.type;
        el.textContent = tk.raw.replace(/\n\r?/, "");
        content.appendChild(el);
        ns = newNs;
    }
    con.printElement(div);
}

let originalText: string;
let selectionStart: number;
let selectionEnd: number;

function restorePrompt() {
    con.requestPrompt(ns + "=> ");
    if (originalText) {
        con.setText(originalText);
        [con.readline.selectionStart, con.readline.selectionEnd] = [selectionStart, selectionEnd];
        con.readline.repaint();
        selectionStart = selectionEnd = 0;
        originalText = null;
    }
}

let completions: string[] = [];
let selectedCompletion: number;

function updateCompletion(msg: any) {
    while (completionDiv.firstChild)
        completionDiv.removeChild(completionDiv.firstChild);

    let currentText = con.readline.getTokenCursor().getPrevToken().raw;
    completions = [];
    selectedCompletion = 0;

    if (msg.data.data.completions) {
        msg.data.data.completions.sort((x, y) => {
            if (x.candidate < y.candidate)
                return -1;
            if (x.candidate > y.candidate)
                return 1;
            return 0;
        })

        for (let completion of msg.data.data.completions) {
            let comp = document.createElement("div");
            completions.push(completion.candidate);
            let icon = document.createElement("span");
            icon.className = "icon ic-" + completion.type; // nice to actually have icons but this is better than nothing.
            comp.appendChild(icon);
            comp.appendChild(makeSpan("completed", completion.candidate.substring(0, currentText.length)));
            comp.appendChild(makeSpan("rest", completion.candidate.substring(currentText.length)));
            completionDiv.appendChild(comp);
        }

        if (msg.data.data.completions.length) {
            let box = con.readline.getCaretOnScreen();
            if (box.x + completionDiv.offsetWidth > window.innerWidth) {
                completionDiv.style.left = window.innerWidth - completionDiv.offsetWidth + "px";
            } else {
                completionDiv.style.left = box.x + "px";
            }
            completionDiv.style.top = box.y - completionDiv.offsetHeight + "px";
            completionDiv.style.visibility = "visible"
            completionDiv.firstElementChild.classList.add("active");
            message.postMessage({ type: "info", ns: ns, symbol: completions[selectedCompletion] });
        } else {
            completionDiv.style.visibility = "hidden"
            docDiv.style.visibility = "hidden"
        }
    }
}
/**
 * Update the documentation popup
 * @param msg the message
 */
function updateDoc(msg: any) {
    while (docDiv.firstChild)
        docDiv.removeChild(docDiv.firstChild);
    if (msg.data.name) {
        let nameDiv = document.createElement("div");
        nameDiv.className = "name";
        nameDiv.textContent = msg.data.name + " " + (msg.data.macro ? " (macro)" : msg.data.function ? "(function)" : msg.data["special-form"] ? "(special form)" : "");
        docDiv.appendChild(nameDiv);

        if (msg.data["arglists-str"]) {
            for (let argList of msg.data["arglists-str"].split('\n')) {
                let argLine = document.createElement("div");
                argLine.className = "arglist";
                argLine.textContent = argList;
                docDiv.appendChild(argLine);
            }
        } else if (msg.data["forms-str"]) {
            for (let argList of msg.data["forms-str"].split('\n')) {
                let argLine = document.createElement("div");
                argLine.className = "arglist";
                argLine.textContent = argList;
                docDiv.appendChild(argLine);
            }
        }

        let docLine = document.createElement("div");
        docLine.className = "docstring";
        docLine.textContent = msg.data.doc;

        docDiv.appendChild(docLine);
        let extra = completionDiv.style.visibility == "visible" ? completionDiv.offsetWidth : 0;
        let box = con.readline.getCaretOnScreen();
        docDiv.style.visibility = "visible"
        docDiv.style.top = box.y - docDiv.offsetHeight + "px";
        if (box.x + completionDiv.offsetWidth + extra > window.innerWidth) {
            completionDiv.style.left = window.innerWidth - (completionDiv.offsetWidth + docDiv.offsetWidth) + "px";
            docDiv.style.left = window.innerWidth - docDiv.offsetWidth + "px";
        } else {
            completionDiv.style.left = box.x + "px";
            docDiv.style.left = box.x + extra + "px";
        }

        docDiv.firstElementChild.classList.add("active");
    } else {
        docDiv.style.visibility = "hidden"
    }
}

function hasUserInput() {
    let element = document.getElementById("repl-user-input");
    if (element) {
        return (element);
    }
    return (false);
}

function removeUserInput() {
    let element = document.getElementById("repl-user-input");
    if (element) {
        message.postMessage({ type: "user-input", line: "" });
        element.remove();
    }
}

function showUserInput() {
    inUserInput = true;
    removeUserInput();
    let div = document.createElement("div");
    div.id = "repl-user-input";
    let input = document.createElement("input");
    input.id = "repl-user-input-input"
    input.style.width = "100%";
    input.className = "userinput"
    div.appendChild(input);
    con.printElement(div);
    input.focus();
}

function storeEvaluation(ns: string, form: string) {
    evaluationNS = String(ns).trim();
    evaluationForm = String(form).trim();
}

function runEvaluation(ns: string, form: string) {
    if (con.readline && ns && form) {
        con.readline.promptElem.textContent = ns + "=> ";
        originalText = con.readline.model.getText(0, con.readline.model.maxOffset);
        [selectionStart, selectionEnd] = [con.readline.selectionStart, con.readline.selectionEnd];
        con.setText(form);
        con.submitLine(true);
    }
}

function runStoredEvaluation() {
    if (evaluationNS && evaluationForm) {
        runEvaluation(evaluationNS, evaluationForm);
    }
    evaluationNS = "";
    evaluationForm = "";
}

function showAsyncOutput(classname: string, id: string, text: string) {
    text = `<repl#${id}>` + text;
    let el = document.createElement("div");
    el.innerHTML = ansi.toHtml(escapeHTML(text));
    el.className = classname;
    con.printElementBeforeReadline(el);
    let userinput = hasUserInput();
    if (userinput) {
        userinput.scrollIntoView({ block: "end" });
    }
}

window.onmessage = (msg) => {

    if (msg.data.type == "init") {
        ns = msg.data.ns;
        con.setHistory(msg.data.history);
        con.requestPrompt(ns + "=> ")
    }

    if (msg.data.type == "clear") {
        message.postMessage({ type: "interrupt" });
        removeUserInput();
        ns = msg.data.ns;
        con.setHistory(msg.data.history);
        con.commands["clear-window"]
        con.requestPrompt(ns + "=> ")
    }

    if (msg.data.type == "need-input") {
        showUserInput();
    }

    if (msg.data.type == "paredit-keymap") {
        con.setPareditKeyMap(msg.data.keymap);
    }

    if (msg.data.type == "ui-command") {
        if (con.commands[msg.data.value])
            con.commands[msg.data.value]();
    }

    if (msg.data.type == "repl-response") {
        inEvaluation = false;
        removeUserInput();
        renderReplResponse(msg.data.ns, msg.data.value);
        restorePrompt();
        runStoredEvaluation();
    }

    if (msg.data.type == "repl-error") {
        inEvaluation = false;
        removeUserInput();
        let div = document.createElement("div")
        div.className = "error"
        div.innerHTML = ansi.toHtml(msg.data.ex);
        con.printElement(div);
        let exception = JSON.parse(msg.data.stacktrace);
        if (exception && exception.stacktrace) {
            let stackView = createStackTrace(exception);
            con.printElement(stackView);
        }
        restorePrompt();
        runStoredEvaluation();
    }

    if (msg.data.type == "stdout") {
        removeUserInput();
        let el = document.createElement("div");
        el.innerHTML = ansi.toHtml(escapeHTML(msg.data.value));
        el.className = "output";
        con.printElement(el);
    }

    if (msg.data.type == "stderr") {
        removeUserInput();
        let div = document.createElement("div")
        div.className = "error"
        div.innerHTML = ansi.toHtml(escapeHTML(msg.data.value));
        con.printElement(div);
    }

    if (msg.data.type == "do-eval") {
        if (hasUserInput() || inEvaluation) {
            removeUserInput();
            message.postMessage({ type: "interrupt" });
            storeEvaluation(msg.data.ns, msg.data.value);
            return;
        }
        runEvaluation(msg.data.ns, msg.data.value);
    }

    if (msg.data.type == "set-ns!") {
        removeUserInput();
        ns = msg.data.ns;
        con.readline.promptElem.textContent = msg.data.ns + "=> ";
    }

    if (msg.data.type == "disconnected") {
        removeUserInput();
        let div = document.createElement("div");
        div.className = "error";
        div.textContent = "REPL disconnected."
        con.printElement(div);
        ns = msg.data.ns;
        con.readline.freeze()
    }

    if (msg.data.type == "reconnected") {
        removeUserInput();
        let div = document.createElement("div");
        ns = msg.data.ns;
        div.className = "winnage";
        div.textContent = "REPL connected."
        con.printElement(div);
        if (msg.data.value) {
            div = document.createElement("div")
            div.className = "error"
            div.innerHTML = ansi.toHtml(escapeHTML(msg.data.value));
            con.printElement(div);
        }
        restorePrompt();
    }

    if (msg.data.type == "info") {
        removeUserInput();
        updateDoc(msg.data);
    }

    if (msg.data.type == "complete") {
        removeUserInput();
        updateCompletion(msg);
    }

    if (msg.data.type == "async-stdout") {
        showAsyncOutput("output", msg.data.id, msg.data.value);
    }

    if (msg.data.type == "async-stderr") {
        showAsyncOutput("error", msg.data.id, msg.data.value);
    }
}
message.postMessage({ type: "init" });
