# Workspace layouts

Project directory layouts can vary quite a lot. From the ”template” projects where the Clojure project files are at the root, to, well, let's just say that the project files are not always at the root. And sometimes there is more than one project.

Calva only really supports working with one project at a time per VS Code window. Here's a short guide for some different setups:

1. **You have one project in the workspace, the project files are in there somewhere.**
  * Use a regular VS Code ”folder window” or a Workspace proper, both will totally work.
1. **You have more than one project in the repository, but only really work with one at a tine.**
  * Use a Workplace proper and add the different project directories as seperate Workplace Folders.
  * You can only jack-in/connect to one project at a time.
1. **You have more than one project in the repository, and need to work with them in parallell.**
  * Open each project you want to work with in a separate VS Code window.