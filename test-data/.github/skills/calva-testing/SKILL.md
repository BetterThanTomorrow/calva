---
name: calva-testing
description: 'Testing the Calva under development, in the dev Extension Host. Use when: testing Calva, smoke testing after a change, checking evaluation in the clj, bb, joyride and tic-tac-toe sessions, who-tracking, session routing, load file, the onOutputLogged API, the Scittle REPL in a Flare, or jack-in and Jack-Out.'
---

# Calva testing

This window is the dev Extension Host. Its Calva is the one under development, built from the `calva` repo's `out/`, and the test project is `test-data` in that repo. Each section below stands on its own: run one, a few, or all of them.

The tools are Backseat Driver's `clojure_evaluate_code` and `clojure_list_sessions`, which go through this window's Calva, and Joyride's `joyride_evaluate_code`, which reaches this window's VS Code API and the `test-project` namespace. Pass `awaitResult: true` to `joyride_evaluate_code` when the code returns a promise.

## Before you start

1. Check that your Joyride tool reaches this window's Calva. Evaluate with `joyride_evaluate_code`:
   ```clojure
   (.. (js/require "vscode") -extensions (getExtension "betterthantomorrow.calva") -extensionPath)
   ```
   Expect the path of the `calva` repo, such as `"/Users/pez/Projects/calva"`. A path under `~/.vscode/extensions/` means the tool reaches an installed Calva in another window. Stop and tell the user.
2. Call `clojure_list_sessions`. The test project starts four sessions when the window opens (`.joyride/src/test_project.cljs`):

   | Session | REPL | Project root |
   |---------|------|--------------|
   | `clj` | JVM Clojure with cider-nrepl, run by the task **clj nREPL** | `repls/clj` |
   | `bb` | Babashka, run by the task **bb nREPL** | `repls/bb` |
   | `joyride` | This window's Joyride, through Calva's Joyride jack-in | `.` |
   | `tic-tac-toe` | Scittle in the tic-tac-toe Flare, over Calva's WebSocket server on port 13401 | `projects/scittle-replicant-tic-tac-toe` |

   If one is missing, run the VS Code task **test project: start**, or evaluate `(test-project/start!)` with `awaitResult: true`, and list the sessions again. It starts only what is missing and resolves to what each step found or did, such as `{:tasks {"clj nREPL" :was-running, "bb nREPL" :was-running}, :websocket-server :started, :sessions {"clj" :connected, "bb" :connected, "joyride" :jacked-in, "tic-tac-toe" :opened}}`. `"joyride"` is `:connected` instead of `:jacked-in` when Joyride's nREPL server was already running. `@test-project/!reports` holds the last result of `start!` and `stop!`, also of the run when the window opened. If a session is still missing, tell the user before running the sections that need it.

## Test conventions

Use `"calva-tester"` as the `who` for your evaluations, and other slugs only where a section asks for them.

Some steps wait for something to happen. `test-project/wait-for!+` takes a function and a timeout in milliseconds, calls the function every half second until it returns something truthy, and resolves to the last value. Evaluate it with `awaitResult: true`.

Don't reload this window and don't restart the dev Extension Host. An agent that runs in this window stops with it.

Each section ends by cleaning up after itself. Leave the four sessions connected, and the tic-tac-toe Flare open with a new game.

## Evaluation

`clojure_evaluate_code`, in the `user` namespace unless a step says otherwise.

1. `(+ 1 2)` gives `"result":"3"` in each of `clj`, `bb`, `joyride` and `tic-tac-toe`, with `"session-key"` naming the session.
2. Each session is the REPL it says it is:
   - `clj`: `(System/getProperty "babashka.version")` gives `"nil"`.
   - `bb`: `(some? (System/getProperty "babashka.version"))` gives `"true"`.
   - `joyride`: `(some? (find-ns 'joyride.core))` gives `"true"`.
   - `tic-tac-toe`: `(some? (js/document.querySelector "#app"))` gives `"true"`.
3. In `clj`, `(println "hello")` gives `"result":"nil"` and `"stdout":"hello\n"`.
4. In `clj`, `(throw (ex-info "boom" {:a 1}))` gives `"error":"class clojure.lang.ExceptionInfo"`, a `"stderr"` that contains `boom`, and a `"stacktrace"` whose `"message"` is `"boom"` and `"data"` is `"{:a 1}"`.
5. In `bb`, as `who` `"calva-tester-b"`, evaluate `(def x 42)`. Then as `"calva-tester"`, `x` gives `"result":"42"` and `"other-whos-since-last":["calva-tester-b"]`.
6. Clean up with `(ns-unmap 'user 'x)` in `bb`.

## Routing

`joyride_evaluate_code` with `awaitResult: true`. `(test-project/open-file!+ path)` opens a file of this workspace in an editor and resolves to the session Calva routes it to. `(test-project/has-tab? path)` says whether a file has a tab, and `(test-project/close-file!+ path)` closes its tabs. The user may have some of these files open, so before step 1, keep the files that have no tab: `(def opened-here (vec (remove test-project/has-tab? files)))`, with `files` the paths in the table.

1. Each file routes to the session of its project:

   | File | Session |
   |------|---------|
   | `repls/clj/src/hello_clj.clj` | `clj` |
   | `repls/clj/deps.edn` | `clj` |
   | `repls/bb/src/hello_bb.bb` | `bb` |
   | `repls/bb/nrepl_server.clj` | `bb`: a `.clj` file in the Babashka project |
   | `.joyride/src/test_project.cljs` | `joyride` |
   | `projects/scittle-replicant-tic-tac-toe/resources/scittle/replicant_tictactoe/core.cljs` | `tic-tac-toe` |

2. Open `repls/clj/src/hello_clj.clj`, and `clojure_list_sessions` shows `clj` as the current routed target (`"currentRoutedTarget": true`). Open `repls/bb/src/hello_bb.bb`, and the target moves to `bb`.
3. Clean up by closing the files in `opened-here` with `test-project/close-file!+`, one at a time, and `(ns-unmap 'user 'opened-here)`.

## Load file

1. Through `joyride_evaluate_code`, with `awaitResult: true`, note whether `repls/clj/src/hello_clj.clj` has a tab with `test-project/has-tab?`, open it with `test-project/open-file!+`, then `(vscode/commands.executeCommand "calva.loadFile")`. It gives `"#<Promise \"nil\">"`: the command resolves to the evaluation's result as a string.
2. Through `clojure_evaluate_code` in `clj`, `(clojure.string/starts-with? (hello-clj/greet "Calva") "Hello, Calva, from Clojure")` gives `"true"`, and `"other-whos-since-last"` has `"ui"`: Calva loaded the file on behalf of the UI.
3. With `namespace` `"hello-clj"`, `(str *ns*)` gives `"\"hello-clj\""`.
4. Do the same with `repls/bb/src/hello_bb.bb` in `bb`: `(clojure.string/starts-with? (hello-bb/greet "Calva") "Hello, Calva, from Babashka")` gives `"true"`, and with `namespace` `"hello-bb"`, `(str *ns*)` gives `"\"hello-bb\""`.
5. Close each file that had no tab before with `test-project/close-file!+`. The loaded namespaces can stay.

## Output

`joyride_evaluate_code` with `awaitResult: true`. Calva's API reports every output message to `onOutputLogged` subscribers.

1. Subscribe, evaluate, wait for the result, and dispose:
   ```clojure
   (def !logged (atom []))
   (defn ^:async output-check+ []
     (let [repl (await (test-project/calva-repl+))
           sub (.onOutputLogged repl (fn [m] (swap! !logged conj (js->clj m :keywordize-keys true))))]
       (try
         (await (.evaluate repl "(do (println \"to stdout\") :to-result)"
                           #js {:sessionKey "clj" :ns "user" :who "calva-tester"}))
         (await (test-project/wait-for!+ #(some (fn [m] (= "evaluationResults" (:category m))) @!logged) 3000))
         (mapv #(select-keys % [:category :text :who]) @!logged)
         (finally (.dispose sub)))))
   (output-check+)
   ```
   It resolves to three messages, each with `:who "calva-tester"`: `"evaluatedCode"` with the code, `"evaluationOutput"` with `"to stdout\n"`, and `"evaluationResults"` with `":to-result"`. Messages from other evaluators can come in between when other agents run.
2. Clean up with `(ns-unmap 'user '!logged)` and `(ns-unmap 'user 'output-check+)`.

## The Scittle REPL in a Flare

`clojure_evaluate_code` with `replSessionKey` `"tic-tac-toe"`, in `user`. The game is `projects/scittle-replicant-tic-tac-toe/resources/scittle/replicant_tictactoe/`, and its state is the atom `replicant-tictactoe.core/!store`.

1. `(replicant-tictactoe.core/event-handler! {} [:tic 1 1])` gives `{:next-player :o, :size 3, :tics {[1 1] :x}}`. A second move, `[:tic 0 0]`, is an `:o`, and `(:tics @replicant-tictactoe.core/!store)` gives `{[1 1] :x, [0 0] :o}`.
2. Through `joyride_evaluate_code`, with `awaitResult: true`, `(test-project/reload-tic-tac-toe!+)` gives `"#<Promise :reloaded>"`. It closes the Flare, opens it again, and resolves when the new page's game is there: the page connects before its game scripts have loaded, so the test project's ready check for this session is `(exists? replicant-tictactoe.core/!store)`. `(:tics @replicant-tictactoe.core/!store)` is now `nil`, since the new page started a new game.
3. End with `(replicant-tictactoe.core/event-handler! {} [:reset])`.

## Jack-in

`joyride_evaluate_code` with `awaitResult: true`. This jacks in to the small Babashka project in `integration-test/bb-mini`, as the session `jack-in-bb`, and jacks out again.

1. Jack in, and wait for the session to answer:
   ```clojure
   (require '["vscode" :as vscode])
   (vscode/commands.executeCommand "calva.jackIn"
                                   (clj->js {:connectSequence {:name "calva-tester: jack-in"
                                                               :projectType "babashka"
                                                               :projectRootPath ["integration-test" "bb-mini"]
                                                               :replSessionNames {:primary "jack-in-bb"}}
                                             :disableAutoSelect true}))
   (test-project/wait-for!+ #(test-project/answers?+ "jack-in-bb") 60000)
   ```
   The wait resolves to `true`. Don't await the command itself: it doesn't resolve when the session is up.
2. `clojure_list_sessions` lists `jack-in-bb` beside the four sessions, and `(+ 1 2)` in `jack-in-bb` gives `"result":"3"`.
3. `(vscode/commands.executeCommand "calva.jackOut")`, then `(test-project/wait-for!+ #(.then (test-project/connected?+ "jack-in-bb") not) 30000)` resolves to `true`. **Jack-Out** stops every jack-in process in the window. The four sessions aren't jack-in processes, so they stay, and `clojure_list_sessions` lists them.

## Delegation to `calva-tester`

The `calva-tester` agent loads this skill, runs one test task, and reports. After **Before you start**, the sections can run in their own tester agents, in parallel. Pass each agent its section, the session keys you found, and its own `who`. In a parallel run, `other-whos-since-last` and the Output messages also show the other agents.

## Reporting

Report only the sections that ran. For each one: passed, failed, or something unexpected, with the tool responses as evidence. For a failure, what was expected, what came back, and the code that was evaluated. End with what was cleaned up.
