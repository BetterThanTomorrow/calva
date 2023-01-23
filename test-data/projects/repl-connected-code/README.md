# Issue #2025 repro

Issue #2025 reports that if there is no active editor, evaluating `afterCLJReplJackInCode` of a [REPL Connect Sequence](https://calva.io/connect-sequences/) fails.

This project has a connect sequence with a simple `afterCLJReplJackInCode` code snippet. It works nicely if there is an editor active when jacking in or connecting the REPL. But without an active editor the code isn't run. Repro:

1. Open this project in VS Code.
2. Close any editors that are open.
2. Jack-in, selecting the **Test broken jack-in code evaluation** sequence.

* **Expected**: `"afterCLJReplJackInCode evaluated"` is printed in the REPL window
* **Actual**: `; Evaluation failed.` is printed in the REPL window
