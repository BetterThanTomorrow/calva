# Using Calva with Remote Development

[VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview) is a new feature in version 1.35 of VS Code that allows a developer to use a container, remote machine, or the Windows Subsystem for Linux (WSL) as a full-featured development environment.

I would recommend reading the [introductory blog post](https://code.visualstudio.com/blogs/2019/05/02/remote-development) and watching the videos. I find the feature extremely exciting and wish more IDEs would implement something like it.

From a Clojure perspective it allows you to have VS Code installed on your Java-less, Clojure-less hardware and still use it to develop Clojure through it.

## A use-case

- For some reason your physical computer has to be running Windows (organizational rules etc.)
- Your deployment environment is Linux
- You want to edit files in an editor running on your physical computer
- Most Clojure tooling is made with *nix first in mind and there are incompatibilities with Windows

## WSL

See [Using Calva with WSL](wsl.md)
