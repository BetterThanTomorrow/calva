# Getting Started

Depending on wether you want to just start a Clojure REPL or you have a project you want to work with, getting started looks similar but a bit different. Regardless, you need to install Calva in VS Code.

## There's a ”Getting Started” REPL

If you are new to Calva, a good place to start is using the command **Fire up the ”Getting Started” REPL**. 

![Command Palette Start Standalone REPL](images/howto/start-hello-repl.png "Fire up the ”Getting Started” REPL")

It will open up a three files in a temporary directory, and start and connect a REPL. The files are:

- `hello-repl.clj` – The basics of how to evaluate code in Calva
- `hello-paredit.clj` - A super brief intro to Calva structural editing
- `hello-clojure.clj` - The very basics of the Clojure language

![Hello REPL](images/howto/hello-repl.png "hello-repl.clj")


The only prerequisite here is that you have Java installed. _No pre-installed clojure tools required._ (You will want to install these tools later, of course.)

!!! Note
    When you are more familiar with Calva, and want a standalone REPL, there is a separate command: **Start a standalone REPL (not in project)**. It will open up a `user.clj` in a temporary directory, containing only an `(ns user)` form, and start and connect the REPL. 

!!! Note2
    The command for starting the Getting Started REPL will download the files from [this repository](https://github.com/BetterThanTomorrow/dram). It is very much work in progress, and there is not even a finished Clojure Beginner's Guide there yet. WHen you run the command again, and from then on, you will get the option to download new files or keep using your existing. Downloading new ones will not overwrite your existing ones, because they will be downloaded to a new temp directory. You can find the directory easily using VS Codes context menu command for revealing a file in the Explorer/Finder.

## You have a Project?

If you are new to Calva, please consider the above option first. Then when it it will be time to get [Calva connected to the REPL of your project](connect.md).

## Clojure Resources

If you are new to Clojure or ClojureScript altogether, please check out the guide material on the respective official sites:

- [Getting Started with Clojure](https://clojure.org/guides/getting_started)
- [ClojureScript Quick Start](https://clojurescript.org/guides/quick-start)

There are also many great books on Clojure. [Clojure for the Brave and True](https://www.braveclojure.com/clojure-for-the-brave-and-true/) can be read for free online. It is a great resource for beginners.


Happy coding! ♥️
