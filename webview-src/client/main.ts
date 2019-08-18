import { ReplConsole } from "./repl-console";

let console = new ReplConsole(document.querySelector(".repl"), (line) => {
    console.requestPrompt("user=> ");
});

console.requestPrompt("user=> ")
document.addEventListener("DOMContentLoaded", () => {
    console.input.focus();
})