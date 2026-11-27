# Calva test project

This folder is what the dev Extension Host opens when Calva is developed ("Launch w/ test folder" in the `calva` repo). Its Calva is the one under development, built from the repo's `out/`. Agents here test it.

## For AI agents working in this project

Load the **`calva-testing`** skill (`.github/skills/calva-testing/SKILL.md`) before you test anything. It says how to check that your tools reach this window's Calva, which REPL sessions to expect, and how to test each part of Calva. The **`backseat-driver`** skill covers the Calva REPL tools, and the **`joyride`** skill covers Joyride. The `calva-tester` agent (`.github/agents/calva-tester.agent.md`) runs one test task and reports.

Don't reload this window. An agent that runs in it stops with it.

## Project structure

```
.joyride/src/test_project.cljs   - Starts and stops the REPLs and the tic-tac-toe Flare
.joyride/scripts/                - workspace_activate.cljs, which starts them when the window opens
repls/clj/                       - The JVM Clojure project that the task "clj nREPL" serves
repls/bb/                        - The Babashka project that the task "bb nREPL" serves
projects/scittle-replicant-tic-tac-toe/ - A Scittle tic-tac-toe built with Replicant, shown in a Flare
.github/                         - The testing skill and the calva-tester agent
```

The rest of `test-data` holds projects and files for trying Calva by hand.

## Starting the REPLs and the Flare

When the window opens, `.joyride/scripts/workspace_activate.cljs` runs `test-project/start!`. It starts four sessions:

| Session | REPL | Project root |
|---------|------|--------------|
| `clj` | JVM Clojure with cider-nrepl, run by the task **clj nREPL** | `repls/clj` |
| `bb` | Babashka, run by the task **bb nREPL** | `repls/bb` |
| `joyride` | This window's Joyride, through Calva's Joyride jack-in | `.` |
| `tic-tac-toe` | Scittle in the tic-tac-toe Flare, over Calva's WebSocket server on port 13401 | `projects/scittle-replicant-tic-tac-toe` |

The clj and bb servers run as VS Code tasks, which keep running when the window reloads, so a reload only reconnects to them. Calva connects to them through the `.nrepl-port` file each server writes in its project. The Joyride and Scittle REPLs run in the window's extension host and start again with it.

`start!` looks at what is already running first, so it only starts what is missing. The VS Code tasks **test project: start** and **test project: stop** start and stop all of it. The connect sequences are in `test_project.cljs`, not in the settings, so the settings' sequences stay the ones for trying Calva by hand.

The tic-tac-toe game's state is `replicant-tictactoe.core/!store`, and `replicant-tictactoe.core/event-handler!` makes moves, such as `[:tic 1 1]` and `[:reset]`.
