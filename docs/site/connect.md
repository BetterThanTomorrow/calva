# Connect Calva to Your Project

The recommended way is to:

## Jack-in: Let Calva start the REPL for you

This way Calva can make sure it is started with the dependencies needed for a working Clojure and/or ClojureScript session. This is often referred to as **Jack in** (because that is what it is called in CIDER).

Jack-in supports both CLJ and for CLJS, and has built-in configurations for **Leiningen**, **Clojure CLI**, and **shadow-cljs** projects, as well as for the CLJS repl types: **Figwheel Main**, **lein-figwheel** (legacy Figwheel), **shadow-cljs**, and Nashorn. Using jack-in provides your development environment with all the dependencies you need for Calva to work.

It works like so:

1. Open your project root directory in VS Code.
1. Issue the command **Start a Project REPL and Connect**: `ctrl+alt+c ctrl+alt+j`.
1. Answer the quick-pick prompts telling Calva about project types and what profiles to start.

See also: [Workspace Layouts](workspace-layouts.md)

!!! Note
    You must have a project file, such as `project.clj` for Leiningen or `deps.edn` for Clojure CLI, in the directory opened in VS Code in order for jack-in to work. If, after adding the project file, you experience an error during jack-in that says something could not be located, make sure you have the correct dependencies in your project file. For example, when using the **Figwheel Main** project type, you should have `com.bhauman/figwheel-main` in your project dependencies.

### Aliases, profiles, builds

When Jack-in starts it will depend on the project type, and whether ClojureScript is involved or not, and if it is, what kind of ClojureScript project, what will happen next. Calva will analyze the project files and will then give you prompts with selections based on what is found there.

You will need some basic knowledge about the project and the project type terminologies to answer the prompts.

There are ways to tell Calva the answers to these prompts beforehand, so that Jack-in can be a zero-prompting command. Read on.

### Customizing Jack-in

The main mechanism for customizing your Jack-in, including automating menu selections, and custom CLJS REPL types is [Custom Connect Sequences](connect-sequences.md).

There are also these settings:

* `calva.jackInEnv`: An object with environment variables that will be added to the environment of the Jack-in process.
* `calva.myCljAliases`: An array of `deps.edn` aliases not found in the project file. Use this to tell Calva Jack-in to launch your REPL using your user defined aliases.
* `calva.myLeinProfiles`: An array of Leiningen profiles not found in `project.clj`. Use this to tell Calva Jack-in to launch your REPL using your user defined profiles.
* `calva.openBrowserWhenFigwheelStarted`: _For Legacy Figwheel only._ A boolean controlling if Calva should automatically launch your ClojureScript app, once it is compiled by Figwheel. Defaults to `true`.

### Troubleshooting

I'm sure there are troubles we should mention here...

## Connecting w/o Jack-in

If, for whatever reasons, you can't use Jack-in with your project (possibly because the REPL is started as part of some other job) all is not lost. Old fashioned **Connect to a running REPL** is still there for you. For all features to work in Calva while connecting to a running REPL, your environment needs to have REPL related dependencies set up.

However, just as before it can be tricky to get the dependencies right. Consider using **Jack in** to inform yourself on how to start your REPL to Calva's satisfaction. When you use Jack in, Calva starts a VS Code task for it and the command line used is displayed in the terminal pane used to handle the task. Reading that command line tells you what dependencies are needed for your project.

Even better: Copying that command line gives you the command to start the REPL with the correct dependencies.

All this said, I still recommend you challenge the conclusion that you can't use Jack-in.
