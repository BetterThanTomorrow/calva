---
title: Workspace Layouts
description: Single project repos, monorepos, polyrepos, project directory layouts can vary quite a lot
---

# Workspace Layouts

Project directory layouts can vary quite a lot. From the ”template” projects where the Clojure project files are at the root, to, well, let's just say that the project files are not always at the root. And sometimes there is more than one project ([read here how to get clojure-lsp support with a Leiningen project in a subfolder](clojure-lsp.md#leiningen-project-in-subfolder)).

## How Calva Finds the Project Root

When you Jack-in or Connect, Calva searches the workspace for directories containing one of these project files:

* `deps.edn`
* `project.clj`
* `shadow-cljs.edn`
* `bb.edn`
* `basilisp.edn`

If only one project root is found, Calva uses it automatically. If multiple are found, you'll be prompted to pick one. Workspace root folders are always included as candidates even if they don't contain a project file.

The project file does not need to be at the workspace root. For example, if your workspace looks like this:

```
my-workspace/
  backend/
    deps.edn
    src/
      app.clj
```

Calva will detect `backend/` as a project root and Jack-in will work from any file inside it.

!!! Note
    You can control which directories are excluded from the search with the `calva.projectRootsSearchExclude` setting.

## Working with Projects

Calva only really supports working with one project at a time per VS Code window. Here's a short guide for some different setups:

1. **You have one project in the workspace, the project files are in there somewhere.**
    * Use a regular VS Code ”folder window” or a Workspace proper, both will totally work.
1. **You have more than one project in the repository, but only really work with one at a tine.**
    * Use a Workspace proper and add the different project directories as separate Workspace Folders.
    * You can only jack-in/connect to one project at a time.
1. **You have more than one project in the repository, and need to work with them in parallell.**
    * Open each project you want to work with in a separate VS Code window.


## One Folder - Two Windows?

As is mentioned in the [Calva Jack-In Guide](jack-in-guide.md), if you have a full stack project using a Clojure backend and a shadow-cljs frontend, you will need to open the same project in two separate VS Code windows, one for the backend and one for the frontend. This is how you can do that:

1. Open a new VS Code window.
2. Select *File->Add Folder to Workspace...*. Save the workspace as, say, `Server.code-workspace`.
3. Open a new VS Code window.
2. Select *File->Add Folder to Workspace...*. Save the workspace as, say, `Client.code-workspace`.

Now, whenever you want to Jack-in to the backend and/or frontend, do it from the **Server** and/or **Client** workspace, respectively.