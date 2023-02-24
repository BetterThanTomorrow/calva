# How the "repo" is structured

*Note: in the text below, the term repo refers to the folder `test-data/projects/mono-repo-2`,
as this is supposed to represent the root contents of a repo. `$repo` is used in this file to represent the repo root.*


The repo has a top level *"libs"* folder containing units of reusable code. Each lib
has its own `deps.edn`.

The repo also has top level *"projects"* folders (in this case just `project` but you can imagine multiple ones)
which represent units of deployment (i.e. an "application" that one might want to actually compile,package and deploy on its own).

To provide a more ergonomic view on an otherwise unwieldy repo, 
each project folder has a vscode workspace file with many values in the `folders` entry,
listing the project folder itself and all libraries relevant to the current project.
See `$repo/project1/project1.code-workspace` for example.

# Expected behavior

When we either:
- manually start the LSP server in the repo root
- add `"calva.enableClojureLspOnStart": "when-file-opened-use-furthest-project"` to a workspace (like the one listed above)

The following behaviours should occur:

- A single LSP server is started encompassing all projects and libs. It loads the config in `$repo/.lsp/config.edn`
- All projects and libs are linted according to the clj-kondo config in `$repo/.clj-kondo/config.edn`

How to test:
- open workspace `$repo/project1/project1.code-workspace`
- open `$repo/project1/src/mycorp/project1/core.clj`
- move the cursor to `mycorp.lib2.core`
- get all usual LSP functionality on all symbols in this namespace
- hit "jump to definition" in vscode
- get to `$repo/libs/lib2/src/mycorp/lib2/core.clj`
- get all usual LSP functionality on all symbols in this namespace
- get to `$repo/libs/lib1/src/mycorp/lib1/core.clj`
- get all usual LSP functionality on all symbols in this namespace
- make sure that `an-unused-var` is not linted (and thus the clj-kondo config is loaded)
- make sure that `an-unused-private-var` is linted