---
title: ClojureDart
description: When writing your Dart and Flutter apps with ClojureDart, Calva is your friend
search:
  boost: 4
---

# Using Calva with ClojureDart

Since [ClojureDart](https://github.com/Tensegritics/ClojureDart) is Clojure, Calva just works with it. Calva is also automatically configured to make VS COde treat `.cljd` files as a Clojure code.

## Dart->Clojure Conversion

Similar to when using ClojureScript you will often find examples for Dart and Flutter written in, you guessed it, Dart. And then you will often wish there was a converter, because manually transpiling can be a bit tedious and error prone. Luckily you are in the Clojure community, and such a converter is provided: 

* [DartClojure](https://github.com/Liverm0r/DartClojure)

There are several ways you can leverage this converter, and since you are using Calva, a very convenient way is available. There is a command **Calva: Convert Dart code to Clojure/ClojureDart**. This command takes whatever text is selected and uses DartClojure to convert it. Lacking a selection, the command will use the whole file.

<video src="https://user-images.githubusercontent.com/30010/173013020-b1a267b1-6839-4c0f-8ebb-c5826a4e5b80.mp4" data-canonical-src="https://user-images.githubusercontent.com/30010/173013020-b1a267b1-6839-4c0f-8ebb-c5826a4e5b80.mp4" controls="controls" muted="muted" class="" style="width: 100%;"></video>

The workflow demoed in the video is something like so:

1. Open a new untitled file/tab
1. Paste your Dart/Flutter code in this file (VS Code will probably automatically figure out that it is Dart code, even if that doesn't matter for the converter.)
1. Run **Calva: Convert Dart code to Clojure/ClojureDart**
1. An, untitled, Clojure tab will open with the converted code in it.

NB: The conversion will not always work. DartCLojure is work in progress. See the project repo for limitations and scope. Often when conversion, the error message will give you a clue to what is problematic. Try adjust your code selection and you will probably be able to get at least some help from the converter.

Speaking of WIP...

## Work in Progress

ClojureDart is very new and being super actively developed. Some feature are still missing. Like a REPL. Once that is added we will also add ClojureDart [jack-in and connect](connect.md) support to Calva.

## Happy ClojureDart Hacking!

Please feel welcome to the #clojuredart and #calva channel at the Clojurians Slack for questions, suggestions and support.