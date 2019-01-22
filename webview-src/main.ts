import { ReplConsole } from "repl-interactor";
import * as lexer from "repl-interactor/js/clojure-lexer"
declare function acquireVsCodeApi(): { postMessage: (object: any) => void }
const message = acquireVsCodeApi();

let ns = "user";
let con = new ReplConsole(document.querySelector(".repl"), line => {
    message.postMessage({ type: "read-line", line: line})
});

document.addEventListener("DOMContentLoaded", () => {
    con.input.focus();
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


let scanner = new lexer.Scanner();
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
        let div = document.createElement("div")
        for(let tk of scanner.processLine(msg.data.value)) {
            let el = document.createElement("span");
            el.className = tk.type;
            el.textContent = tk.raw;
            div.appendChild(el);
            ns = msg.data.ns;
        }
        con.printElement(div);
        con.requestPrompt(ns+"=> ")
    }

    if(msg.data.type == "repl-error") {
        let div = document.createElement("div")
        div.className = "error"
        div.textContent = msg.data.ex;
        con.printElement(div);
        con.requestPrompt(ns+"=> ")
    }
    
    if(msg.data.type == "stdout") {
        con.print(msg.data.value);
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
