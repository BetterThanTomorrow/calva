# Minimal mono-repo

To be used to check that the clojure-lsp behaves correctly with mono-repos and multiple open projects.

## Instructions:

+ Open just the project root and confirm that the clojure-lsp server is started in the root.
+ Add one of the `projects/` sub-directories to the same vscode workspace and confirm that there is still only a single lsp server booted
+ Confirm that go-to-definition works as expected across workspace folders

Open the `./distinct-workspaces.code-workspace` workspace to confirm that a total of two lsp-servers are started
