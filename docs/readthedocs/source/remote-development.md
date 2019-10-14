# Using Calva with Remote Development

[VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview) is a new feature in version 1.35 of VS Code that allows a developer to use a container, remote machine, or the Windows Subsystem for Linux (WSL) as a full-featured development environment.

I would recommend reading the [introductory blog post](https://code.visualstudio.com/blogs/2019/05/02/remote-development) and watching the videos. I find the feature extremely exciting and wish more IDEs would implement something like it.

From a Clojure perspective it allows you to have VS Code installed on your Java-less, Clojure-less hardware and still use it to develop Clojure through it.

## A use-case

- for some reason your physical computer has to be running Windows (organisational rules etc.)
- your deployment environment is Linux
- you want to edit files in an editor running on your physical computer
- most Clojure tooling is made with *nix first in mind and there are incompatibilities with Windows

## Steps I took to try Calva with remote development in WSL

_Disclaimer: I only went as far as trying it in a very basic scenario so I don't know yet if there are any caveats down the line._

1. Windows 10 Home
1. Enable WSL
1. Install Ubuntu in WSL
1. Install Java in WSL
1. Install latest Clojure in WSL
1. Install the Remote - WSL extension in VS Code
1. Launch remote window
1. Install Calva (gets installed into the WSL instance)
1. Work away