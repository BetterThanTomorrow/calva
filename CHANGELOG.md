# Change Log

Changes to Calva.

## [Unreleased]

- Fix: [Fix description of calva.autoOpenResultOutputDestination setting](https://github.com/BetterThanTomorrow/calva/pull/2721)

## [2.0.485] - 2025-01-27

- Fix: [Stop considering a clj-kondo config as a valid project to start LSP processes](https://github.com/BetterThanTomorrow/calva/issues/2712)
- Bump deps.clj to v1.12.0.1495-2

## [2.0.484] - 2025-01-26

- [Have test runner show diff between "actual" and "expected"](https://github.com/BetterThanTomorrow/calva/issues/1007)
- Fix: [cursor-context calva:ns is less accurate than the *ns* used by calva.evaluateSelection](https://github.com/BetterThanTomorrow/calva/issues/2708)
- Fix: [Computing cursor-context calva:ns slows down editing and moving the cursor](https://github.com/BetterThanTomorrow/calva/issues/2707)

## [2.0.483] - 2025-01-08

- Fix: [Paredit garbles while backspacing rapidly](https://github.com/BetterThanTomorrow/calva/issues/2611)
- Fix: [Paredit garbles when deleteForward is repeated rapidly](https://github.com/BetterThanTomorrow/calva/issues/2691)
- Fix: [Del key, after emptying a comment line, then imbalances the next form](https://github.com/BetterThanTomorrow/calva/issues/2686)

## [2.0.482] - 2024-12-03

- Fix: [Added 'replace-refer-all-with-alias' & 'replace-refer-all-with-refer' actions to calva.](https://github.com/BetterThanTomorrow/calva/issues/2667)

## [2.0.481] - 2024-10-29

- [Add extension when contexts for Calva states such as project root, session type, ns](https://github.com/BetterThanTomorrow/calva/issues/2652)
- Fix: [Calva internals: The `backwardSexp` function can't handle skipping ignored forms, even though it says it can](https://github.com/BetterThanTomorrow/calva/issues/2657)
- Fix: [Keep support for evaluating top level form in ignored forms when at top level](https://github.com/BetterThanTomorrow/calva/issues/2655)
- [Enable separate styling for top level ignored forms](https://github.com/BetterThanTomorrow/calva/issues/2660)

## [2.0.480] - 2024-10-21

- Fix: [Custom command snippets use the wrong ns when repl sessions types do not match](https://github.com/BetterThanTomorrow/calva/issues/2653)
- Fix: [ns inner blocks are kept on the same line by default when using the clean ns command](https://github.com/BetterThanTomorrow/calva/issues/2648)

## [2.0.479] - 2024-10-01

- [Autostart REPL in created projects, also when created in the current folder](https://github.com/BetterThanTomorrow/calva/issues/2644)

## [2.0.478] - 2024-09-30

- [Add `extraNReplMiddleware` to `connectSequence`](https://github.com/BetterThanTomorrow/calva/issues/1691)

## [2.0.477] - 2024-09-29

- Fix: [Global custom repl command keys override workspace dittos, should be the other way around](https://github.com/BetterThanTomorrow/calva/issues/2640)

## [2.0.476] - 2024-09-28

- Fix: [Formatting and some pretty printing croaks on new Clojure 1.12.0 syntax](https://github.com/BetterThanTomorrow/calva/issues/2637)

## [2.0.475] - 2024-09-24

- Fix: [Can't start REPL in lein projects with backtick on project.clj](https://github.com/BetterThanTomorrow/calva/issues/2633)

## [2.0.474] - 2024-09-22

- [Synchronize the file extensions for Calva and Calva Spritz](https://github.com/BetterThanTomorrow/calva/issues/2629)
- Fix: [Terminal output pretty printing fails when using `printerFn` pretty print option](https://github.com/BetterThanTomorrow/calva/issues/2630)

## [2.0.473] - 2024-09-21

- [Add some different types of comment styles when evaluating to comment](https://github.com/BetterThanTomorrow/calva/issues/2626)

## [2.0.472] - 2024-09-15

- [Preserve whitespaces format of evaluation error in tooltip](https://github.com/BetterThanTomorrow/calva/issues/2623)

## [2.0.471] - 2024-09-12

- [Trim leading newlines from the result/error string before inline display](https://github.com/BetterThanTomorrow/calva/issues/2617)

## [2.0.470] - 2024-09-11

- Bump deps.clj to v1.12.0.1479

## [2.0.469] - 2024-09-10

- Fix: [Windows – Jack-in for shadow-cljs fails to start with "Error: spawn EINVAL" on the latest VS Code version](https://github.com/BetterThanTomorrow/calva/issues/2616)

## [2.0.468] - 2024-09-03

- Bump deps.clj to v1.11.4.1474
- [Prioritize Workspace configured connect sequences over User configured dittos](https://github.com/BetterThanTomorrow/calva/issues/2606)

## [2.0.467] - 2024-07-14

- Fix: [Test explorer creates a test case each time a keystroke is registered](https://github.com/BetterThanTomorrow/calva/issues/2530)

## [2.0.466] - 2024-07-13

- Internal: Move drams-menu configuration to the Drams repository. Preparing for ways to contribute drams to Calva.

## [2.0.465] - 2024-07-10

- [Only alert if the Jack-in process is interrupted before the repl is started](https://github.com/BetterThanTomorrow/calva/issues/2600)

## [2.0.464] - 2024-07-10

- Internal: Change how drams (projects that Calva can create) are bing defined. Preparing for ways to contribute drams to Calva.
- [Make the user aware about errors during jack-in](https://github.com/BetterThanTomorrow/calva/issues/2597)
- [Report progress waiting for shadow-cljs runtimes without printing to output](https://github.com/BetterThanTomorrow/calva/issues/2599)

## [2.0.463] - 2024-07-08

- [Stop the test runner from loading the test namespace before running tests](https://github.com/BetterThanTomorrow/calva/issues/2594)

## [2.0.462] - 2024-07-03

- [Stop offering to use existing temp files when creating a project](https://github.com/BetterThanTomorrow/calva/issues/2589)
- Fix: [Version 2.0.461 of Calva breaks deps.edn jack-in on some Windows machines](https://github.com/BetterThanTomorrow/calva/issues/2592)

## [2.0.461] - 2024-07-01

- Fix: [Powershell sometimes used for jack-in on windows, and it doesn't work](https://github.com/BetterThanTomorrow/calva/issues/2586)
- [Remove remaining references to the Output Window](https://github.com/BetterThanTomorrow/calva/issues/2587)

## [2.0.460] - 2024-06-28

- [Add configuration for automatically starting and connecting the project REPL](https://github.com/BetterThanTomorrow/calva/issues/2583)

## [2.0.459] - 2024-06-23

- [Do not open auto open the jack-in terminal by default](https://github.com/BetterThanTomorrow/calva/issues/2578)
- [Don't show Calva says output channel by default](https://github.com/BetterThanTomorrow/calva/issues/2580)
- [Default to reveal the Calva inspector on repl connect](https://github.com/BetterThanTomorrow/calva/issues/2581)
- [Send load/evaluate current file results to the inspector](https://github.com/BetterThanTomorrow/calva/issues/2579)

## [2.0.458] - 2024-06-22

- [Always include the project creation commands in the REPL menu](https://github.com/BetterThanTomorrow/calva/issues/2575)
- [Automatically reveal the configured result output destination on REPL connect](https://github.com/BetterThanTomorrow/calva/issues/2576)

## [2.0.457] - 2024-06-20

- [Add Command for creating a minimal Clojure project](https://github.com/BetterThanTomorrow/calva/issues/2570)
- [Improve error message when tutorial files are unreachable](https://github.com/BetterThanTomorrow/calva/issues/2572)

## [2.0.456] - 2024-06-15

- [Start Getting Started/Quick Start REPLs in a proper VS Code foldered window](https://github.com/BetterThanTomorrow/calva/issues/2566)

## [2.0.455] - 2024-06-08

- [Extend "Refresh Changed Namespaces" to accept optional parameters exposed by cider-nrepl](https://github.com/BetterThanTomorrow/calva/issues/2556)

## [2.0.454] - 2024-06-03

- Fix: [HTML->Hiccup fails on style attribute strings where the entries do not have whitespace](https://github.com/BetterThanTomorrow/calva/issues/2561)

## [2.0.453] - 2024-06-03

- Bump deps.clj to v1.11.3.1463
- [jack-in support for the Basilisp Clojure compatible dialect impelmented in Python](https://github.com/BetterThanTomorrow/calva/issues/2559)

## [2.0.452] - 2024-05-03

- [Make the commands for opening output destinations accept arguments](https://github.com/BetterThanTomorrow/calva/issues/2547)

## [2.0.451] - 2024-04-30

- Fix: [REPL History commands do not work in a cleared window](https://github.com/BetterThanTomorrow/calva/issues/2545)

## [2.0.450] - 2024-04-27

- [Create jack-in subshell the unix way on non-Windows](https://github.com/BetterThanTomorrow/calva/issues/2543)

## [2.0.449] - 2024-04-26

- Fix: [The evaluated expression is printed twice to the REPL window with `evaluationSendCodeToOutputWindow` enabled](https://github.com/BetterThanTomorrow/calva/issues/2538)

## [2.0.448] - 2024-04-25

- Fix: [Replace Current Form with Pretty Printed Form also sorts map entries alphabetically by key](https://github.com/BetterThanTomorrow/calva/issues/2533)

## [2.0.447] - 2024-04-24

- [Make the inspector sort maps on the keys](https://github.com/BetterThanTomorrow/calva/issues/2534)
- Fix: [The inspector fails to crate an inspectable tree on large results](https://github.com/BetterThanTomorrow/calva/issues/2535)

## [2.0.446] - 2024-04-21

- [Re-indent text when copied from the inspector as well as tooltips](https://github.com/BetterThanTomorrow/calva/issues/2524)

## [2.0.445] - 2024-04-21

- [Make list items in the inspector get a bit easier to read](https://github.com/BetterThanTomorrow/calva/issues/2521)
- Fix: [Deleting the last form in document throws an error](https://github.com/BetterThanTomorrow/calva/issues/2523)
- Workaround: [Default to `indentation` folding strategy to dodge clojure-lsp bug](https://github.com/BetterThanTomorrow/calva/issues/2486)
- [Add opt-in setting to rainbow colorize the collection types in the inspector](https://github.com/BetterThanTomorrow/calva/issues/2527)

## [2.0.444] - 2024-04-19

- [Make the inspector item context commands work on the selected item when not invoked via the buttons](https://github.com/BetterThanTomorrow/calva/issues/2519)

## [2.0.443] - 2024-04-18

- Fix: [Replace Current Form seems to stop working from v2.0.428 onwards](https://github.com/BetterThanTomorrow/calva/issues/2512)

## [2.0.442] - 2024-04-17

- Fix: [Extra empty lines printed between lines of stderr from out-of-band nrepl messages](https://github.com/BetterThanTomorrow/calva/issues/2514)
- [Add source info in tooltip of inspector items](https://github.com/BetterThanTomorrow/calva/issues/2516)

## [2.0.441] - 2024-04-17

- Refactor naming of inspector items (mostly internal, but also renames some command ids)

## [2.0.440] - 2024-04-17

- [Make exploring complex results convenient - inspiration: the CIDER Inspector](https://github.com/BetterThanTomorrow/calva/issues/1717)
- [Support command binding args to toggle multicursor per command or toggle copy per kill command. Closes #2485](https://github.com/BetterThanTomorrow/calva/issues/2485)

## [2.0.439] - 2024-04-11

- Fix: [Refresh Changed Namespaces do not output to the selected output destination](https://github.com/BetterThanTomorrow/calva/issues/2506)

## [2.0.438] - 2024-04-11

- Fix regression: [Version `2.0.437` introduces a jarring, and wrongful, reindent when typing closing brackets](https://github.com/BetterThanTomorrow/calva/issues/2509)

## [2.0.437] - 2024-04-11

- Retire experimental setting for strict prevent unmatched closing bracket. Close: [Unexpected cursor movement when using 'Strict Prevent Unmatched Closing Brackets'](https://github.com/BetterThanTomorrow/calva/issues/2500)
- [Update default Jack-in nrepl dependencies](https://github.com/BetterThanTomorrow/calva/issues/2503), nrepl 1.1.1, cider-nrepl 0.47.1
- Fix: [Throws error when debugging atoms](https://github.com/BetterThanTomorrow/calva/issues/2501)

## [2.0.436] - 2024-04-08

- [Make the debugger present structural variables as traversable structures](https://github.com/BetterThanTomorrow/calva/issues/2494)
- Fix: [The Clojure lexer fails on readertags with underscores in them](https://github.com/BetterThanTomorrow/calva/issues/2497)
- Fix: [Regression caused by #2409 for notebooks with uninitialized namespaces](https://github.com/BetterThanTomorrow/calva/issues/2498)

## [2.0.435] - 2024-04-03

- [The strict `;` (semi-colon) command comments out while protecting balance](https://github.com/BetterThanTomorrow/calva/issues/2490)

## [2.0.434] - 2024-04-03

- [Add opt-in strict mode for `;` (semi-colon)](https://github.com/BetterThanTomorrow/calva/issues/2488)

## [2.0.433] - 2024-04-01

- [Implement experimental support for multicursor rewrap commands](https://github.com/BetterThanTomorrow/calva/issues/2448). Enable `calva.paredit.multicursor` in your settings to try it out. Closes [#2473](https://github.com/BetterThanTomorrow/calva/issues/2473)
- [Add a separator line between evaluation outputs to the Output terminal](https://github.com/BetterThanTomorrow/calva/issues/2483)
- [Implement experimental support for multicursor selectCurrentForm command](https://github.com/BetterThanTomorrow/calva/issues/2476). Enable `calva.paredit.multicursor` in your settings to try it out. Closes [#2476](https://github.com/BetterThanTomorrow/calva/issues/2476)

## [2.0.432] - 2024-03-26

- Fix: [Extraneous newlines printed to terminal for some output](https://github.com/BetterThanTomorrow/calva/issues/2468)
- [Add legacy opt-in for printing bare `stdout` to the REPL Window](https://github.com/BetterThanTomorrow/calva/issues/2470)

## [2.0.431] - 2024-03-25

- Fix: [Using a shortcut to focus on Calva output terminal gives an error](https://github.com/BetterThanTomorrow/calva/issues/2461)
- Fix: [Re-create Repl Output Terminal after it has been closed.](https://github.com/BetterThanTomorrow/calva/issues/2463)

## [2.0.430] - 2024-03-24

- [Add opt-in setting for migrating the REPL Window file to the new project subpath](https://github.com/BetterThanTomorrow/calva/issues/2458)
- [Honor existing ANSI escape sequences in messages for terminal output destination](https://github.com/BetterThanTomorrow/calva/issues/2459)

## [2.0.429] - 2024-03-23

- [Add command for opening the Terminal output destination](https://github.com/BetterThanTomorrow/calva/issues/2455)

## [2.0.428] - 2024-03-23

- [Add a Terminal output destination option](https://github.com/BetterThanTomorrow/calva/issues/2452)

## [2.0.427] - 2024-03-23

- Fix: [Printing non-list Clojure results with code fencing gets verbose](https://github.com/BetterThanTomorrow/calva/issues/2450)
- Fix: [Changing outputDestinations to output-channel breaks **Load/Evaluate Current File and its Requires...**](https://github.com/BetterThanTomorrow/calva/issues/2444)

## [2.0.426] - 2024-03-22

- Fix: [Calva Load File Command Results in RangeError on certain machine](https://github.com/BetterThanTomorrow/calva/issues/2443)

## [2.0.425] - 2024-03-21

- [Add Paredit Kill Left equivalent to Kill Right](https://github.com/BetterThanTomorrow/calva/issues/2426)
- Fix: Certain `paredit.killRight` edges cases on Windows.

## [2.0.424] - 2024-03-17

- [Add command for revealing the **Calva says** output channel](https://github.com/BetterThanTomorrow/calva/issues/2436)
- Fix: [Results not shown inline when output-channel configured is configured as for results output](https://github.com/BetterThanTomorrow/calva/issues/2437)
- [Make the results hover aware of where the results output goes](https://github.com/BetterThanTomorrow/calva/issues/2438)

## [2.0.423] - 2024-03-17

- [Add Output Destinations configuration](https://github.com/BetterThanTomorrow/calva/issues/1104)

## [2.0.422] - 2024-03-11

- Bump deps.clj to `v1.11.2.1446`
- [Try to find namespace for notebook eval.](https://github.com/BetterThanTomorrow/calva/issues/2408)

## [2.0.421] - 2024-03-11

- Fix: [Slowness printing compiler errors and warnings to Output Window](https://github.com/BetterThanTomorrow/calva/issues/2291)

## [2.0.420] - 2024-03-10

- [Allow to use an array of strings for `afterCLJReplJackInCode` in a connect sequence](https://github.com/BetterThanTomorrow/calva/issues/2423)

## [2.0.419] - 2024-03-08

- [Automatically do Rename Symbol after refactors that add new names](https://github.com/BetterThanTomorrow/calva/issues/2388)

## [2.0.418] - 2024-03-08

- [Add selection to experimentally supported multicursor paredit commands](https://github.com/BetterThanTomorrow/calva/issues/2421). Enable `calva.paredit.multicursor` in your settings to try it out. Addressing [#610](https://github.com/BetterThanTomorrow/calva/issues/610)

## [2.0.417] - 2024-03-08

- [Implement experimental support for multicursor paredit movement commands](https://github.com/BetterThanTomorrow/calva/issues/2420). Enable `calva.paredit.multicursor` in your settings to try it out. Addressing [#610](https://github.com/BetterThanTomorrow/calva/issues/610)

## [2.0.416] - 2024-03-08

- Internal textNotation testing system supports multiple selections, addressing [#610](https://github.com/BetterThanTomorrow/calva/issues/610)
- Add new Calva development utility commands to create textNotations from open buffers, and vice versa

## [2.0.415] - 2024-03-08

- Refactor some internal document and selection APIs in preparation for multiple selections, addressing [#610](https://github.com/BetterThanTomorrow/calva/issues/610)
- [Add default Clojure associations for file extensions `.lpy`](https://github.com/BetterThanTomorrow/calva/issues/2415)
- [Document telemetry collection](https://github.com/BetterThanTomorrow/calva/issues/2428)

## [2.0.414] - 2024-02-24

- [HTML->Hiccup: Add option to always keep classes as attributes if so desired](https://github.com/BetterThanTomorrow/calva/issues/2398)
- [Support clojure-lsp Project Tree feature](https://github.com/BetterThanTomorrow/calva/issues/2406)

## [2.0.413] - 2024-02-20

- Fix: [Structure editor glitch - backspace is inhibited from removing `#`](https://github.com/BetterThanTomorrow/calva/issues/2327)
- Fix: ["Eval on save" causes files to be opened incorrectly](https://github.com/BetterThanTomorrow/calva/issues/2402)

## [2.0.412] - 2024-02-11

- [Support cider `complete` with completions returning `completion-doc`](https://github.com/BetterThanTomorrow/calva/issues/2395)

## [2.0.411] - 2024-02-09

- Fix: [No symbols visible in Clojure source file inside JAR](https://github.com/BetterThanTomorrow/calva/pull/2391)
- [Make window stay open if code is executed from it](https://github.com/BetterThanTomorrow/calva/pull/2389)

## [2.0.410] - 2024-02-08

- [HTML->Hiccup: Keep id and classes as attributes if they do not form valid hiccup keywords](https://github.com/BetterThanTomorrow/calva/issues/2390)

## [2.0.409] - 2024-01-22

- Fix: [Formatter problem with multi-line strings](https://github.com/BetterThanTomorrow/calva/pull/2270)

## [2.0.408] - 2024-01-10

- [Make REPL-button menu remember last item selected](https://github.com/BetterThanTomorrow/calva/issues/2382)
- More Calva commands (especially related to connect and jack-in) are now awaitable

## [2.0.407] - 2024-01-09

- [Offer to connect when evaluating forms while disconnected](https://github.com/BetterThanTomorrow/calva/issues/1490)
- Bump `follow-redirects` to 1.15.4 (audit report)
- Bump deps.clj version: v1.11.1.1435

## [2.0.406] - 2024-01-08

- Calva development: Fix: [Fiddle-file-unit-tests fails on windows](https://github.com/BetterThanTomorrow/calva/issues/2378)
- Calva development: Fix: [Developer format job forces LF line endings](https://github.com/BetterThanTomorrow/calva/issues/2376)

## [2.0.405] - 2023-12-21

- Fix: [RangeError when opening .glft files ](https://github.com/BetterThanTomorrow/calva/issues/2319)

## [2.0.404] - 2023-12-20

- Fix: [Require REPL Utilities only works for `user` namespace](https://github.com/BetterThanTomorrow/calva/issues/433)
- Fix: [NullPointerException evaluating calva.autoEvaluateCode.onConnect.cljs when using Krell](https://github.com/BetterThanTomorrow/calva/issues/2372)

## [2.0.403] - 2023-12-18

- Bump deps.clj version: v1.11.1.1429
- Fix: [Indenter treating symbols as regex](https://github.com/BetterThanTomorrow/calva/issues/2263)

## [2.0.402] - 2023-12-15

- Fix audit warnings, bump some deps, clean out some deps
- [Update to cljfmt v0.12.0](https://github.com/BetterThanTomorrow/calva/issues/2365)
- Fix: [Selecting words forward and backwards when in line comments selects to next sexpression](https://github.com/BetterThanTomorrow/calva/issues/2368)

## [2.0.401] - 2023-12-03

- Fix: [Some nREPL `eval` messages are sent with `untitled` as `ns`](https://github.com/BetterThanTomorrow/calva/issues/2358)
- Fix: [The `repl.evaluateCode` API does not provide a way to supply the `ns` param](https://github.com/BetterThanTomorrow/calva/issues/2359)
- [Introduce Calva API `.v1`](https://github.com/BetterThanTomorrow/calva/issues/2359)
- [Provide access to the current namespace form info via Calva API](https://github.com/BetterThanTomorrow/calva/issues/2360)

## [2.0.400] - 2023-11-23

- Fix: [Error responses wait for stacktrace before printing to repl output](https://github.com/BetterThanTomorrow/calva/issues/2355)

## [2.0.399] - 2023-11-20

- Fix: [The Jack-in/Connect Project Type menu is not always fully populated on first use](https://github.com/BetterThanTomorrow/calva/issues/2334)

## [2.0.398] - 2023-11-19

- Fix: [Connecting to an external REPL does not work when local nrepl port exists](https://github.com/BetterThanTomorrow/calva/issues/2303)
- [Avoid formatting when breaking up line comments](https://github.com/BetterThanTomorrow/calva/issues/2296)
- Fix: [The Jack-in/Connect Project Type menu is not always fully populated on first use](https://github.com/BetterThanTomorrow/calva/issues/2334)

## [2.0.397] - 2023-11-17

- Fix: [Standalone connect of shadow-cljs repl fails in some projects](https://github.com/BetterThanTomorrow/calva/issues/2349)

## [2.0.396] - 2023-11-13

- Fix: [Docstring tooltip not shown while connected to REPL](https://github.com/BetterThanTomorrow/calva/issues/2345)

## [2.0.395] - 2023-11-12

- [Make Calva's nrepl client squint-cljs compatible](https://github.com/BetterThanTomorrow/calva/issues/2343)

## [2.0.394] - 2023-11-06

- Fix: [Calva shows two hover definitions for user-defined vars when a repl is connected](https://github.com/BetterThanTomorrow/calva/issues/2091)

## [2.0.393] - 2023-11-05

- Fix: [Namespace alias shadows local variables](https://github.com/BetterThanTomorrow/calva/issues/2336)
- Fix: [Definition lookup in dependency files is broken](https://github.com/BetterThanTomorrow/calva/issues/2339)

## [2.0.392] - 2023-10-22

- Bump bundled deps.clj to v1.11.1.1413
- Add timestamps to nREPL message log diagnostics
- Fix: [Backspace (structural editing) occasionally hangs](https://github.com/BetterThanTomorrow/calva/issues/2299)

## [2.0.391] - 2023-10-12

- Fix: [[Windows] The ClojureScript Quick Start REPL Experiences are broken](https://github.com/BetterThanTomorrow/calva/issues/2325)

## [2.0.390] - 2023-10-11

- Fix: [Reconnecting a repl while connected fails](https://github.com/BetterThanTomorrow/calva/issues/2301)

## [2.0.389] - 2023-10-06

- Fix: [Command to run tests for namespace uses user and user-test namespaces when cursor is in ns form](https://github.com/BetterThanTomorrow/calva/issues/2309)

## [2.0.388] - 2023-08-31

- Fix: [stdout from sub threads is not printed in the terminal](https://github.com/BetterThanTomorrow/calva/issues/2300)
- Fix: [The command `calva.showOutputWindow` is not awaitable](https://github.com/BetterThanTomorrow/calva/issues/2305)

## [2.0.387] - 2023-08-20

- Fix: [Evaluating a non-list top level form from inside a form evaluates the wrong form when in a rich comment](https://github.com/BetterThanTomorrow/calva/issues/2290)
- Fix: [Difference between regular formatting and formatting with alignment](https://github.com/BetterThanTomorrow/calva/issues/2289)

## [2.0.386] - 2023-08-17

- Fix: [Failing to download clojure-lsp server on Windows](https://github.com/BetterThanTomorrow/calva/issues/2287)

## [2.0.385] - 2023-08-15

- Fix: [Can't override default cljfmt config since 2.0.383](https://github.com/BetterThanTomorrow/calva/issues/2284)
- Fix: [Update the indenter to handle the cljfmt `0.11.x` breaking config update since version 2.0.383](https://github.com/BetterThanTomorrow/calva/issues/2280)
- Bump bundled deps.clj to v1.11.1.1403

## [2.0.384] - 2023-08-14

- [Improve clojure-lsp download error handling](https://github.com/BetterThanTomorrow/calva/issues/2278)

## [2.0.383] - 2023-08-12

- [Use latest `cljfmt` (`0.11.2`)](https://github.com/BetterThanTomorrow/calva/issues/2274)

## [2.0.382] - 2023-07-30

- Fix: [Calva can't seem to parse a ns form with metadata after 2.0.376](https://github.com/BetterThanTomorrow/calva/issues/2266)

## [2.0.381] - 2023-07-19

- Fix: [There are som nREPL messages missing from the diagnostics log](https://github.com/BetterThanTomorrow/calva/issues/2261)
- [Make it easier to find information about how to use shadow-cljs](https://github.com/BetterThanTomorrow/calva/issues/2262)
- [Make Lingy files (`.ly`) Clojure associated by default](https://github.com/BetterThanTomorrow/calva/issues/2259)
- Fix [Add link to default cljfmt config files](https://github.com/BetterThanTomorrow/calva/issues/2252)

## [2.0.380] - 2023-07-16

- Fix: [Calva structural editing fails if cljfmt parsing fails](https://github.com/BetterThanTomorrow/calva/issues/2248)

## [2.0.379] - 2023-07-15

- Fix: [shadow-cljs jack-in with cljAliases fails on Windows](https://github.com/BetterThanTomorrow/calva/issues/2239)
- Fix: [deps.edn + shadow-cljs jack-in fails, when connect sequence builds are not keywords](https://github.com/BetterThanTomorrow/calva/issues/2242)

## [2.0.378] - 2023-07-13

- Fix: [Rich comments broken by 2.0.377](https://github.com/BetterThanTomorrow/calva/issues/2249)

## [2.0.377] - 2023-07-13

- [Support `in-ns` forms to provide the ns for evaluations, and use the closest `ns/in-ns` before the cursor](https://github.com/BetterThanTomorrow/calva/issues/2245)

## [2.0.376] - 2023-07-12

- [Add “Fiddle” files Support](https://github.com/BetterThanTomorrow/calva/issues/2199)

## [2.0.375] - 2023-07-11

- [If calva.fmt.configPath not set, look in default config locations](https://github.com/BetterThanTomorrow/calva/issues/2243)

## [2.0.374] - 2023-06-29

- Fix: [Pasting text with leading whitespace increases the leading whitespace](https://github.com/BetterThanTomorrow/calva/issues/2236)

## [2.0.373] - 2023-06-27

- [Re-indent non-complete code, when pasting or formatting selection](https://github.com/BetterThanTomorrow/calva/issues/1709)
- Fix: [Selection, closing brackets, fails in mysterious ways](https://github.com/BetterThanTomorrow/calva/issues/2232)

## [2.0.372] - 2023-06-23

- Fix: [Trailing space is removed unconditionally from pasted text](https://github.com/BetterThanTomorrow/calva/issues/2229)

## [2.0.371] - 2023-06-17

- [Improve Jack-in Ux around deps.edn aliases with :main-opts](https://github.com/BetterThanTomorrow/calva/issues/2223)
- [Merge user and workspace Custom Connect Sequences](https://github.com/BetterThanTomorrow/calva/issues/2225)

## [2.0.370] - 2023-06-15

- Fix: [Trailing whitespace not being stripped](https://github.com/BetterThanTomorrow/calva/issues/1258)
- Bump bundled deps.clj to v1.11.1.1347
- Fix: [Jack-in error when selecting multiple shadow-cljs builds](https://github.com/BetterThanTomorrow/calva/issues/2220)

## [2.0.369] - 2023-06-02

- Breaking configuration change: [Change from dashes to underscores for `customJackInCommandLine` env variables](https://github.com/BetterThanTomorrow/calva/issues/2215)

## [2.0.368] - 2023-06-02

- [Add back warning when clj-kondo extension is detected](https://github.com/BetterThanTomorrow/calva/issues/1882)

## [2.0.367] - 2023-06-01

- [Grow selection considers ”form pairs” in bindings](https://github.com/BetterThanTomorrow/calva/issues/2033)

## [2.0.366] - 2023-06-01

- [Add a `$selection-closing-brackets` custom REPL snippets variable](https://github.com/BetterThanTomorrow/calva/issues/2212)

## [2.0.365] - 2023-05-31

- [Stop Run All in Clojure Notebooks from evaluating `comment` forms](https://github.com/BetterThanTomorrow/calva/issues/2210)

## [2.0.364] - 2023-05-26

- [Enable Custom REPL Commands in non-Clojure files](https://github.com/BetterThanTomorrow/calva/issues/2208)

## [2.0.363] - 2023-05-21

- Fix: [Regression in connecting to ClojureScript REPLs without builds with 2.0.362](https://github.com/BetterThanTomorrow/calva/issues/2202)

## [2.0.362] - 2023-05-21

- Bump bundled deps.clj to v1.11.1.1273-4
- Fix regression: [Cannot start a shadow-cljs REPL with non-keyword build id:s since version 2.0.355](https://github.com/BetterThanTomorrow/calva/issues/2200)

## [2.0.361] - 2023-05-16

- Fix regression: [2.0.359 broke custom REPL connect sequences](https://github.com/BetterThanTomorrow/calva/issues/2197)

## [2.0.360] - 2023-05-16

- Fix: [.cljr files not treated as Clojure by default](https://github.com/BetterThanTomorrow/calva/issues/2194)

## [2.0.359] - 2023-05-13

- [Support custom connect sequences that are not based on built in types](https://github.com/BetterThanTomorrow/calva/issues/2192)
- Fix: [autoSelectForJackIn makes the jack-in fail on Windows](https://github.com/BetterThanTomorrow/calva/issues/2190)
- Remove configuration and handling of `calva.autoSelectReplConnectProjectType` (replaced by connect sequence settings)

## [2.0.358] - 2023-05-08

- [Escape backslashes in $file in customREPLCommands on windows](https://github.com/BetterThanTomorrow/calva/issues/2184)

## [2.0.357] - 2023-05-08

- Fix: [Extension manifest misconfiguration, `autoEvaluateCode` nests `onFileEvaluated` inside `onConnect`](https://github.com/BetterThanTomorrow/calva/issues/2182)

## [2.0.356] - 2023-05-07

- [Make the shadow-cljs connect process wait for a running CLJS REPL server](https://github.com/BetterThanTomorrow/calva/issues/1027)

## [2.0.355] - 2023-05-04

- Fix: [REPL connect fails if requiring clojure.main/repl-requires fails](https://github.com/BetterThanTomorrow/calva/issues/2178)
- Calva development: Only log app start with plausible.io

## [2.0.354] - 2023-05-03

- Fix: [”Resolve macro as” menu buttons are unreadable](https://github.com/BetterThanTomorrow/calva/issues/2156)
- Calva development: Add [Plausible](https://plausible.io) analytics, intended to replace Google Analytics

## [2.0.353] - 2023-04-17

- Fix: [With `autoSelectForJackIn` is true, Calva drops its `:main-opts` guard](https://github.com/BetterThanTomorrow/calva/issues/2161)

## [2.0.352] - 2023-04-16

- [Add custom Jack-in command lines to connect sequences](https://github.com/BetterThanTomorrow/calva/issues/2152)
- [Add docs about main-opts and make the warning link there](https://github.com/BetterThanTomorrow/calva/issues/2157)

## [2.0.351] - 2023-04-12

- [Auto-refer `repl-requires` as part of connecting (or always)](https://github.com/BetterThanTomorrow/calva/issues/2154)
- Bump bundled deps.clj to v1.11.1.1273

## [2.0.350] - 2023-04-10

- [Include a change directory command with the jack-in command line](https://github.com/BetterThanTomorrow/calva/issues/2147)

## [2.0.349] - 2023-04-09

- Fix: [Indenter and formatter do not agree on some simple forms (and the formatter is right)](https://github.com/BetterThanTomorrow/calva/issues/2148)

## [2.0.348] - 2023-04-06

- Fix: [The nrepl client fails to look up definition on quoted symbols](https://github.com/BetterThanTomorrow/calva/issues/2144)

## [2.0.347] - 2023-04-04

- [Evaluate Rich Commment forms as top-level when the RCF is nested in other lists](https://github.com/BetterThanTomorrow/calva/issues/2109)

## [2.0.346] - 2023-04-04

- [Add a generic `clojure-lsp.command` for binding to keyboard shortcuts with arguments](https://github.com/BetterThanTomorrow/calva/issues/2139)

## [2.0.345] - 2023-04-03

- Bump bundled deps.clj to v1.11.1.1267
- [Rewrap to and from sets (`#{}`)](https://github.com/BetterThanTomorrow/calva/issues/2137)

## [2.0.344] - 2023-03-29

- [Calva Notebook nrepl integration flag](https://github.com/BetterThanTomorrow/calva/issues/2133)

## [2.0.343] - 2023-03-25

- Fix: [HTML to Hiccup conversion doesn't consider user settings when used from ”Copy As” menus](https://github.com/BetterThanTomorrow/calva/issues/2130)

## [2.0.342] - 2023-03-25

- [Add command for copying text as Hiccup](https://github.com/BetterThanTomorrow/calva/issues/2128)
- Fix: [HTML to Hiccup conversion trips a bit on classes separated by more than one space](https://github.com/BetterThanTomorrow/calva/issues/2126)
- Fix: [HTML to Hiccup conversion keeps surrounding whitespace for text content](https://github.com/BetterThanTomorrow/calva/issues/2127)

## [2.0.341] - 2023-03-23

- [Add commands `calva.convertHtml2Hiccup` and `calva.pasteHtmlAsHiccup`](https://github.com/BetterThanTomorrow/calva/issues/407)

## [2.0.340] - 2023-03-18

- Workaround: [LiveShare participants incorrectly opening every Clojure file as if via "Open with Notebook"](https://github.com/BetterThanTomorrow/calva/issues/1850)

## [2.0.339] - 2023-03-16

- Fix: [Stopping Jacked-in REPL process doesn't kill Unix Java process](https://github.com/BetterThanTomorrow/calva/issues/2116)
- Fix: [Formatting inside top level forms broken](https://github.com/BetterThanTomorrow/calva/issues/2114)
- Bump bundled deps.clj to v1.11.1.1257

## [2.0.338] - 2023-03-15

- Fix: [Jack-in fails with version 2.0.337](https://github.com/BetterThanTomorrow/calva/issues/2113)

## [2.0.337] - 2023-03-15

- [Provide option for "Restart the REPL" in REPL status bar menu](https://github.com/BetterThanTomorrow/calva/issues/2104)
- [Provide option for "Interrupt Running Evaluations" in REPL status bar menu](https://github.com/BetterThanTomorrow/calva/issues/2103)
- [Make "Interrupting Running Evaluations” more visible, and documented](https://github.com/BetterThanTomorrow/calva/issues/2068)
- [Add a command for stopping the the Jack-in REPL (a.k.a. Jack-out)](https://github.com/BetterThanTomorrow/calva/issues/2105) (duplicate of [#1286](https://github.com/BetterThanTomorrow/calva/issues/2105))
- [Improve the output in the jack-in terminal when the jack-in process is killed](https://github.com/BetterThanTomorrow/calva/issues/1394)
- Fix: [Tab to reindent should pull the start of a top level expression to the left margin](https://github.com/BetterThanTomorrow/calva/issues/2096)
- Fix: [Backspace behaves weirdly when removing indent from top level form](https://github.com/BetterThanTomorrow/calva/issues/2108)
- [Remove configuration for hiding the REPL UI](https://github.com/BetterThanTomorrow/calva/issues/2106)

## [2.0.336] - 2023-03-12

- [Move auto-selecting project type config to Connect Sequences](https://github.com/BetterThanTomorrow/calva/issues/2094)
- [Add option for auto-selection project root](https://github.com/BetterThanTomorrow/calva/issues/2094)
- [Select connect host:port automatically from port file, without prompting](https://github.com/BetterThanTomorrow/calva/issues/2101)
- [Make REPL `connect` command accept host and port](https://github.com/BetterThanTomorrow/calva/issues/1984)
- [Add configuration for automatically connecting to a running REPL](https://github.com/BetterThanTomorrow/calva/issues/1908)
- Fix: [Calva does not gracefully handle when clojure-lsp cannot be downloaded](https://github.com/BetterThanTomorrow/calva/issues/2064)
- Bump bundled deps.clj to v1.11.1.1252

## [2.0.335] - 2023-02-25

- Reintroducing features in v2.0.333, except the fallback clojure-lsp server, see #2090 for details
- Fix: [Monorepo setup working on v2.0.333, broken on v2.0.334](https://github.com/BetterThanTomorrow/calva/issues/2088)
- Fix: [Calva v2.0.333 has startup and repl issues on Windows](https://github.com/BetterThanTomorrow/calva/issues/2087)

## [2.0.334] - 2023-02-22

- Rollback of 2.0.333, first part of: [Calva v2.0.333 is not working for me in VSCode Insiders on Windows 11](https://github.com/BetterThanTomorrow/calva/issues/2087)

## [2.0.333] - 2023-02-21

- Fix: [Multiple LSP processes automatically running, broken LSP features in multi-root workspaces](https://github.com/BetterThanTomorrow/calva/issues/2065)
- Fix: [Default clojure-lsp startup behaviour is changed since v2.0.327](https://github.com/BetterThanTomorrow/calva/issues/2084)
- Fix: [clojure-lsp does not start in a workspace without project files](https://github.com/BetterThanTomorrow/calva/issues/2069)

## [2.0.332] - 2023-02-15

- Partly fixes: [Cursor moves back to start of indented line when typing inside parens on a new line](https://github.com/BetterThanTomorrow/calva/issues/2071)
- [Establish REPL connection without being prompted for the kind of project every time](https://github.com/BetterThanTomorrow/calva/issues/2049)
- Bump bundled deps.clj to v1.11.1.1224
- Fix: [Sometimes unable to load a file in repl while debugging an extension](https://github.com/BetterThanTomorrow/calva/issues/2081)

## [2.0.331] - 2023-02-05

- Bump npm deps [jszip](https://github.com/BetterThanTomorrow/calva/pull/2056), [http-cache-semantics](https://github.com/BetterThanTomorrow/calva/pull/2059)
- Fix: [Indenter and formatter do not agree on keyword in function position when regex indent rules are involved](https://github.com/BetterThanTomorrow/calva/issues/2044)
- Fix: [Missing required argument for "-M ALIASES"](https://github.com/BetterThanTomorrow/calva/issues/2039)

## [2.0.330] - 2023-02-03

- Fix: [Clojure-lsp does not automatically start when using VSCode on Windows in Calva version 2.0.329](https://github.com/BetterThanTomorrow/calva/issues/2054)
- Calva development: [Make e2e test runner re-usable](https://github.com/BetterThanTomorrow/calva/issues/2058)

## [2.0.329] - 2023-02-01

- [Sort aliases for deps.edn projects](https://github.com/BetterThanTomorrow/calva/issues/2035)
- [Sort pre-selected project at the top in REPL connect menu](https://github.com/BetterThanTomorrow/calva/issues/2043)
- Fix: [Indenter and formatter not in agreement about some forms](https://github.com/BetterThanTomorrow/calva/issues/2032)
- Fix: [Regressions introduced with clojure-lsp multi-project support in 2.0.327](https://github.com/BetterThanTomorrow/calva/issues/2041)
- Fix: [Can't use add require feature after updating to 2.0.327 version](https://github.com/BetterThanTomorrow/calva/issues/2040)
- Fix: [Formatting issues on backspace](https://github.com/BetterThanTomorrow/calva/issues/2038)
- Calva development: [Test the built VSIX extension in CI](https://github.com/BetterThanTomorrow/calva/issues/2051)
- Calva development, Fix: [We build Calva twice in CI](https://github.com/BetterThanTomorrow/calva/issues/2052)

## [2.0.328] - 2023-01-27

- Rollback of 2.0.327, first part of: [Regressions introduced with clojure-lsp multi-project support in 2.0.327](https://github.com/BetterThanTomorrow/calva/issues/2041)

## [2.0.327] - 2023-01-27

- [LSP support for multi-project and multi-workspace](https://github.com/BetterThanTomorrow/calva/pull/2020)
- Fix: [Clojure-lsp caching in multi-project workspace](https://github.com/BetterThanTomorrow/calva/issues/934)
- Fix: [With multi-root workspaces the clojure-lsp project root is always the first folder](https://github.com/BetterThanTomorrow/calva/issues/1706)
- Fix: [Getting Started REPLs download config from dram dev branch](https://github.com/BetterThanTomorrow/calva/issues/1977)

## [2.0.326] - 2023-01-24

- Fix: [`afterCLJReplJackInCode` fails if no editor is open](https://github.com/BetterThanTomorrow/calva/issues/2025)
- Fix: [shadow-cljs jack-in silently fails when no builds are selected](https://github.com/BetterThanTomorrow/calva/issues/2022)

## [2.0.325] - 2023-01-21

- Fix: [Setting calva.testOnSave broken: no tests found](https://github.com/BetterThanTomorrow/calva/issues/2005)

## [2.0.324] - 2023-01-15

- Fix: [Evaluating blocking snippets deadlocks the editor](https://github.com/BetterThanTomorrow/calva/issues/2012)
- Fix (formatter): [Indenter and formatter fails while typing out body of deftype method](https://github.com/BetterThanTomorrow/calva/issues/1957)
- Fix: [Inconsistent formatting of defprotocol with docstring on separate line from method declaration](https://github.com/BetterThanTomorrow/calva/issues/1978)

## [2.0.323] - 2023-01-07

- Fix: [Provider completions not handling errors gracefully](https://github.com/BetterThanTomorrow/calva/issues/2006)
- Partly fix (indenter): [Indenter and formatter fails while typing out body of deftype method](https://github.com/BetterThanTomorrow/calva/issues/1957)

## [2.0.322] - 2022-12-14

- Fix: [Clojure notebooks don't seem to work on MS-Windows](https://github.com/BetterThanTomorrow/calva/issues/1994)
- Fix: [Calva development: npm run prettier-format fails on MS-Windows](https://github.com/BetterThanTomorrow/calva/issues/1996)
- Bump bundled deps.clj to v1.11.1.1208

## [2.0.321] - 2022-12-05

- Fix: [Supplying a custom printFn to the pretty printer does not work](https://github.com/BetterThanTomorrow/calva/issues/1979)
- Fix: [CI: Webpack build throws with an error: [webpack-cli] Error: error:0308010C:digital envelope routines::unsupported](https://github.com/BetterThanTomorrow/calva/issues/1985)
- Fix: [Running a single test runs all tests](https://github.com/BetterThanTomorrow/calva/issues/1981)
- [Update Calva docs to no longer mention removed clojure-lsp setting](https://github.com/BetterThanTomorrow/calva/issues/1988)

## [2.0.320] - 2022-11-23

- [Stop the nrepl client from spamming the server with ops it doesn't support](https://github.com/BetterThanTomorrow/calva/issues/1969)
- Bump bundled deps.clj to v1.11.1.1200

## [2.0.319] - 2022-11-10

- Fix: [The indenter fails matching cljfmt rules on qualified symbols](https://github.com/BetterThanTomorrow/calva/issues/1956)
- [Add info about cider-nrepl docs to calva.io/connect](https://github.com/BetterThanTomorrow/calva/issues/1955)
- [Inform about Calva version on startup](https://github.com/BetterThanTomorrow/calva/issues/1954)
- Fix: [Calva docs site theme color not used](https://github.com/BetterThanTomorrow/calva/issues/1960)

## [2.0.318] - 2022-11-08

- Fix: [Calva doesn't show action buttons in error message boxes](https://github.com/BetterThanTomorrow/calva/issues/1949)
- Fix: [The snippets file is not included in the Calva extension VSIX](https://github.com/BetterThanTomorrow/calva/issues/1953)

## [2.0.317] - 2022-11-06

- [Make Calva more VIM friendly](https://github.com/BetterThanTomorrow/calva/issues/1947)
- [Remove `calva.fmt.formatAsYouType` setting](https://github.com/BetterThanTomorrow/calva/issues/1827)

## [2.0.316] - 2022-11-05

- Bundle deps.clj.jar v1.11.1.1189
- [Honor pretty-print settings for load-file](https://github.com/BetterThanTomorrow/calva/issues/1905)
- [Add editor snippet for Rich Comments marked with trailing `:rcf`](https://github.com/BetterThanTomorrow/calva/issues/1941)
- [Add custom REPL command snippet `$current-pair` variable](https://github.com/BetterThanTomorrow/calva/issues/1943)
- [Add custom REPL command snippet `$file-text` variable](https://github.com/BetterThanTomorrow/calva/issues/1944)

## [2.0.315] - 2022-11-03

- [Inform if Calva nREPL dependencies are not fulfilled](https://github.com/BetterThanTomorrow/calva/issues/1935)
- Fix: [Calva does not fall back on lsp definitions when nrepl definitions fail](https://github.com/BetterThanTomorrow/calva/issues/1933)
- Fix: [Warnings printed with an added `;` on a line of its own](https://github.com/BetterThanTomorrow/calva/issues/1930)
- Fix: [Extra newlines are printed in output from function called from test](https://github.com/BetterThanTomorrow/calva/issues/1937)

## [2.0.314] - 2022-11-01

- [Squash spaces when Paredit Kill/Delete Right](https://github.com/BetterThanTomorrow/calva/issues/1923)
- Fix: [Newline lacking before results when evaluating at the REPL prompt](https://github.com/BetterThanTomorrow/calva/issues/1931)

## [2.0.313] - 2022-10-31

- [Use format-as-you-type for Paredit](https://github.com/BetterThanTomorrow/calva/issues/1924)
- Fix: [Newline missing in some prints to Output/REPL window](https://github.com/BetterThanTomorrow/calva/issues/1927)

## [2.0.312] - 2022-10-30

- Fix: [Unwanted newlines are added to REPL output of Kaocha test run](https://github.com/BetterThanTomorrow/calva/issues/1826)
- Fix: [Unexpected newline character in the output](https://github.com/BetterThanTomorrow/calva/issues/998)

## [2.0.311] - 2022-10-27

- Fix: [Drag sexps in value part of doseq sometimes jumps 2 sexps instead of 1](https://github.com/BetterThanTomorrow/calva/issues/1914)
- Fix: [Can't do formatting code from Calva: Fire up the Getting Started REPL on hello_repl.clj](https://github.com/BetterThanTomorrow/calva/issues/1918)
- Fix: [Calva: Open REPL snippets User config.edn couldn't create the file if parent folders doesn't exist](https://github.com/BetterThanTomorrow/calva/issues/1916)
- Calva development: [Use requirements.txt in CI for publishing docs](https://github.com/BetterThanTomorrow/calva/issues/1913)
- Bump deps.clj to v1.11.1.1182

## [2.0.310] - 2022-10-24

- Calva development: [Refactor `extension.ts` for less boilerplate and improved readability](https://github.com/BetterThanTomorrow/calva/issues/1906)
- Calva development, Fix: [Docs publishing in CI is failing](https://github.com/BetterThanTomorrow/calva/issues/1909)
- Calva development, Fix: [Grammar tests fail too often](https://github.com/BetterThanTomorrow/calva/issues/1910)

## [2.0.309] - 2022-10-22

- Fix: [Jack-in as live share guest not working](https://github.com/BetterThanTomorrow/calva/issues/1625)
- [Filter out code action errors](https://github.com/BetterThanTomorrow/calva/pull/1904), addressing [this issue](https://github.com/BetterThanTomorrow/calva/issues/1889)

## [2.0.308] - 2022-10-19

- [A more flexible evaluate-to-cursor command](https://github.com/BetterThanTomorrow/calva/issues/1901)
- [Test runner does not show stacktrace on error](https://github.com/BetterThanTomorrow/calva/issues/424)

## [2.0.307] - 2022-10-11

- [Support user level `~/.config/calva/config.edn`](https://github.com/BetterThanTomorrow/calva/issues/1887)

## [2.0.306] - 2022-10-09

- [Allow Clojure code in `.calva/config.edn` repl and hover snippets](https://github.com/BetterThanTomorrow/calva/issues/1885)

## [2.0.305] - 2022-09-30

- [Make it easier to find the clojure-lsp server trace log level](https://github.com/BetterThanTomorrow/calva/issues/1876)
- [Bump cljfmt dependency to `v0.9.0`](https://github.com/BetterThanTomorrow/calva/issues/1878)
- Fix: [Not honoring `calva.evalOnSave` when `calva.testOnSave` is enabled](https://github.com/BetterThanTomorrow/calva/issues/1880)
- Bump pre-bundled deps.clj.jar to `v1.11.1.1165`

## [2.0.304] - 2022-09-20

- [Keep deps.clj updated](https://github.com/BetterThanTomorrow/calva/issues/1871)

## [2.0.303] - 2022-09-18

- Fix: [Download of clojure-lsp nightly build fails on Apple M1/M2](https://github.com/BetterThanTomorrow/calva/issues/1869)

## [2.0.302] - 2022-09-18

- [Show error message if loading file results in an error](https://github.com/BetterThanTomorrow/calva/issues/1767)
- Document workaround for: [Allow sending a different project-root-uri during LSP initialize request](https://github.com/BetterThanTomorrow/calva/issues/1866)

## [2.0.301] - 2022-09-16

- Fix test running issue: [Two references to the same class in the same namespace can refer to two different instances of the class](https://github.com/BetterThanTomorrow/calva/issues/1821)
- [Make it possible to format Clojure code using the pretty printer](https://github.com/BetterThanTomorrow/calva/issues/1843)

## [2.0.300] - 2022-09-11

- Fix: [Notebooks don't recognize rich comments at the end](https://github.com/BetterThanTomorrow/calva/issues/1857)
- [Make Calva `deps.edn` Jack-in smarter about if an alias has empty `:main-opts`](https://github.com/BetterThanTomorrow/calva/issues/1859)

## [2.0.299] - 2022-09-06

- [Bind any keys to custom custom repl commands](https://github.com/BetterThanTomorrow/calva/issues/1853)
- Fix: [Inline evaluation results not visible in Light themes](https://github.com/BetterThanTomorrow/calva/issues/1855)

## [2.0.298] - 2022-08-31

- [Check if `clojure` is installed and working before selecting default `deps.edn` Jack-in](https://github.com/BetterThanTomorrow/calva/issues/1848)

## [2.0.297] - 2022-08-29

- Update deps.clj to version 0.1.1155

## [2.0.296] - 2022-08-29

- [Rich comment handling in notebooks](https://github.com/BetterThanTomorrow/calva/issues/1845)
- [Default to use deps.clj instead of clojure for starting deps.edn projects](https://github.com/BetterThanTomorrow/calva/issues/1846)
- Update deps.clj to version 0.1.1100

## [2.0.295] - 2022-08-28

- Fix: [Leiningen and deps.edn projects with shadow-cljs is too hard to connect to](https://github.com/BetterThanTomorrow/calva/issues/1842)

## [2.0.294] - 2022-08-25

- [Output metadata on notebooks](https://github.com/BetterThanTomorrow/calva/issues/1836)
- Fix: [Staged file gets evaluated instead of uncommitted file](https://github.com/BetterThanTomorrow/calva/issues/1833)
- [Update nrepl jack-in dependency to 1.0 ](https://github.com/BetterThanTomorrow/calva/issues/1839)

## [2.0.293] - 2022-08-18

- [Add jack-in support for Gradle/Clojurephant](https://github.com/BetterThanTomorrow/calva/pull/1815)
- [Color customization for inline result](https://github.com/BetterThanTomorrow/calva/issues/1831)

## [2.0.292] - 2022-08-18

- [Clojure Notebooks](https://github.com/BetterThanTomorrow/calva/issues/1824)
- Fix: [Wrong 'when condition' for command 'paredit.togglemode'](https://github.com/BetterThanTomorrow/calva/issues/1804)

## [2.0.291] - 2022-08-01

- Fix: [Clojure-lsp silently fails to start on versions of VS Code lower than 1.67.0](https://github.com/BetterThanTomorrow/calva/issues/1818)

## [2.0.290] - 2022-07-31

- Fix: [Clojure-lsp server info command is not enabled if a non-clojure file is open in the active editor](https://github.com/BetterThanTomorrow/calva/issues/1810)
- Fix: [An error is thrown when the clojure-lsp server is stopped via Calva's command for stopping it](https://github.com/BetterThanTomorrow/calva/issues/1773)

## [2.0.289] - 2022-07-04

- Fix: [:refer-clojure :exclude doesn't work as expected](https://github.com/BetterThanTomorrow/calva/issues/1718)
- Fix: [Shadowing of Clojure vars doesn't work in the REPL, even with :refer-clojure :exclude](https://github.com/BetterThanTomorrow/calva/issues/1153)
- Fix: [Command not found error shown when clojure-lsp server info command is run](https://github.com/BetterThanTomorrow/calva/issues/1790)
- [Update cider-nrepl jack-in dependency version](https://github.com/BetterThanTomorrow/calva/issues/1792)

## [2.0.288] - 2022-07-02

- [Add configuration for which symbol definition provider to use](https://github.com/BetterThanTomorrow/calva/issues/1785)
- [Update clojure-lsp version and path settings documentation](https://github.com/BetterThanTomorrow/calva/issues/1791)

## [2.0.287] - 2022-06-25

- Fix: [Error reporting for load file differs from evaluate code](https://github.com/BetterThanTomorrow/calva/issues/1774)
- Fix: [Accepting and rejecting Github Copilot suggestions does not work](https://github.com/BetterThanTomorrow/calva/issues/1781)
- [Use Apple Silicon clojure-lsp builds on M1 and M2 macs when available](https://github.com/BetterThanTomorrow/calva/issues/1780)

## [2.0.286] - 2022-06-13

- [Add option in clojure-lsp quick pick to restart clojure-lsp](https://github.com/BetterThanTomorrow/calva/issues/1770)

## [2.0.285] - 2022-06-11

- Fix: [Paredit strict backspace in the leftmost symbol/keyword/thing inserts a space instead](https://github.com/BetterThanTomorrow/calva/pull/1771)

## [2.0.284] - 2022-06-11

- [Add a command to restart clojure-lsp](https://github.com/BetterThanTomorrow/calva/issues/1727)

## [2.0.283] - 2022-06-10

- [Add a Dart->ClojureDart converter](https://github.com/BetterThanTomorrow/calva/pull/1763)
- [Make Paredit strict backspace smarter, removing empty lines](https://github.com/BetterThanTomorrow/calva/issues/1741)

## [2.0.282] - 2022-06-04

- Fix: [clojure-lsp fails to download for some Apple M1 users](https://github.com/BetterThanTomorrow/calva/pull/1761)

## [2.0.281] - 2022-06-03

- [Updates to how we choose clojure-lsp executable for different platforms](https://github.com/BetterThanTomorrow/calva/pull/1758), fixes: [#1590](https://github.com/BetterThanTomorrow/calva/issues/1590), and [#1598](https://github.com/BetterThanTomorrow/calva/issues/1598)
- [Add sponsor link to the Calva extension manifest](https://github.com/BetterThanTomorrow/calva/issues/1759)

## [2.0.280] - 2022-05-31

- Fix: [Debugger decorations are not working properly](https://github.com/BetterThanTomorrow/calva/issues/1165)
- Add some logging when Calva starts and finishes activating

## [2.0.279] - 2022-05-30

- [Expose Calva's `registerDocumentSymbolProvider` function in the extension API](https://github.com/BetterThanTomorrow/calva/issues/1752)
- [Support use of nightly clojure-lsp builds](https://github.com/BetterThanTomorrow/calva/issues/1746)
- [Update Calva's Extension api docs with Joyride sections](https://github.com/BetterThanTomorrow/calva/issues/1754)

## [2.0.278] - 2022-05-29

- [Extension API: Fix Javascript examples & align them with their ClojureScript versions](https://github.com/BetterThanTomorrow/calva/issues/1742)
- [Extension API for retrieving the current REPL session key](https://github.com/BetterThanTomorrow/calva/issues/1747)
- [Extension API for some common ranges, like current form and top level form](https://github.com/BetterThanTomorrow/calva/issues/1748)

## [2.0.277] - 2022-05-26

- [Extension API: Evaluate via Calva's REPL connection](https://github.com/BetterThanTomorrow/calva/issues/1719)
- Fix: [alt+<up,down> arrow inside map destruction is not working properly](https://github.com/BetterThanTomorrow/calva/issues/1737)
- [Name change for loading/evaluating a whole file for better command lookup](https://github.com/BetterThanTomorrow/calva/issues/1731)

## [2.0.276] - 2022-05-22

- Fix: [Hover documentation shows "undefined" for functions that don't have a doc string](https://github.com/BetterThanTomorrow/calva/issues/1735)
- [Enable awaiting Calva Paredit commands when using `vscode.commands.executeCommand()`](https://github.com/BetterThanTomorrow/calva/issues/1733)

## [2.0.275] - 2022-05-18

- Addressing: [Better REPL feedback while waiting for evaluation](https://github.com/BetterThanTomorrow/calva/issues/1543)

## [2.0.274] - 2022-05-12

- Fix: [**Toggle between implementation and test** doesn't work in multi-root workspaces](https://github.com/BetterThanTomorrow/calva/issues/1725)

## [2.0.273] - 2022-05-11

- Fix: [Calva fails finding project root if a file from outside the workspace is the active editor](https://github.com/BetterThanTomorrow/calva/issues/1721)

## [2.0.272] - 2022-05-07

- [Add Joyride REPL server start and connect, a.k.a. Jack-in](https://github.com/BetterThanTomorrow/calva/issues/1714)

## [2.0.271] - 2022-05-06

- Fix: [Toggle between implementation and test command should set editor focus](https://github.com/BetterThanTomorrow/calva/issues/1707)
- Fix: [Hijacked shortcuts only works on strict](https://github.com/BetterThanTomorrow/calva/issues/1711)
- [Enable users to bind keyboard shortcuts to clojure-lsp drag commands](https://github.com/BetterThanTomorrow/calva/issues/1697)

## [2.0.270] - 2022-05-02

- Fix: [Downloaded clojure-lsp not working for static linux distros](https://github.com/BetterThanTomorrow/calva/issues/1692)
- [Add dedicated Joyride nREPL Connect option](https://github.com/BetterThanTomorrow/calva/issues/1704)

## [2.0.269] - 2022-04-20

- [How about a command converting JavaScript to ClojureScript?](https://github.com/BetterThanTomorrow/calva/issues/1687)

## [2.0.268] - 2022-04-18

- Fix: [Jack-in doesn't handle a shadow-cljs config without builds](https://github.com/BetterThanTomorrow/calva/issues/1683)
- [Merge LSP + NREPL completions and goToDefintion](https://github.com/BetterThanTomorrow/calva/issues/1498)

## [2.0.267] - 2022-04-13

- [Add command for formatting away multiple space between forms on the same line](https://github.com/BetterThanTomorrow/calva/issues/1677)

## [2.0.266] - 2022-04-11

- Fix: [Jump between source/test does not work properly with multiple workspace folders](https://github.com/BetterThanTomorrow/calva/issues/1219)

## [2.0.265] - 2022-04-08

- [Update paredit sexp forward/backward command labels](https://github.com/BetterThanTomorrow/calva/issues/1660)
- Fix: [clojure-lsp initialized in a non-working state when there is no VS Code folder](https://github.com/BetterThanTomorrow/calva/issues/1664)

## [2.0.264] - 2022-04-07

- Fix: [shadow-cljs shows error when running calva.loadFile command](https://github.com/BetterThanTomorrow/calva/issues/1670)

## [2.0.263] - 2022-04-06

- [Improve kondo configuration documentation](https://github.com/BetterThanTomorrow/calva/issues/1282)
- [Require VS Code 1.66+ (and update project node version to 16+)](https://github.com/BetterThanTomorrow/calva/issues/1638#issuecomment-1086726236)
- Maintenance: [Upgrade TS + some ts eslint plugins + fix any necessary changes thereof](https://github.com/BetterThanTomorrow/calva/issues/1639)
- Fix: [Command not working: sync the Output/REPL window namespace with the current file](https://github.com/BetterThanTomorrow/calva/issues/1503)

## [2.0.262] - 2022-04-02

- Tech debt mortgage: [Cleanup/removal of EditableDocument.selectionLeft/Right APIs](https://github.com/BetterThanTomorrow/calva/issues/1607)]
- Maintenance: [Update node version to v14, which is maintenance LTS until 2023-04-30](https://github.com/BetterThanTomorrow/calva/pull/1656)
- Maintenance: [Update default build/dev task to rebuild cljs+ts, watch cljs+ts tests, watch linter, and Prettier watcher, add a custom Connect Sequence for connecting to Calva `:cljs-lib`](https://github.com/BetterThanTomorrow/calva/pull/1652)
- [Add new `paredit.[forward/backward]SexpOrUp` commands](https://github.com/BetterThanTomorrow/calva/issues/1657)

## [2.0.261] - 2022-04-01

- Fix: [Results doc gets in a bad state and does not update](https://github.com/BetterThanTomorrow/calva/issues/1509)
- Fix: [Indenting not working correctly in vectors starting with fn-like symbols](https://github.com/BetterThanTomorrow/calva/issues/1622)
- Fix: [Make server side `pprint` the default pretty printer](https://github.com/BetterThanTomorrow/calva/issues/1650)

## [2.0.260] - 2022-03-27

- Fix: [Rainbow parentheses sometimes not activating](https://github.com/BetterThanTomorrow/calva/issues/1616)

## [2.0.259] - 2022-03-26

- [Add setting for enabling LiveShare support](https://github.com/BetterThanTomorrow/calva/issues/1629)

## [2.0.258] - 2022-03-25

- Fix: [Connect fails when there is no project file (deps.edn, etc)](https://github.com/BetterThanTomorrow/calva/issues/1613)
- [Make `calva` the default pretty printer](https://github.com/BetterThanTomorrow/calva/issues/1619)
- [Add default Clojure associations for file extensions `.bb` and `.cljd`](https://github.com/BetterThanTomorrow/calva/issues/1617)
- Fix: [Warning when loading a file produces an error: n.filter is not a function](https://github.com/BetterThanTomorrow/calva/issues/1567)

## [2.0.257] - 2022-03-23

- Maintenance: [Update _even more_ TypeScript code to be compatible with strictNullChecks.](https://github.com/BetterThanTomorrow/calva/pull/1605)
- [Support Polylith and monorepo jack-in/connect better](https://github.com/BetterThanTomorrow/calva/issues/1254)
- Fix: [Calva Refactor commands not appearing in command palette after initial start](https://github.com/BetterThanTomorrow/calva/issues/1610)

## [2.0.256] - 2022-03-19

- Be more graceful about that [clojure-lsp does not start in the Getting Started REPL](https://github.com/BetterThanTomorrow/calva/issues/1601)
- Fix: [An extra quick-pick prompt at pops up after jack-in](https://github.com/BetterThanTomorrow/calva/issues/1600)

## [2.0.255] - 2022-03-18

- Maintenance: [Update more TypeScript code to be compatible with strictNullChecks.](https://github.com/BetterThanTomorrow/calva/pull/1581)

## [2.0.254] - 2022-03-16

- [Add commands for starting and stopping clojure-lsp](https://github.com/BetterThanTomorrow/calva/pull/1592)
- Maintenance: [Dumb down the token cursor some dealing with meta data and readers](https://github.com/BetterThanTomorrow/calva/pull/1585)

## [2.0.253] - 2022-03-09

- Fix: [Structural editing hangs in specific cases of unbalanced forms](https://github.com/BetterThanTomorrow/calva/pull/1585)
- Fix: [Hover snippet markdown and adds example](https://github.com/BetterThanTomorrow/calva/pull/1582)
- Maintenance: [Begin work on enabling strictNullChecks in the TypeScript config.](https://github.com/BetterThanTomorrow/calva/pull/1568)

## [2.0.252] - 2022-03-05

- Fix: [Tab doesn't work in snippet mode](https://github.com/BetterThanTomorrow/calva/pull/1580)

## [2.0.251] - 2022-03-05

- Fix: [Metadata affects the Current Form being recognized](https://github.com/BetterThanTomorrow/calva/pull/1577)
- Fix: [ENTER key does not pick suggestion when cursor is not in a form in output window ](https://github.com/BetterThanTomorrow/calva/pull/1578)

## [2.0.250] - 2022-03-05

- Fix: [Version 2.0.247 regression with structural editing, hangs at unbalance + structural delete](https://github.com/BetterThanTomorrow/calva/pull/1573)
- Fix: [Paredit Slurp and Barf are not metadata aware](https://github.com/BetterThanTomorrow/calva/pull/1576)

## [2.0.249] - 2022-03-04

- Revert to before metadata-change, because: [Version 2.0.247 regression with structural editing, hangs at unbalance + structural delete](https://github.com/BetterThanTomorrow/calva/pull/1573)

## [2.0.248] - 2022-03-03

- [Remove special grammar scopes for keywords](https://github.com/BetterThanTomorrow/calva/pull/1571)

## [2.0.247] - 2022-03-02

- [Enable the @typescript-eslint/no-floating-promises eslint rule](https://github.com/BetterThanTomorrow/calva/pull/1564)
- [Include metadata in current form selection/evaluation/etcetera](https://github.com/BetterThanTomorrow/calva/pull/1551)

## [2.0.246] - 2022-02-24

- Fix: [Format config from clojure-lsp broken](https://github.com/BetterThanTomorrow/calva/issues/1561)
- Fix2: [Format on save](https://github.com/BetterThanTomorrow/calva/issues/1556)

## [2.0.245] - 2022-02-23

- Fix: [Print stacktrace link in REPL gets duplicated](https://github.com/BetterThanTomorrow/calva/issues/1542)
- [Publish pre-releases when dev updates](https://github.com/BetterThanTomorrow/calva/issues/1554)
- [Apply basic typescript eslint rules](https://github.com/BetterThanTomorrow/calva/issues/1536)
- Fix: [”Resolve macro as...” code action produces unreadable text in pop up](https://github.com/BetterThanTomorrow/calva/issues/1539)
- Fix: [Format on save](https://github.com/BetterThanTomorrow/calva/issues/1556)

## [2.0.244] - 2022-02-20

- [Add custom hover snippets](https://github.com/BetterThanTomorrow/calva/issues/1471)
- [Add option to read cljfmt config from clojure-lsp](https://github.com/BetterThanTomorrow/calva/issues/1545)
- Fix: [Map key/value pair aligning is not working on format](https://github.com/BetterThanTomorrow/calva/issues/1535)
- Change default keybinding for **Infer parens** to `ctrl+alt+p i` (from `shift+tab`)
- Change default keybinding for **Tab dedent** to `shift+tab` (from `shift+ctrl+i`)
- [Make alt+enter evaluate top level form also within line-comments](https://github.com/BetterThanTomorrow/calva/issues/1549)

## [2.0.243] - 2022-02-13

- [Use vanilla cljfmt for regular formatting](https://github.com/BetterThanTomorrow/calva/pull/1179)

## [2.0.242] - 2022-02-13

- Maintenance: [Upgrade typescript and linting packages/configs.](https://github.com/BetterThanTomorrow/calva/pull/1529)

## [2.0.241] - 2022-02-11

- Maintenance: [Consistently format all JavaScript and TypeScript in the project and provide for easily formatting these files in the future.](https://github.com/BetterThanTomorrow/calva/pull/1524)

## [2.0.240] - 2022-02-06

- Maintenance: [Update dependencies to fix security vulnerabilities](https://github.com/BetterThanTomorrow/calva/pull/1520)

## [2.0.239] - 2022-02-06

- Maintenance: [Update dependencies to fix security vulnerabilities](https://github.com/BetterThanTomorrow/calva/pull/1520) (Change was not actually included in this release. See next release.)

## [2.0.238] - 2022-02-06

- Fix: ['Add to history' not working on eval in repl](https://github.com/BetterThanTomorrow/calva/issues/1594)
- Fix: [TypeError when "Run Tests for Current Namespace" in non "-test" namespace](https://github.com/BetterThanTomorrow/calva/issues/1516)

## [2.0.237] - 2022-01-30

- Fix: ['Show Previous REPL History Entry' command not working on v.2.0.236](https://github.com/BetterThanTomorrow/calva/issues/1594)

## [2.0.236] - 2022-01-25

- Fix: [Exception thrown when registering "resolve-macro-as" command](https://github.com/BetterThanTomorrow/calva/issues/1495)
- [Show code eval in repl option](https://github.com/BetterThanTomorrow/calva/issues/1465)

## [2.0.235] - 2022-01-22

- [Continue to support -Aalias for jack-in](https://github.com/BetterThanTomorrow/calva/issues/1474)
- [Add custom commands from libraries](https://github.com/BetterThanTomorrow/calva/pull/1442)
- [Clojure-lsp not starting when offline](https://github.com/BetterThanTomorrow/calva/issues/1299)
- Workaround: [VS Code highlights characters in the output/REPL window prompt](https://github.com/BetterThanTomorrow/calva/pull/1475)
- [Exclude REPL output window from LSP analysis](https://github.com/BetterThanTomorrow/calva/issues/1250)
- Fix: [Snippet in custom command doesn't work with function metadata] (https://github.com/BetterThanTomorrow/calva/issues/1463)

## [2.0.234] - 2022-01-16

- [Improve LSP startup feedback on status bar](https://github.com/BetterThanTomorrow/calva/pull/1454)
- [Fix errors in test output when fixtures throw exceptions](https://github.com/BetterThanTomorrow/calva/issues/1456).

## [2.0.233] - 2022-01-07

- [Add experimental support for Test Explorer](https://github.com/BetterThanTomorrow/calva/issues/953)
- Maintenance: [Upgrade dependencies to attempt to fix Dependabot security alert](https://github.com/BetterThanTomorrow/calva/pull/1447)
- Fix: [Update nrepl and cider-nrepl versions in jack-in dependencies](https://github.com/BetterThanTomorrow/calva/issues/1444)

## [2.0.232] - 2021-12-31

- [Prevent warning during deps.edn jack-in](https://github.com/BetterThanTomorrow/calva/issues/1355)
- Fix: [Connecting to an out-of-process nREPL server and a merged Figwheel-main build](https://github.com/BetterThanTomorrow/calva/issues/1386)
- Fix: [Empty lines in output.calva-repl when running tests](https://github.com/BetterThanTomorrow/calva/issues/1448)

## [2.0.231] - 2021-12-14

- Fix: [Calva randomly edits file while in Live Share](https://github.com/BetterThanTomorrow/calva/issues/1434)

## [2.0.230] - 2021-12-13

- Fix: [Hover broken when repl is connected but cider-nrepl is not present](https://github.com/BetterThanTomorrow/calva/issues/1432)
- Fix: [Some valid floats are highlighted incorrectly](https://github.com/BetterThanTomorrow/calva/issues/1378)

## [2.0.229] - 2021-12-12

- Fix: [Babashka Jack-In REPL doesn't show eval errors](https://github.com/BetterThanTomorrow/calva/issues/1413)
- [Inform about conflict with the Clojure extension](https://github.com/BetterThanTomorrow/calva/issues/1427)
- Fix: [Run All Tests command doesn't run tests in .cljc file with reader conditional in ns](https://github.com/BetterThanTomorrow/calva/issues/1328).
- Fix: [Allow LSP features on jar files](https://github.com/BetterThanTomorrow/calva/issues/1421)

## [2.0.228] - 2021-12-02

- Revert: Parinfer Experimental
- Revert: Full Format Experimental
- Revert: Remove `calva.fmt.formatAsYouType` option

## [2.0.227] - 2021-12-01

- Re-enable, Experimental: [Add Parinfer Mode](https://github.com/BetterThanTomorrow/calva/issues/253)
- Experimental: [Add option to keep text more fully formatted as you type](https://github.com/BetterThanTomorrow/calva/issues/1406)
- [Remove `calva.fmt.formatAsYouType` option](https://github.com/BetterThanTomorrow/calva/issues/1407)
- Fix: [Test runner not finding tests with + in middle of the name](https://github.com/BetterThanTomorrow/calva/issues/1383)

## [2.0.226] - 2021-11-29

- Internal: [Handle the unknown-op status from test commands](https://github.com/BetterThanTomorrow/calva/pull/1365)
- Fix: [textDocument/linkedEditingRange failed when opening files or moving cursor](https://github.com/BetterThanTomorrow/calva/issues/1374)
- Fix: [paredit.spliceSexp doesn't work with set literals](https://github.com/BetterThanTomorrow/calva/issues/1395)
- Fix: [LSP code actions not working](https://github.com/BetterThanTomorrow/calva/issues/1373)

## [2.0.225] - 2021-11-10

- Revert 224 changes: [Version v2.0.224 causes problems on some machines (possibly Windows related)](https://github.com/BetterThanTomorrow/calva/issues/1379)

## [2.0.224] - 2021-11-10

- Experimental: [Add Parinfer Options](https://github.com/BetterThanTomorrow/calva/issues/253)

## [2.0.223] - 2021-11-01

- [Include material from clojuredocs.org in function documentation](https://github.com/BetterThanTomorrow/calva/issues/689)
- Fix: [Not able to escape read-line in the output window](https://github.com/BetterThanTomorrow/calva/issues/783)
- Fix: [Some keyboard shortcuts missing the languageID check](https://github.com/BetterThanTomorrow/calva/issues/823)
- Fix: [Formatting form with comma whitespace inserts 0 and places the cursor wrong](https://github.com/BetterThanTomorrow/calva/issues/1370)
- Fix: [Calva's re-frame docs are outdated](https://github.com/BetterThanTomorrow/calva/issues/1372)

## [2.0.222] - 2021-10-27

- [Add command to open the clojure-lsp log file](https://github.com/BetterThanTomorrow/calva/issues/1362)
- [Add nrepl message logging](https://github.com/BetterThanTomorrow/calva/issues/1198)
- Fix: [ctrl+k for Kill Right conflicts with several bindings on Windows](https://github.com/BetterThanTomorrow/calva/issues/1356)

## [2.0.221] - 2021-10-23

- [Clean away legacy evaluation keyboard shortcuts](https://github.com/BetterThanTomorrow/calva/issues/1353)
- [Don't wait for clojure-lsp to initialize before activating nREPL lookup and navigation](https://github.com/BetterThanTomorrow/calva/issues/1341)
- [Tidy up doc and signature hovers](https://github.com/BetterThanTomorrow/calva/issues/1360)

## [2.0.220] - 2021-10-20

- [Add Paredit select/kill right functionality](https://github.com/BetterThanTomorrow/calva/issues/1024)

## [2.0.219] - 2021-10-19

- [Provide semantic token fallback map for Calva's TM grammar](https://github.com/BetterThanTomorrow/calva/issues/1348)

## [2.0.218] - 2021-10-18

- [npm audit fixes](https://github.com/BetterThanTomorrow/calva/issues/1346)
- [Select top level form fails for top level derefs in comment forms](https://github.com/BetterThanTomorrow/calva/issues/1345)

## [2.0.217] - 2021-10-17

- [Support setting the cider-nrepl print-fn to whatever](https://github.com/BetterThanTomorrow/calva/issues/1340)
- [Make Add Rich Comment command go to any existing Rich comment right below](https://github.com/BetterThanTomorrow/calva/issues/1333)
- [Add semantic tokens support from LSP](https://github.com/BetterThanTomorrow/calva/issues/1231)
- Fix: [Inline evaluation results no longer display in 2.0.216](https://github.com/BetterThanTomorrow/calva/issues/1332)

## [2.0.216] - 2021-10-10

- Fix: [Inline results display pushes the cursor away when evaluation at the end of the line](https://github.com/BetterThanTomorrow/calva/issues/1329)
- Fix: [Inline evaluation display renders differently than the REPL display for empty spaces](https://github.com/BetterThanTomorrow/calva/issues/872)

## [2.0.215] - 2021-10-10

- [Add command for inserting a Rich Comment](https://github.com/BetterThanTomorrow/calva/issues/1324)

## [2.0.214] - 2021-10-06

- [Add Babashka Jack-in option](https://github.com/BetterThanTomorrow/calva/issues/1001)
- [Add nbb Jack-in option](https://github.com/BetterThanTomorrow/calva/issues/1311)
- Fix: [Not currently possible to Jack-in to a ClojureScript nREPL Server](https://github.com/BetterThanTomorrow/calva/issues/1310)
- [Update deps.clj version to 0.0.19](https://github.com/BetterThanTomorrow/calva/issues/1319)

## [2.0.213] - 2021-10-02

- Workaround [nbb nrepl-server: can only eval from file with extension .clj](https://github.com/BetterThanTomorrow/calva/issues/1308)

## [2.0.212] - 2021-09-26

- Fix [The schema for the setting `calva.highlight.bracketColors` is broken](https://github.com/BetterThanTomorrow/calva/issues/1290)
- Fix [Can't use $current-form more than once in a custom repl command snippet](https://github.com/BetterThanTomorrow/calva/issues/1301)

## [2.0.211] - 2021-09-01

- [Add setting for letting Paredit Kill commands copy the deleted code to the clipboard](https://github.com/BetterThanTomorrow/calva/issues/1283)

## [2.0.210] - 2021-08-25

- [Add back jack-in/connect config `deps.edn + shadow-cljs`](https://github.com/BetterThanTomorrow/calva/issues/1270)

## [2.0.209] - 2021-08-17

- Fix [Statusbar buttons hard to see with light themes](https://github.com/BetterThanTomorrow/calva/issues/1264)

## [2.0.208] - 2021-08-09

- Fix [Project configuration shadow-cljs + deps.edn doesn't work](https://github.com/BetterThanTomorrow/calva/issues/1253)

## [2.0.207] - 2021-08-07

- [Support a blank `clojureLspVersion` setting](https://github.com/BetterThanTomorrow/calva/issues/1251)

## [2.0.206] - 2021-08-05

- [Default to using the latest release of clojure-lsp](https://github.com/BetterThanTomorrow/calva/issues/1248)
- Performance improvement [REPL is Slow and Performance Degrades as the Output Grows](https://github.com/BetterThanTomorrow/calva/issues/942)

## [2.0.205] - 2021-07-14

- [Use new custom LSP method for server info command and print info in "Calva says" output channel ](https://github.com/BetterThanTomorrow/calva/issues/1211)
- Update clojure-lsp to version [2021.07.12-12.30.59](https://github.com/clojure-lsp/clojure-lsp/releases/tag/2021.07.12-12.30.59)
- [Roll back debugger call stack improvement](https://github.com/BetterThanTomorrow/calva/pull/1236)

## [2.0.204] - 2021-07-11

- [Put closing paren of rich comments on separate line](https://github.com/BetterThanTomorrow/calva/issues/1224)
- Fix: [Calva formatting defaults do not get applied when including any kind of .cljfmt.edn config](https://github.com/BetterThanTomorrow/calva/issues/1228)
- Workaround: [Paredit commands don't propagate to multiple cursors](https://github.com/BetterThanTomorrow/calva/issues/610)

## [2.0.203] - 2021-07-04

- Fix: [Custom repl commands show error if run from non-clojure file](https://github.com/BetterThanTomorrow/calva/issues/1203)
- Improvement: [REPL is Slow and Performance Degrades as the Output Grows](https://github.com/BetterThanTomorrow/calva/issues/942)
- Fix: [Paredit drag up/down kills line comments](https://github.com/BetterThanTomorrow/calva/issues/1222)
- Bump clojure-lsp [2021.07.01-13.46.18](https://github.com/clojure-lsp/clojure-lsp/releases/tag/2021.07.01-13.46.18)

## [2.0.202] - 2021-06-29

- Fix: [Custom repl commands are not evaluated in specified ns if different than current ns](https://github.com/BetterThanTomorrow/calva/issues/1196)
- Fix: [clojure-lsp statusbar messages move the nREPL button around](https://github.com/BetterThanTomorrow/calva/issues/1205)
- [Add command for toggling between implementation and test](https://github.com/BetterThanTomorrow/calva/issues/1168)
- [Add command for evaluating the current top level form up to cursor](https://github.com/BetterThanTomorrow/calva/issues/1215)
- [Add command for evaluating from the start of the file to cursor](https://github.com/BetterThanTomorrow/calva/issues/1216)

## [2.0.201] - 2021-06-24

- [Add nrepl and clojure-lsp versions to Calva says greetings](https://github.com/BetterThanTomorrow/calva/issues/1199)
- Workaround: [Command Palette shows wrong keyboard shortcuts for Paredit Forward/Backward Sexp](https://github.com/BetterThanTomorrow/calva/issues/1161)
- Update clojure-lsp to version `2021.06.24-01.20.01`

## [2.0.200] - 2021-06-06

- Update clojure-lsp to version 2021.06.01-16.19.44

## [2.0.199] - 2021-06-04

- [Support custom clojure-lsp path](https://github.com/BetterThanTomorrow/calva/issues/1181)
- [Improve debugger call stack](https://github.com/BetterThanTomorrow/calva/issues/1150)

## [2.0.198] - 2021-05-26

- [Add Standalone ClojureScript Quick Start REPLs](https://github.com/BetterThanTomorrow/calva/issues/1185)

## [2.0.197] - 2021-05-12

- [Add command for evaluating enclosing form](https://github.com/BetterThanTomorrow/calva/issues/1176)

## [2.0.196] - 2021-05-10

- Fix: [Forward slurp with closing paren after newline, breaks the structure](https://github.com/BetterThanTomorrow/calva/issues/1171)
- [Pre-bind some keyboard shortcuts to custom REPL commands](https://github.com/BetterThanTomorrow/calva/issues/1173)

## [2.0.195] - 2021-05-07

- Update cider-nrepl to [0.26.0](https://github.com/clojure-emacs/cider-nrepl/releases/tag/v0.26.0)
- [Makes it possible to add a jackInEnv per replConnectSequences](https://github.com/BetterThanTomorrow/calva/issues/1124)

## [2.0.194] - 2021-04-26

- [Make Clojure-lsp Server Info command always enabled](https://github.com/BetterThanTomorrow/calva/issues/1143)
- [Add docs about using Calva with Krell](https://calva.io/krell)

## [2.0.193] - 2021-04-24

- [Give the user some help to choose the right deps.edn jack-in alias when there are aliases with :main-opts](https://github.com/BetterThanTomorrow/calva/issues/1140)
- Update clojure-lsp to [2021.04.23-15.49.47](https://github.com/clojure-lsp/clojure-lsp/releases/tag/2021.04.23-15.49.47)

## [2.0.192] - 2021-04-21

- Fix: [Evaluating top level form sometimes does nothing](https://github.com/BetterThanTomorrow/calva/issues/1136)
- Fix: [Line comment continuation needs some tweaking](https://github.com/BetterThanTomorrow/calva/issues/1137)

## [2.0.191] - 2021-04-20

- [Replace automatic comment continuation with an on-demand one](https://github.com/BetterThanTomorrow/calva/issues/644)
- Fix: [Wrong selection restored after eval-to-comment](https://github.com/BetterThanTomorrow/calva/issues/1131)
- Bump `cider-nrepl` to [0.25.11](https://github.com/clojure-emacs/cider-nrepl/blob/master/CHANGELOG.md#02511-2021-04-12)

## [2.0.190] - 2021-04-19

- [Add Resolve Macro As (clojure-lsp) support](https://github.com/BetterThanTomorrow/calva/issues/1077)
- Fix: [REPL evaluation hangs if an error is raised during debug session](https://github.com/BetterThanTomorrow/calva/issues/1118)

## [2.0.189] - 2021-04-18

- [Paredit backspace should delete non-bracket parts of the opening token](https://github.com/BetterThanTomorrow/calva/issues/1122)
- [Use `shift+tab` for the ”Infer parens from indentation” command](https://github.com/BetterThanTomorrow/calva/issues/1126)
- Fix: [Inline evaluation results can show up in the wrong editor](https://github.com/BetterThanTomorrow/calva/issues/1120)
- [Bring back results in hovers](https://github.com/BetterThanTomorrow/calva/issues/736)

## [2.0.188] - 2021-04-16

- Fix: [Getting Started REPL failing on Windows when username has spaces (on some machines)](https://github.com/BetterThanTomorrow/calva/issues/1085)

## [2.0.187] - 2021-04-11

- [Add built-in REPL Connect Sequences for ClojureScript built-in for browser and Node REPLs](https://github.com/BetterThanTomorrow/calva/issues/1114)
- [Remove Nashorn ClojureScript Jack-in option](https://github.com/BetterThanTomorrow/calva/issues/1117)

## [2.0.186] - 2021-04-10

- [Allow keybindings to target when the cursor is inside a comment or a string](https://github.com/BetterThanTomorrow/calva/issues/1023)
- [Use alt+up/down for drag sexpr backward/forward](https://github.com/BetterThanTomorrow/calva/issues/1111)
- [Make it possible to disable some of Paredits hijacking of VS Code default shortcuts](https://github.com/BetterThanTomorrow/calva/issues/1112)
- Fix: [The unbalanced closing-bracket feature is active in line comments](https://github.com/BetterThanTomorrow/calva/issues/1105)
- [Remove the display diagnostics setting in favor of managing diagnostics entirely via clojure-lsp config](https://github.com/BetterThanTomorrow/calva/issues/1067)
- Bump `clojure-lsp` to [2021.04.07-16.34.10](https://github.com/clojure-lsp/clojure-lsp/releases/tag/2021.04.07-16.34.10)
- Bump `cider-nrepl` to [0.25.10](https://github.com/clojure-emacs/cider-nrepl/blob/master/CHANGELOG.md#02510-2021-04-08)

## [2.0.185] - 2021-04-05

- Fix: [Paredit slurp sometimes leaves an extra space](https://github.com/BetterThanTomorrow/calva/issues/1098)
- Fix: [Delete empty literal function causes newline to be removed](https://github.com/BetterThanTomorrow/calva/issues/1079)
- Add experimental setting to: [Prevent extra closing brackets in strict mode](https://github.com/BetterThanTomorrow/calva/issues/650)
- Bump `clojure-lsp` to `2021.04.03-18.43.55`

## [2.0.184] - 2021-04-02

- Fix: [Calva not detecting tests with aliased clojure.test namespace](https://github.com/BetterThanTomorrow/calva/issues/1086)
- Fix: [Auto-generated namespaces not working correctly in some cases](https://github.com/BetterThanTomorrow/calva/issues/1060)
- [Make clojure-lsp version configurable by the user](https://github.com/BetterThanTomorrow/calva/issues/1088) and bump to `2021.03.30-20.42.34`
- [Remove warning about clj-kondo extension](https://github.com/BetterThanTomorrow/calva/issues/1091)

## [2.0.183] - 2021-03-30

- [Stop printing to the output window when all evaluations are interrupted](https://github.com/BetterThanTomorrow/calva/issues/978)
- Fix: [Completion not working with babashka](https://github.com/BetterThanTomorrow/calva/issues/1083)

## [2.0.182] - 2021-03-26

- [Use graalvm-compiled native image for clojure-lsp instead of jar](https://github.com/BetterThanTomorrow/calva/issues/1017)

## [2.0.181] - 2021-03-22

- Update clojure-lsp to 2021.03.21-23.29.19

## [2.0.180] - 2021-03-21

- [Make Paredit forward, then backward selections (and vice versa) behave like ”normal” forward/backward selection does](https://github.com/BetterThanTomorrow/calva/pull/1062)

## [2.0.179] - 2021-03-10

- Implementation detail: [Use cljs for state](https://github.com/BetterThanTomorrow/calva/pull/1053)

## [2.0.178] - 2021-03-09

- [Add command for evaluating from start of list to cursor](https://github.com/BetterThanTomorrow/calva/issues/1057)
- Add custom REPL snippet variables, $selection, $head, and $tail

## [2.0.177] - 2021-03-07

- Fix: [Navigating to a definition in a jar file throws error in console](https://github.com/BetterThanTomorrow/calva/issues/1047)
- [Add a Getting Started REPL feature](https://github.com/BetterThanTomorrow/calva/issues/1040)

## [2.0.176] - 2021-02-24

- Revert switch to cljs for lsp, until [the issue with released cljs/js interop](https://github.com/BetterThanTomorrow/calva/issues/1044) has been fixed

## [2.0.174] - 2021-02-24

- [Translate clojure-lsp integration to cljs](https://github.com/BetterThanTomorrow/calva/issues/1025)

## [2.0.173] - 2021-02-21

- Fix [Connect ”not in project” glitches](https://github.com/BetterThanTomorrow/calva/issues/814)
- [Add a ”Start Standalone REPL” commands](https://github.com/BetterThanTomorrow/calva/issues/1003)
- [Add a configuration option to disable diagnostics](https://github.com/BetterThanTomorrow/calva/pull/981)

## [2.0.171] - 2021-02-10

- Update clojure-lsp to version 2021.02.09-18.28.06 (Fix: [Auto completion does not work in clojure-lsp only mode (no repl connection)](https://github.com/BetterThanTomorrow/calva/issues/996#issuecomment-776148282))
- Update clojure-lsp to version 2021.02.10-03.01.19 (Fix: [Project clj-kondo config file not being considered](https://github.com/BetterThanTomorrow/calva/issues/1026))

## [2.0.170] - 2021-02-09

- [Paredit drag backward/forward should drag bindings as pairs](https://github.com/BetterThanTomorrow/calva/issues/529)

## [2.0.169] - 2021-02-09

- Update clojure-lsp to version 2021.02.07-22.51.26 (fix previous attempt)

## [2.0.168] - 2021-02-08

- Update clojure-lsp to version 2021.02.07-22.51.26

## [2.0.164] - 2021-02-06

- Really fix: [Demo gifs 404 on VisualStudio Marketplace](https://github.com/BetterThanTomorrow/calva/issues/1018)

## [2.0.163] - 2021-02-06

- Fix: [Demo gifs 404 on VisualStudio Marketplace](https://github.com/BetterThanTomorrow/calva/issues/1018)

## [2.0.162] - 2021-02-06

- Fix for fix of: [Fix Paredit raise sexpr doesn't work when cursor is behind the current form](https://github.com/BetterThanTomorrow/calva/issues/1016)

## [2.0.161] - 2021-02-05

- [Automate more of the release process and document it (including rationale)](https://github.com/BetterThanTomorrow/calva/issues/860)

## [2.0.160] - 2021-02-05

- [Upgrade clojure-lsp to 2021.02.05-03.05.34](https://github.com/clojure-lsp/clojure-lsp/releases/tag/2021.02.05-03.05.34)
- [Fix Paredit raise sexpr doesn't work when cursor is behind the current form](https://github.com/BetterThanTomorrow/calva/issues/1016)

## [2.0.159] - 2021-02-05

- [Enable keyboard shortcuts for custom REPL commands](https://github.com/BetterThanTomorrow/calva/issues/1011)
- [Add commands for tapping current and top-level forms](https://github.com/BetterThanTomorrow/calva/issues/1008)

## [2.0.158] - 2021-02-03

- [Add setting to use only static parts of Calva](https://github.com/BetterThanTomorrow/calva/issues/1005)
- Fix: [Load file command not loading changes since last file save on Windows](https://github.com/BetterThanTomorrow/calva/issues/975)
- Update clojure-lsp to 2021.02.02-14.02.23

## [2.0.157] - 2021-02-01

- [Add command for copying jack-in command to clipboard](https://github.com/BetterThanTomorrow/calva/pull/995)
- [Change default shortcuts for Paredit forward/backward sexp, expand/shrink selection, and for slurping and barfing](https://github.com/BetterThanTomorrow/calva/issues/950)
- [Add Custom Commands variables for current form and more](https://github.com/BetterThanTomorrow/calva/issues/986)
- Fix: [Jack-in fails to launch deps.edn projects for some Windows users](https://github.com/BetterThanTomorrow/calva/issues/1000)

## [2.0.156] - 2021-01-28

- Fix: [Debug instrumentation decoration not working correctly anymore on Windows](https://github.com/BetterThanTomorrow/calva/issues/969)
- Fix: [Debugger decorations issues](https://github.com/BetterThanTomorrow/calva/issues/976)

## [2.0.155] - 2021-01-27

- [Make command palette show alt+enter shortcut variant instead of enter for evaluating top level form](https://github.com/BetterThanTomorrow/calva/issues/989)
- Update clojure-lsp to 2021.01.28-03.03.16
- Fix: [nrepl port detection race condition](https://github.com/BetterThanTomorrow/calva/issues/901)

## [2.0.154] - 2021-01-27

- Fix: [Calva uses ; for comments instead of ;;](https://github.com/BetterThanTomorrow/calva/issues/971)
- Update cider-nrepl to 0.25.8
- Update clojure-lsp to 2021.01.26-22.35.27

## [2.0.153] - 2021-01-19

- [Use status bar message instead of withProgress message for clojure-lsp initialization](https://github.com/BetterThanTomorrow/calva/issues/974)
- [Update cider-nrepl: 0.25.6 -> 0.25.7](https://github.com/BetterThanTomorrow/calva/issues/973)
- Fix: ["Extract function" refactoring doesn't work as expected with selections](https://github.com/BetterThanTomorrow/calva/issues/958)

## [2.0.152] - 2021-01-19

- Fix: [Jack-In env with non-string variables fails](https://github.com/BetterThanTomorrow/calva/issues/959)
- [Use clojure-lsp for usages for debug instrumentation decorations, and stop injecting clj-kondo at jack-in](https://github.com/BetterThanTomorrow/calva/issues/931)

## [2.0.151] - 2021-01-15

- Fix: [Debugger is broken on Windows](https://github.com/BetterThanTomorrow/calva/issues/947)

## [2.0.150] - 2021-01-13

- [Stop bundling clj-kondo in favor of using it through clojure-lsp](https://github.com/BetterThanTomorrow/calva/issues/868)

## [2.0.149] - 2021-01-12

- Fix: [calva.jackInEnv does not resolve `${env:...}`](https://github.com/BetterThanTomorrow/calva/issues/933)
- Update clojure-lsp to version 2021.01.12-02.18.26. Fix: [clojure-lsp processes left running/orphaned if VS Code is closed while the lsp server is starting](https://github.com/BetterThanTomorrow/calva/issues/906)

## [2.0.148] - 2021-01-07

- Update clojure-lsp to version 2021.01.07-20.02.02

## [2.0.147] - 2021-01-07

- Fix: [Dimming ignored forms does not work correctly with metadata](https://github.com/BetterThanTomorrow/calva/issues/908)
- [Improve clojure-lsp jar integration](https://github.com/BetterThanTomorrow/calva/issues/913)
- Update clojure-lsp to version 2021.01.07-12.28.44

## [2.0.146] - 2021-01-04

- Fix: [Slurp forward sometimes joins forms to one](https://github.com/BetterThanTomorrow/calva/issues/883)
- Fix: [clojure-lsp processes left running/orphaned if VS Code is closed while the lsp server is starting](https://github.com/BetterThanTomorrow/calva/issues/906)
- Fix: [go to definition jumps to inc instead of inc'](https://github.com/BetterThanTomorrow/calva/issues/884)
- Fix: [Error when start a REPL with jdk15](https://github.com/BetterThanTomorrow/calva/issues/888)

## [2.0.145] - 2021-01-03

- [Add command for opening the file for the output/repl window namespace](https://github.com/BetterThanTomorrow/calva/issues/920)
- [Add setting for auto opening the repl window on Jack-in/Connect](https://github.com/BetterThanTomorrow/calva/issues/922)
- [Add setting for auto opening the Jack-in Terminal](https://github.com/BetterThanTomorrow/calva/issues/923)
- [Replace opening Calva says on start w/ info message box](https://github.com/BetterThanTomorrow/calva/issues/923)
- [Add command for opening Calva documentation](https://github.com/BetterThanTomorrow/calva/issues/923)
- [Change default keyboard shortcut for syncing the repl window ns to `ctrl+alt+c n`](https://github.com/BetterThanTomorrow/calva/issues/923)

## [2.0.144] - 2021-01-01

- [Reactivate definitions/navigation in core and library files](https://github.com/BetterThanTomorrow/calva/issues/915)
- [Make load-file available in the output window](https://github.com/BetterThanTomorrow/calva/issues/910)
- [Make the ns in the repl prompt a peekable symbol](https://github.com/BetterThanTomorrow/calva/issues/904)

## [2.0.142 and 2.0.143] - 2020-12-30

- No changes besides version number. Released due to vsix publishing issues.

## [2.0.141] - 2020-12-30

- Update clojure-lsp to include [jar dependency navigation fix for Windows](https://github.com/clojure-lsp/clojure-lsp/issues/223)
- Fix: [clojure-lsp refactorings not working on Windows](https://github.com/BetterThanTomorrow/calva/issues/911)
- [Remove default key binding for toggling Calva key bindings](https://github.com/BetterThanTomorrow/calva/issues/815)

## [2.0.140] - 2020-12-28

- [Make Jack-in dependency versions configurable (and bump 'em all with default settings)](https://github.com/BetterThanTomorrow/calva/pull/899)

## [2.0.139] - 2020-12-28

- [Use Pseudo Terminal instead of Task for Jack-in](https://github.com/BetterThanTomorrow/calva/pull/654)
- [Prefer cider-nrepl symbol definitions over clojure-lsp](https://github.com/BetterThanTomorrow/calva/issues/897)
- [Enable clojure-lsp completion items when no nrepl connection](https://github.com/BetterThanTomorrow/calva/pull/898)

## [2.0.138] - 2020-12-27

- [Bring in refactorings we get access to via clojure-lsp](https://github.com/BetterThanTomorrow/calva/issues/890)
- [Add ”clojure-lsp starting” progress indicator](https://github.com/BetterThanTomorrow/calva/issues/892)
- [Fix step into local dep with debugger](https://github.com/BetterThanTomorrow/calva/issues/893)

## [2.0.137] - 2020-12-24

- [Bring in clojure-lsp](https://github.com/BetterThanTomorrow/calva/pull/572)

## [2.0.136] - 2020-12-23

- Fix: [Jack-in/Connect prompts sometimes not showing on Windows](https://github.com/BetterThanTomorrow/calva/issues/885)

## [2.0.135] - 2020-12-20

- [Binding keys to REPL functions, passing the namespace and cursor line (Notespace integration)](https://github.com/BetterThanTomorrow/calva/issues/863)
- [Make REPL prompt submit if the cursor is after the top level form](https://github.com/BetterThanTomorrow/calva/issues/875)
- [Only print stacktrace on demand](https://github.com/BetterThanTomorrow/calva/issues/878)

## [2.0.134] - 2020-12-05

- Fix: [Live share jackout error](https://github.com/BetterThanTomorrow/calva/issues/856)
- Fix: [Cannot read property 'document' of undefined](https://github.com/BetterThanTomorrow/calva/issues/846)

## [2.0.133] - 2020-11-25

- Add [ns name deriving](https://github.com/BetterThanTomorrow/calva/issues/844)

## [2.0.132] - 2020-11-16

- Fix: [[Live Share] connecting to REPL as guest doesn't work in multi-project workspace](https://github.com/BetterThanTomorrow/calva/issues/831)

## [2.0.131] - 2020-11-05

- Fix: [Syntax highlighting error when repl prompt shows ns containing digits](https://github.com/BetterThanTomorrow/calva/issues/834)
- Fix: [Syntax highlighting errors with tokens at the start of a line](https://github.com/BetterThanTomorrow/calva/issues/835)
- Fix: [Various parsing issues](https://github.com/BetterThanTomorrow/calva/issues/802)

## [2.0.130] - 2020-10-25

- Fix: [Jack-in broken on Windows](https://github.com/BetterThanTomorrow/calva/issues/827)

## [2.0.129] - 2020-10-17

- [Improve stack trace output](https://github.com/BetterThanTomorrow/calva/pull/806)
- Fix: [Jack-in is broken for multi-project workspaces](https://github.com/BetterThanTomorrow/calva/issues/821)

## [2.0.128] - 2020-10-17

- Fix: [Jack-in is broken if live share extension is not installed](https://github.com/BetterThanTomorrow/calva/issues/821)

## [2.0.127] - 2020-10-17

- [Live Share Support](https://github.com/BetterThanTomorrow/calva/issues/803)

## [2.0.126] - 2020-10-11

- Fix: [Can't Jack-In to new Luminus template (+re-frame +shadow-cljs)](https://github.com/BetterThanTomorrow/calva/issues/777)
- Fix: [Wrong `(in-ns ...)` sent for files with `.bb` extension](https://github.com/BetterThanTomorrow/calva/issues/812)

## [no new version] - 2020-09-21

- [Move docs into repo](https://github.com/BetterThanTomorrow/calva/issues/788)

## [2.0.125] - 2020-09-20

- [Fix: evals should be ignored during parsing](https://github.com/BetterThanTomorrow/calva/issues/763)
- Fix: [Test runner can't find tests under cursor when using a custom test macro](https://github.com/BetterThanTomorrow/calva/issues/786)
- Fix: [Test runner output only partially commented](https://github.com/BetterThanTomorrow/calva/issues/787)
- [Allow toggling keyboard shortcuts](https://github.com/BetterThanTomorrow/calva/issues/784)

## [2.0.124] - 2020-08-31

- Re-fix: [Can't jack-in when no project file is open](https://github.com/BetterThanTomorrow/calva/issues/734)
- [Fix getDocument function to not return a Log document](https://github.com/BetterThanTomorrow/calva/issues/771)
- Fix: [Inline evaluation result disappears after a second](https://github.com/BetterThanTomorrow/calva/issues/774)

## [2.0.123] - 2020-08-26

- [Change output/repl window extension to .calva-repl](https://github.com/BetterThanTomorrow/calva/issues/754)
- Re-fix: [Interrupting evaluations produces extra output and no prompt](https://github.com/BetterThanTomorrow/calva/issues/738)
- [Fix/enhance test runner](https://github.com/BetterThanTomorrow/calva/issues/764)

## [2.0.122] - 2020-08-20

- Fix: [Can't jack-in when no project file is open](https://github.com/BetterThanTomorrow/calva/issues/734)
- Fix: [Fix stacktraces not showing in output](https://github.com/BetterThanTomorrow/calva/pull/759)

## [2.0.121] - 2020-08-19

- Fix: ["Go to definition" command fails](https://github.com/BetterThanTomorrow/calva/issues/636)
- Fix: [Weird expand selection behavior near an anonymous function](https://github.com/BetterThanTomorrow/calva/issues/600)
- Fix: [Backspace is not working properly in the output window](https://github.com/BetterThanTomorrow/calva/issues/700)
- Fix: [Cannot read property 'includes' of undefined](https://github.com/BetterThanTomorrow/calva/issues/753)

## [2.0.120] - 2020-08-17

- Fix: [Interrupting evaluations produces extra output and no prompt](https://github.com/BetterThanTomorrow/calva/issues/738)
- Add REPL history to new output/REPL window
- Fix: [Calva's ESC keybinding overrides VS Code's (useful) default](https://github.com/BetterThanTomorrow/calva/issues/740)

## [2.0.119] - 2020-08-07

- Really fix: [Accessing recent results (*1, *2, \*3) does not work](https://github.com/BetterThanTomorrow/calva/issues/724)

## [2.0.118] - 2020-08-06

- [Remove old REPL Window](https://github.com/BetterThanTomorrow/calva/issues/711)

## [2.0.117] - 2020-08-05

- Fix: [Paste is broken in 2.0.116](https://github.com/BetterThanTomorrow/calva/issues/730)

## [2.0.116] - 2020-08-05

- Fix: [Format-on-paste should not operate inside string literals](https://github.com/BetterThanTomorrow/calva/issues/720)
- Fix: [Accessing recent results (*1, *2, \*3) does not work](https://github.com/BetterThanTomorrow/calva/issues/724)

## [2.0.115] - 2020-08-02

- [Add hover to display results for eval as window into output file](https://github.com/BetterThanTomorrow/calva/issues/693)

## [2.0.114] - 2020-08-02

- Fix: [Stop popping up output window when load file has errors](https://github.com/BetterThanTomorrow/calva/issues/717)

## [2.0.113] - 2020-08-1

- [Add vscode command for to eval code given as args](https://github.com/BetterThanTomorrow/calva/issues/690)
- [Move custom REPL snippets to new output/repl window](https://github.com/BetterThanTomorrow/calva/issues/713)
- Fix: [Continuously evaluating in infinite loop](https://github.com/BetterThanTomorrow/calva/issues/712)

## [2.0.112] - 2020-07-30

- Fix: [Don't open output window until connect starts](https://github.com/BetterThanTomorrow/calva/issues/707)

## [2.0.111] - 2020-07-29

- [Handling ansi code by stripping it](https://github.com/BetterThanTomorrow/calva/issues/696)
- Fix: [Output window sometimes getting out of synch, needing overwrite](https://github.com/BetterThanTomorrow/calva/issues/699)
- Fix: [The _Calva says_ panel + output window opening at startup gets a bit too much](https://github.com/BetterThanTomorrow/calva/issues/702)
- Fix: [Repl connection fails if afterCLJJackInCode errors](https://github.com/BetterThanTomorrow/calva/issues/703)

## [2.0.110] - 2020-07-28

- [Fix Connect Fails on Windows](https://github.com/BetterThanTomorrow/calva/issues/694)

## [2.0.109] - 2020-07-27

- [New output/REPL window introduced](https://github.com/BetterThanTomorrow/calva/issues/681)

## [2.0.108] - 2020-07-24

- Fix [Jack-in error when choosing Clojure CLI + shadow-cljs project type](https://github.com/BetterThanTomorrow/calva/issues/675)
- Fix [Cannot use default connect sequences when custom connect sequences added](https://github.com/BetterThanTomorrow/calva/issues/685)
- Add analytics to debugger

## [2.0.107] - 2020-06-16

- Fix [Flicker matching brackets as code is typed](https://github.com/BetterThanTomorrow/calva/issues/673)

## [2.0.106] - 2020-06-16

- Fix [Crash - Lexing fails on comment w/ a 20+ hashes](https://github.com/BetterThanTomorrow/calva/issues/667)

## [2.0.105] - 2020-06-15

- Fix [Debug decorations are breaking after stepping through code during debug session](https://github.com/BetterThanTomorrow/calva/issues/669)

## [2.0.104] - 2020-06-14

- Fix [File lexing fails on junk characters inside strings](https://github.com/BetterThanTomorrow/calva/issues/659)
- [Use Pseudo-terminal instead of Task for Jack-in](https://github.com/BetterThanTomorrow/calva/pull/654)

## [2.0.103] - 2020-06-05

- Fix [Stream output messages to Calva Says as they're received](https://github.com/BetterThanTomorrow/calva/issues/638)
- Fix [highlighting of var quote before open token](https://github.com/BetterThanTomorrow/calva/issues/663)

## [2.0.102] - 2020-06-04

- Fix [Format Document sometimes causes Calva to stop working](https://github.com/BetterThanTomorrow/calva/issues/651)
- Fix [repl hanging after disconnecting debugger while repl window focused](https://github.com/BetterThanTomorrow/calva/issues/647)
- [Use a pseudo terminal for Jack-in - and stop (ab)using the Tasks system for this](https://github.com/BetterThanTomorrow/calva/pull/654)

## [2.0.101] - 2020-05-11

- [Paredit slurp outer form if current form is nested](https://github.com/BetterThanTomorrow/calva/issues/554)

## [2.0.100] - 2020-05-11

- Fix [clj-kondo exceptions thrown by debugger decorations code](https://github.com/BetterThanTomorrow/calva/issues/642)
- Move [warning for clj-kondo not found on classpath](https://github.com/BetterThanTomorrow/calva/issues/639) to Calva says output channel instead of window warning

## [2.0.99] - 2020-05-10

- Fix [Formatting top-level form stopped working](https://github.com/BetterThanTomorrow/calva/issues/640)

## [2.0.98] - 2020-05-04

- Fix [Problems Editing a Bare file (instead of directory)](https://github.com/BetterThanTomorrow/calva/issues/622)

## [2.0.97] - 2020-05-02

- Fix: [The New Indent engine doesn't follow block rules in ns :require #633](https://github.com/BetterThanTomorrow/calva/issues/633)
- Make the new indent engine the default
- Remove dependency on `paredit.js` from `calva-lib`

## [2.0.96] - 2020-04-29

- [Fix colors in suggestion popup (REPL window)](https://github.com/BetterThanTomorrow/calva/issues/623)
- Add "Instrument Top Level Form for Debugging" command and decorations for instrumented functions
- [Remove duplicate paredit.selectOpenList command in package.json](https://github.com/BetterThanTomorrow/calva/issues/629)

## [2.0.95] - 2020-04-25

- [Separate setting for highlighting current indent guide](https://github.com/BetterThanTomorrow/calva/issues/625)
- [Fix: Problems with v2.0.94 rendering performance ](https://github.com/BetterThanTomorrow/calva/issues/626)

## [2.0.94] - 2020-04-24

- [Rainbow indent guides](https://github.com/BetterThanTomorrow/calva/issues/620)

## [2.0.93] - 2020-04-21

- [Unclutter editor context menu when not in clojure files](https://github.com/BetterThanTomorrow/calva/issues/615)

## [2.0.92] - 2020-04-15

- [Changed all documentation links from https://calva.readthedocs.io/ to https://calva.io/](https://github.com/BetterThanTomorrow/calva/issues/604)
- Add step over, step into, and step out debugger features
- Add annotations for debugging to show debug values as the cursor moves to each breakpoint
- Fix debugger disconnect to show quit value instead of cider-nrepl exception
- Use visible editor if one exists with code being debugged, instead of opening a new one

## [2.0.91] - 2020-04-07

- [Add debugger](https://github.com/BetterThanTomorrow/calva/issues/469)

## [2.0.90] - 2020-04-06

- nREPL `eval` should always send along the `ns` parameter

## [2.0.89] - 2020-03-29

- [Add support for connecting to generic project types](https://github.com/BetterThanTomorrow/calva/issues/595)

## [2.0.88] - 2020-03-22

- [Change all references to `#calva-dev` so that they now point to the `#calva` Slack channel](https://clojurians.slack.com/messages/calva/)

## [2.0.87] - 2020-03-21

- [Fix: Two CLJ REPL Windows open on connect when `afterCLJReplJackInCode`is used](https://github.com/BetterThanTomorrow/calva/issues/593)
- [Add info to docs about how to get around `command not found` Jack-in problems](https://github.com/BetterThanTomorrow/calva/issues/591)

## [2.0.86] - 2020-03-19

- [Fix: REPL Window Paredit does not close strings properly](https://github.com/BetterThanTomorrow/calva/issues/587)

## [2.0.85] - 2020-03-15

- Fix: Make lein-shadow project type use lein injections

## [2.0.84] - 2020-03-15

- [Support projects using lein-shadow](https://github.com/BetterThanTomorrow/calva/issues/585)
- [Add documentation for how to use Calva with Luminus](https://calva.io/luminus/)

## [2.0.83] - 2020-03-13

- When format config fails to parse, fall back on defaults rather than crash
- [Fix: Var quoted symbols are treated as reader tags](https://github.com/BetterThanTomorrow/calva/issues/584)

## [2.0.82] - 2020-03-11

- Fix bug with bad formatting defaults when no config file

## [2.0.81] - 2020-03-11

- [Fix: Structural editing is a bit broken when reader tags are involved](https://github.com/BetterThanTomorrow/calva/issues/581)
- [Add cljfmt indent rules](https://github.com/BetterThanTomorrow/calva/issues/80)

## [2.0.80] - 2020-03-07

- Fix so that Paredit treats symbols containing the quote character correctly.
- [Fix: Parameter hints popup should be off by default](https://github.com/BetterThanTomorrow/calva/issues/574)
- [Fix: `nil` followed by comma not highlighted correctly](https://github.com/BetterThanTomorrow/calva/issues/577)
- [Fix: The syntax highlightning fails with symbols named truesomething/falsesomething](https://github.com/BetterThanTomorrow/calva/issues/578)
- Fix so that Paredit does not consider `^` to be part of a symbol name.

## [2.0.79] - 2020-03-01

- Use scope `variable.other.constant` for keywords, making them highlight nicely
- [Highlight/parsing/etc: Data reader tags are part of the tagged form](https://github.com/BetterThanTomorrow/calva/issues/570)

## [2.0.78] - 2020-02-28

- [Improve structural navigation through unbalanced brackets](https://github.com/BetterThanTomorrow/calva/issues/524)
- [Fix lexer going into some weird state after lexing certain patterns](https://github.com/BetterThanTomorrow/calva/issues/566)

## [2.0.77] - 2020-02-23

- [Make rainbow parens and highlight use the same lexer as Paredit](https://github.com/BetterThanTomorrow/calva/issues/561)
- [Fix: Some character literals throws paredit out of whack](https://github.com/BetterThanTomorrow/calva/issues/563)
- [Fix: Initial expand selection sometimes fails](https://github.com/BetterThanTomorrow/calva/issues/549)
- [Change line comment characters to ;;](https://github.com/BetterThanTomorrow/calva/issues/564)
- [Use editor namespace for custom REPL commands w/o `ns` specified](https://github.com/BetterThanTomorrow/calva/issues/558)
- [Add support for comment continuation](https://github.com/BetterThanTomorrow/calva/issues/536)

## [2.0.76] - 2020-02-12

- [Fix Calva locking up when opening files with very long lines](https://github.com/BetterThanTomorrow/calva/issues/556)

## [2.0.75] - 2020-02-01

- [Support cljs-suitable JavaScript completion](https://github.com/BetterThanTomorrow/calva/issues/552)
- [Fix Printing to Calva REPL prints <repl#7> before each print out](https://github.com/BetterThanTomorrow/calva/issues/548)

## [2.0.74] - 2020-01-12

- [Fix Windows documentation for Evaluate current form](https://github.com/BetterThanTomorrow/calva/issues/533)
- [Fix repl-window history issue](https://github.com/BetterThanTomorrow/calva/issues/491)
- [Fix documentation for Calva jack-in with REBL and Leiningen](https://github.com/BetterThanTomorrow/calva/issues/542)

## [2.0.73] - 2019-12-25

- [Add Paredit drag up/down commands](https://github.com/BetterThanTomorrow/calva/issues/500)
- [Add Paredit drag forward up/backward down commands](https://github.com/BetterThanTomorrow/calva/issues/500)

## [2.0.72] - 2019-12-13

- [Deselect text after surrounding with parens/braces/etc](https://github.com/BetterThanTomorrow/calva/issues/511)
- Fix: [Strict mode backspace/delete not deleting unbalanced brackets](https://github.com/BetterThanTomorrow/calva/issues/501)

## [2.0.71] - 2019-12-13

- Fix: [Autocompletion in REPL window broken](https://github.com/BetterThanTomorrow/calva/issues/519)

## [2.0.70] - 2019-12-12

- Fix: [REPL Window not accepting keys like cursor, return, etcetera](https://github.com/BetterThanTomorrow/calva/issues/516)

## [2.0.69] - 2019-12-12

- Fix: [Prepare for Fix of Webview editor font size bug](https://github.com/microsoft/vscode/commit/7e2d7965e5d5728c53996f0024be9b0681369b2a)
- Fix: [REPL window font broken](https://github.com/BetterThanTomorrow/calva/issues/515)

## [2.0.68] - 2019-12-11

- Fix: [(read-line) is being called twice from the REPL Window](https://github.com/BetterThanTomorrow/calva/issues/509)
- Fix: [Font size if visibly bigger in the REPL window](https://github.com/BetterThanTomorrow/calva/issues/152)

## [2.0.67] - 2019-12-10

- [Use markdown to format doc strings in hover](https://github.com/BetterThanTomorrow/calva/pull/503)
- [Add setting to enable doc strings in parameter hints](https://github.com/BetterThanTomorrow/calva/pull/503)
- Fix: [Select Backward \* commands won't grow selection in REPL window](https://github.com/BetterThanTomorrow/calva/issues/498)
- Fix: [Paredit select forward/backward add to the selection stack even when they don't select anything](https://github.com/BetterThanTomorrow/calva/issues/506)
- Fix: Calva disables cursor movement in non-clojure files when switching from REPL window to, say, a `.json` file.

## [2.0.66] - 2019-12-02

- Fix: [Cursor moves forward after undoing wraparound commands in REPL window](https://github.com/BetterThanTomorrow/calva/issues/499)
- Fix: Wrong keybinding for Toggle Paredit Mode, now is `ctrl+alt+p ctrl+alt+m`, as it should be
- Fix: [Force Delete Forward not working in REPL window in strict mode](https://github.com/BetterThanTomorrow/calva/issues/496)

## [2.0.65] - 2019-12-02

- [Make all Paredit selection commands shrinkable](https://www.reddit.com/r/Clojure/comments/e3zni2/a_paredit_visual_guide_calvas_paredit_docs/f9e7ujq/)
- Fix: [Raise Sexp/Form needs updated doc and shortcut keys](https://github.com/BetterThanTomorrow/calva/issues/495)

## [2.0.64] - 2019-12-01

- [Add Paredit commands **Push Form Left/right**](https://www.reddit.com/r/Clojure/comments/e3zni2/a_paredit_visual_guide_calvas_paredit_docs/f95v24w/)
- [Add Paredit command **Rewrap**](https://clojureverse.org/t/calva-paredit-just-got-majorly-better/5155/3)

## [2.0.63] - 2019-11-30

- Improve performance of editing Paredit commands
- Add command **Wrap Around ""**

## [2.0.62] - 2019-11-30

- Fix: [Tokenization errors with quotes, derefs, etcetera](https://github.com/BetterThanTomorrow/calva/issues/467)
- Fix: [Glitch in current form highlight in the REPL window when cursor is to the right of a form](https://github.com/BetterThanTomorrow/calva/issues/472)
- Now using the same Paredit implementation for the editor as for the REPL Window.
  - A much more complete set of Paredit commands, and [all documented](https://calva.io/paredit/), in beautiful GIF animations.
  - List based Paredit commands work on strings as well. (Limited by that strings don't have sub lists/strings).
  - Lots of fixes for Paredit commands.
- Fix: [Paredit not activated until focused moved from and back to the editor again](https://github.com/BetterThanTomorrow/calva/issues/454)
- Improving: [paredit `paredit-kill`](https://github.com/BetterThanTomorrow/calva/issues/380)
- Fix: [paredit `backspace` in strict mode](https://github.com/BetterThanTomorrow/calva/issues/379)
- Fix: [REPL window use it own set of paredit hotkeys and these are not configurable](https://github.com/BetterThanTomorrow/calva/issues/260)
- Add default keyboard shortcut maps for the REPL prompt: multi-line or single-line.
- Improvements for Commands using the **Current form** and **Current top level form**:
  - Fix: [Form selection fails on things like '(1)](https://github.com/BetterThanTomorrow/calva/issues/418)
  - Less precision needed for the right form to be selected.
  - All commands for this use the same implementation (so, you can use e.g. **Select Current Form** to know what **Evaluate Current Form** will evaluate).
- Fix: ["Load current Namespace in REPL Window" command not working](https://github.com/BetterThanTomorrow/calva/issues/477)
- Theme compatible status bar indicators for pprint and paredit

## [2.0.61] - 2019-11-15

- Fix: [paredit.deleteBackward sets cursor position wrong when deleting a line. ](https://github.com/BetterThanTomorrow/calva/issues/458)
- Fix: [Calva Highlight sometimes incorrectly recognizes form as a `comment` form](https://github.com/BetterThanTomorrow/calva/issues/403)
- Fix: [Expand selection fails at the start and end of the input of the REPL window](https://github.com/BetterThanTomorrow/calva/issues/417)
- [Add test message to test runner](https://github.com/BetterThanTomorrow/calva/issues/425)
- [Remove some paredit inconsistencies](https://github.com/BetterThanTomorrow/calva/issues/170)
- Fix: [Lexing regex literal tokenization](https://github.com/BetterThanTomorrow/calva/issues/463)

## [2.0.60] - 2019-11-11

- Re-enable default stylings for nREPL status bar items.
- Make `pprint` the default Pretty Printer.

## [2.0.59] - 2019-11-10

- [Enable information providers in jar files e.g. opened with the "Go to Definition" command](https://github.com/BetterThanTomorrow/calva/pull/455)
- [Make Pretty Printing more Configurable](https://github.com/BetterThanTomorrow/calva/pull/436)

## [2.0.58] - 2019-11-07

- [Incorrect red highlights around brackets/paren in specific case](https://github.com/BetterThanTomorrow/calva/issues/410)
- ["Require REPL Utilities" command is broken](https://github.com/BetterThanTomorrow/calva/issues/451)
- [Fix hover definition for symbols derefed with `@` and quoted symbols](https://github.com/BetterThanTomorrow/calva/issues/106)
- [Improve signature help-while-typing hover, with active arg markup](https://github.com/BetterThanTomorrow/calva/pull/450)

## [2.0.57] - 2019-11-03

- [Provide argument list help as you type the function's arguments](https://github.com/BetterThanTomorrow/calva/issues/361)
- [Support special forms in editor hover/completion](https://github.com/BetterThanTomorrow/calva/issues/441)

## [2.0.56] - 2019-11-02

- Add setting for wether to open REPL Window on connect or not
- [Re-open REPL windows where they were last closed](https://github.com/BetterThanTomorrow/calva/issues/300)
- Lexer performance considerably improved. Fixes [this](https://github.com/BetterThanTomorrow/calva/issues/228) and [this](https://github.com/BetterThanTomorrow/calva/issues/128))
- [REPL colours and logo a bit toned down](https://github.com/BetterThanTomorrow/calva/issues/303)
- Removed `useWSL`configuration option because the the use of Calva is fully supported through the [Remote - WSL](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl) extension.

## [2.0.55] - 2019-10-27

- [Add commands for interrupting the current evaluation as well as all running evaluations](https://github.com/BetterThanTomorrow/calva/issues/237)
- [Calva asks for user input when `stdin` needs it (e.g. `read-line`)](https://github.com/BetterThanTomorrow/calva/issues/377)
- Command for clearing the REPL history reworked and now also ”restarts” the REPL window.
- Commands are now added to REPL window history only if they are not identical to the previous command on the history stack.
- [Fix floating promises in evaluation module](https://github.com/BetterThanTomorrow/calva/issues/411)
- REPL Window Evaluation errors now initially hide the stack trace. The user can show it with a click.

## [2.0.54] - 2019-10-25

- [Stop linting, start bundling clj-kondo](https://github.com/BetterThanTomorrow/calva/issues/423)

## [2.0.53] - 2019-10-24

- [Fix hang when user input is requested](https://github.com/BetterThanTomorrow/calva/issues/377)
- Upgrade to `cider-nrepl 0.22.4`

## [2.0.52] - 2019-10-19

- [Add info box for VIM Extension users](https://github.com/BetterThanTomorrow/calva/issues/396)
- [Fix undefined namespace when starting a shadow-cljs cljs REPL Window ](https://github.com/BetterThanTomorrow/calva/issues/115)
- [Make opening the REPL window on connect async](https://github.com/BetterThanTomorrow/calva/issues/399)
- [Fix shadow-cljs menuSelections for Custom Connect Sequences](https://github.com/BetterThanTomorrow/calva/issues/404)

## [2.0.51] - 2019-10-15

- [Toggle the "Use WSL" setting requires extension restart to effect definition provider](https://github.com/BetterThanTomorrow/calva/issues/397)
- [Go to Definition and Peek Definition not working on Windows 10 when using WSL](https://github.com/BetterThanTomorrow/calva/issues/132)
- [Highlight extension settings are uninitialized if no closure editor active on activation ](https://github.com/BetterThanTomorrow/calva/issues/401)
- [Overly aggressive paredit in REPL window](https://github.com/BetterThanTomorrow/calva/issues/255)
- [REPL window use it own set of paredit hotkeys and these are not configurable](https://github.com/BetterThanTomorrow/calva/issues/260)
- [Completion in REPL window should work like in the editor](https://github.com/BetterThanTomorrow/calva/issues/394)

## [2.0.50] - 2019-10-15

- Move user documentation from the wiki to: https://calva.readthedocs.io/

## [2.0.49] - 2019-10-11

- [Fix bugs in comment form selection](https://github.com/BetterThanTomorrow/calva/issues/374)
- [Use of undeclared var in REPL window resets the namespace](https://github.com/BetterThanTomorrow/calva/issues/257)
- [Remove warning that extensions use the `vscode-resource:` scheme directly](https://github.com/BetterThanTomorrow/calva/issues/391)

## [2.0.48] - 2019-10-11

- [Support Jack-in without file open for single-rooted workspace](https://github.com/BetterThanTomorrow/calva/issues/366)
- [Show argument list of fn](https://github.com/BetterThanTomorrow/calva/issues/238)
- [Make code more robust in case Jack-in task fails](https://github.com/BetterThanTomorrow/calva/issues/367)
- [Fix dimming out of stacked ignored forms](https://github.com/BetterThanTomorrow/calva/issues/385)
- [The extension should specify the default schemes for document selectors](https://github.com/BetterThanTomorrow/calva/issues/368)

## [2.0.46] - 2019-10-08

- [Connect warnings and errors as popups](https://github.com/BetterThanTomorrow/calva/issues/356)
- [Don't remove default indents when Calva is not the auto-formatter](https://github.com/BetterThanTomorrow/calva/pull/383)

## [2.0.44] - 2019-10-05

- [Support for custom project/workflow commands](https://github.com/BetterThanTomorrow/calva/issues/281)

## [2.0.43] - 2019-10-03

- [Insourcing @tonsky's Clojure Warrior, now named Calva Highlight](https://github.com/BetterThanTomorrow/calva/pull/362)
- [Update status bar when configuration changed](https://github.com/BetterThanTomorrow/calva/issues/358)

## [2.0.42] - 2019-09-29

- [Adding selected calva commands to the editors context menu](https://github.com/BetterThanTomorrow/calva/issues/338)
- [Fix bug with painting all existing result decoration with the same status](https://github.com/BetterThanTomorrow/calva/issues/353)
- [Fix bug with reporting errors using off-by-one line and column numbers](https://github.com/BetterThanTomorrow/calva/issues/354)

## [2.0.41] - 2019-09-28

- [Add pretty print mode](https://github.com/BetterThanTomorrow/calva/issues/327)
- [Add command for evaluating top level form as comment](https://github.com/BetterThanTomorrow/calva/issues/349)
- [Stop writing results from **Evaluate to Comment** to output pane](https://github.com/BetterThanTomorrow/calva/issues/347)

## [2.0.40] - 2019-09-25

- [Add command for connecting to a non-project REPL](https://github.com/BetterThanTomorrow/calva/issues/328)
- [Add hover to inline result display, containing the full results](https://github.com/BetterThanTomorrow/calva/pull/336)
- [Better inline evaluation error reports with file context](https://github.com/BetterThanTomorrow/calva/issues/329)
- [Enhancement REPL window handling / nREPL menu button](https://github.com/BetterThanTomorrow/calva/issues/337)
- [Print async output, and a setting for where it should go](https://github.com/BetterThanTomorrow/calva/issues/218)
- [Fix REPL window prompt does not always reflect current ns](https://github.com/BetterThanTomorrow/calva/issues/280)
- [Escape HTML in stdout and stderr in REPL window](https://github.com/BetterThanTomorrow/calva/issues/321)
- [Add content security policy to webview and remove image load error](https://github.com/BetterThanTomorrow/calva/issues/341)

## [2.0.39] - 2019-09-20

- [Revert disconnecting and jacking out on closing of REPL window](https://github.com/BetterThanTomorrow/calva/issues/326)

## [2.0.38] - 2019-09-14

- [Close java processes when closing or reloading VS Code. (Windows)](https://github.com/BetterThanTomorrow/calva/issues/305)

## [2.0.37] - 2019-09-14

- [Support connecting to Leiningen and CLI project using shadow-cljs watcher](https://github.com/BetterThanTomorrow/calva/issues/314)
- Fix [Figwheel Main deps added to non-cljs projects](https://github.com/BetterThanTomorrow/calva/issues/317)

## [2.0.36] - 2019-09-12

- Fix [REPL Window namespace being reset to user](https://github.com/BetterThanTomorrow/calva/issues/302)
- Update nrepl-version to 0.22.1

## [2.0.35] - 2019-09-10

- [Customizing the REPL connect sequence](https://github.com/BetterThanTomorrow/calva/issues/282)
- [Support for launching with user aliases/profiles](https://github.com/BetterThanTomorrow/calva/issues/288)

## [2.0.34] - 2019-09-04

- More accurate code completion lookups.
- [Keep focus in editor when evaluating to the REPL Window](https://github.com/BetterThanTomorrow/calva/issues/229).

## [2.0.33] - 2019-08-17

- Support for starting leiningen and clj projects with aliases.

## [2.0.31] - 2019-08-13

- Support Jack-in and Connect in multi-project workspaces.
- Fix bug with snippet field navigation not working.

## [2.0.30] - 2019-08-04

- nREPL status bar indicator can now be styled

## [2.0.29] - 2019-08-04

- Fix jack-in command quoting for `zsh`.

## [2.0.28] - 2019-08-01

- Jack in quoting fixes, mainly for Windows with `clojure/clj`.
- Fix formatting bug when forms not separated by whitespace.

## [2.0.25] - 2019-07-12

- Add command for running test under cursor (at point in CIDER lingo).

## [2.0.24] - 2019-07-12

- Add ParEdit `forwardUpSexp`.

## [2.0.20] - 2019-06-20

- Improve custom CLJS REPL.

## [1.3.x -> 2.0.20] - -> 06.2019

... huge gap in the Changelog. Sorry about that, but now we have decided to pick up maintaining this log again.

## [1.3.0] - 2018-04-16

- Add support for [shadow-cljs](http://shadow-cljs.org). Please contact me with any information on how this is working for you out there.

## [1.2.14] - 2018-04-06

- Change all keyboard shortcuts to use prefix `ctrl+alt+v`, due to old prefix not working on some alternate keyboard layouts. See [Issue #9](https://github.com/PEZ/clojure4vscode/issues/9).

## [1.2.12] - 2018-04-06

- Add command for re-running previously failing tests (`ctrl+alt+v ctrl+t`).

## [1.2.10] - 2018-04-03

- Add command for toggling automatic adjustment of indentation for new lines (`ctrl+alt+v tab`)

## [1.2.8] - 2018-04-02

- Auto adjust indent more close to this Clojure Style Guide: https://github.com/bbatsov/clojure-style-guide

## [1.2.1] - 2018-03-28

- Select current (auto-detected) form

## [1.2.0] - 2018-03-28

- Terminal REPLs
  - Integrates REPL sessions from the Terminal tab and lets you do stuff like load current namespace ad evaluate code from the editor in the REPL.
- Connection and reconnection stabilization
  - Connecting the editor REPLs was a bit unstable. Now more stable (but there are still some quirks).

## [1.1.20] - 2018-03-25

- Auto detection of forms to evaluate now considers reader macro characters prepending the forms. E.g. before if you tried to evaluate say `#{:a :b :c}` with the cursor placed directly adjacent to the starting or ending curly braces only `{:a :b :c}` would be auto detected and evaluated.
- Highlighting of auto detected forms being evaluated.
- Rendering evaluation errors in the editor the same way as successful (but in red to quickly indicate that the evaluation errored).

![Evaluation demo](/assets/howto/evaluate.gif)

## [1.1.15] - 2018-03-20

- Evaluates vectors and maps with the same ”smart” selection as for lists.

## [1.1.11] - 2018-03-20

- Add inline annotations for interactive code evaluation results.

## [1.1.9] - 2018-03-18

- Add toggle for switching which repl connection is used for `cljc` files, `clj` or `cljs`.

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

- `clj` repl connected to all file types, meaning you can evaluate clojure code in, say, Markdown files.

## [1,1.3] - 2018-03-17

- User setting to evaluate namespace on save/open file (defaults to **on**)

## [1.1.1] - 2018-03-16

- Release of v1, based on **visual:clojure** v2.0, adding:
  - Running tests through the REPL connection, and mark them in the Problems tab
    - Run namespace tests: `ctrl+alt+v t`
    - Run all tests: `ctrl+alt+v a`
  - Evaluate code and replace it in the editor, inline: `ctrl+alt+v e`
  - Error message when evaluation fails
  - Pretty printing evaluation results: `ctrl+alt+v p`
  - Support for `cljc` files (this was supposed to be supported by the original extension, but bug)
