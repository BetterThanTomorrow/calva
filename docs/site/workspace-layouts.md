# Workspace Layouts

Project directory layouts can vary quite a lot. From the ”template” projects where the Clojure project files are at the root, to, well, let's just say that the project files are not always at the root. And sometimes there is more than one project.

Calva only really supports working with one project at a time per VS Code window. Here's a short guide for some different setups:

1. **You have one project in the workspace, the project files are in there somewhere.**
    * Use a regular VS Code ”folder window” or a Workspace proper, both will totally work.
1. **You have more than one project in the repository, but only really work with one at a tine.**
    * Use a Workspace proper and add the different project directories as seperate Workspace Folders.
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