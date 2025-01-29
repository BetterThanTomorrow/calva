---
title: Test Runner
description: Calva provides commands and facilities that make running your Clojure tests easier
---

# Test Runner

Calva provides commands that make running your Clojure tests easier.

!!! Note
    Since the test commands utilize cider-nrepl, they only work with Clojure, not ClojureScript. See [this issue](https://github.com/clojure-emacs/cider-nrepl/issues/555) for more details.

## Test Commands

Command | Shortcut | Description
--------|----------|------------
Run All Tests | `ctrl+alt+c shift+t` | Runs all tests
Run Failing Tests | `ctrl+alt+c ctrl+t` | Runs the tests that failed
Run Tests for Current Namespace | `ctrl+alt+c t` | Runs the tests for the current namespace. If not a `-test` namespace, tests for the current namespace plus its corresponding `<current-namespace>-test` namespace will be run.
Run Current Test | `ctrl+alt+c ctrl+alt+t` | Runs the test at the cursor. This includes a `defn` with a `:test` in its metadata, a `defn` defined in a `with-test`, and a `deftest`.
Toggle between implementation and test | - | Switches the file between implementation and test, prompts to create a new file if not found.
Load/Evaluate Test File (as saved on disk) for Current Namespace | - | Loads/Evaluates the test file for the current namespace. NB: The code that gets evaluated is what is saved on disk.

## Test on Save

You can enable the Calva setting "Test on Save" to have tests for the current namespace run on file save.

## VS Code Test UI

Calva has experimental support for showing test results in VS Code's Test UI. You can enable this support by setting `calva.useTestExplorer` to `true`. When you enable this setting, the Testing icon will appear in the Testing tab of VS Code's Activity Bar.

With this feature enabled you will be able to browse and run tests directly from the Testing tab.

Please join the [#calva channel](https://clojurians.slack.com/messages/calva) on the Clojurians Slack if you have any feedback on this new feature.

## Troubleshooting

### Tests Are Not Found

Calva will not load namespaces in the REPL that you haven't loaded. This is so that you can be in control of what is loaded in the REPL. However, it also means that commands like **Run All tests** actually mean **Run All Tests _That are Loaded in the REPL_**, since the test-runner only runs tests that it knows about, i.e. are loaded in the REPL. Some developers choose to make sure all test namespaces are loaded as part of starting their REPL. Others register a [custom REPL command](custom-commands.md) for loading test namepaces. (Yet others use test-runners such as [Cognitect's test-runner](https://github.com/cognitect-labs/test-runner), [Kaocha](https://github.com/lambdaisland/kaocha), [poly test](https://polylith.gitbook.io/poly/workflow/testing), or some other that runner allows for tests being run automatically, separate from the REPL used for development.)

If you have tests in a test directory separate from your source directory, and those tests are not being found by the test runner, make sure the test directory is included in your paths. This will not be the case by default with a tools.deps (deps.edn) project. If your project is a tools.deps project, you can create an alias in your deps.edn file with `:extra-paths` that includes `"test"` (or the name of your test directory).

```clojure
{:aliases {:dev {:extra-paths ["test"]}}}
```

#### Changes Aren't Taking Effect When Running Tests

In order for changes in code to take effect, you need to load the file or evaluate the changed code before running a test command. Prior to version 2.0.301, Calva would load the file for you when running some test commands, but that behavior was removed in favor of leaving control to the user, and to avoid a [potential issue](https://github.com/BetterThanTomorrow/calva/issues/1821).

Having added the above to your deps.edn, when you jack-in, choose the `:dev` alias and the `test` directory will be added to your paths, which will allow tests located in the directory to be found by the test runner.

### Toggle between implementation and test command not working as intended

This feature mostly works with projects that has leiningen style folder structure and makes some assumption about your folder structure and test file names.

- It assumes that the test files ends with `_test` prefix.
- It assumes that your implementation files are in `src` folder and the test files are in `test` folder.

If you are using any non leiningen style folder structure, you may have to add source paths inside `.lsp/config.edn`.

