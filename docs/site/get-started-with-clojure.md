---
title: Get Started with Clojure
description: Welcome to a zero-install, interactive, guide to get you started with Clojure and Interactive Programming
search:
  boost: 10
---

# Get Started with Clojure

![Get Started with Clojure](images/getting-started-with-clojure/get-started-with-clojure-header-wo-header.png)

Welcome to a zero-install, interactive, guide to get you started with [Clojure](https://clojure.org/) using:

* [Clojure](https://clojure.org/)
* [Gitpod](https://www.gitpod.io/) (A development environment delivered via the web browser)
* [VS Code](https://code.visualstudio.com) (Or Gitpod Code, actually. In your web browser.)
* [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva) (A Clojure extension to VS Code. The thing this site is about.)
  * Calva's [Getting Started REPL](getting-started.md)

??? Note "I have VS Code and Java"
    Clojure runs on the JVM. How to install it is a big topic. Since you have already done that, you can, if you want, choose to install Calva in your local VS Code and fire up the [Getting Started REPL](getting-started.md). By all means read this page anyway, you can just skip the Gitpod parts.

    Also: _If you are using Windows_ your Java might have [a bug](https://bugs.java.com/bugdatabase/view_bug.do?bug_id=JDK-8266473) that [prevents things from working](https://github.com/BetterThanTomorrow/calva/issues/1162). Then you might want to defer fixing that and use the zero-install option first.

??? Note "Is Gitpod Code exactly as VS Code?"
    Almost! But, yeah, there are _some_ difference between regular VS Code and Gitpod's ditto. Most of it doesn't matter, but finding the main menu can be a bit tricky:
    ![Here is the menu in Gitpod VS Code](images/getting-started-with-clojure/gitpod-vscode-menu.png)

## What you'll learn

* The basics of the Clojure language (at least the start of the basics)
* The basics of the [ClojureScipt](https://clojurescript.org) language (we won't be using ClojureScript, but it is same language 😀)
* The basics of Calva (It's a bit as a side effect. You need it to learn Clojure this way, and by learning Clojure this way, Calva knowledge trickles in.)
* What is meant by, and some ways to perform, *Interactive Programming* (aka REPL Driven Development)
* Where to find Clojurians, i.e. folks who use Clojure and care about it (you will thus find help, the friendliest help you have ever seen a community provide)

??? Note "I am not convinced I should spend time on learning Clojure"
    Fair enough. We can recommend watching any or all of these videos to get excited about Clojure and the rather unique mood of development it offers:

    <iframe width="560" height="315" src="https://www.youtube.com/embed/C-kF25fWTO8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    
    * [Solving Problems the Clojure Way](https://www.youtube.com/watch?v=vK1DazRK_a0) - with Rafal Dittwald (using JavaScript, so no new syntax to grasp to get the message)
    * [Developer Ergonomics with VS Code, Clojure, and ClojureScript](https://www.youtube.com/watch?v=LR7Wv6bSZqE) - with Peter Strömberg
    * [Clojure in VS Code Workflow using FizzBuzz](https://www.youtube.com/watch?v=d0K1oaFGvuQ) - with Peter Strömberg

## What you won't learn

* How to install Clojure for your operating system of choice
* About various old and new build and dependency tools
* How to create projects and do real stuff

??? Note "Why won't I learn about this?"
    All in due time. 😄 It can be a bit confusing with all the things you find out about installing Clojure and creating projects when searching for information about it. We want you to relax about all that and just enjoy learning a bit about this fantastic programming language and the wonderful mode of development it offers.

    There is a lot of info about this out there already. And since you will learn where to find Clojurians, you will also find guidance. But we suggest do these things later. First, let's focus on having fun with Interactive Programming!

## What you need

* Curiosity about Clojure
* A web browser

??? Note "The browser ate my keyboard shortcuts!"
    There is always a competition for which system gets to catch keyboard shortcuts first. This worsens a bit when an application like VS Code runs in the web browser. Remember this if some shortcut/command doesn't work.

    On some machines, with some web browsers, some shortcuts are caught by the web browser and instead re-opening a closed tab or whatever. These have been observed:

    * Undo (undoing something web browser related)
    * Select the line (focusing the browser URL input)
    * Open the command palette (opening a private browsing window. Looking at you Firefox.)
    * Escape key shortcuts (are you using VIM bindings in your browser?)
    
    Sometimes the workaround is to redefine the shortcuts in VS Code, sometimes making your web browser stop catching the shortcut.

??? Note "I am new to VS Code"
    You might want to have a look at [this Getting Started with VS Code video](https://code.visualstudio.com/docs/introvideos/basics). (You can of course ignore the parts about installing for now.) Also, have [this overview of the VS Code interface](https://code.visualstudio.com/docs/getstarted/userinterface) handy.
    

## How it works

1. You will open an instance of VS Code in a development environment running in the browser. The envirnoment will have Java, Clojure tools, and Calva installed.
    * ???+ Note "Gitpod Sign-in"
           You will be asked to sign in to Gitpod, if you aren't already. You need to use the ”Sign in with GitHub” option.
2. Instructions will be automatically displayed (very brief such, because it is mainly about firing up the [Getting Started REPL](getting-started.md))
3. The guides are a mix of prose (in Clojure line comments), Clojure code, and exercises. What's extra poetic is that you will use Calva and Clojure to learn Calva and Clojure.

Use a desktop/laptop computer. Even if it actually works on the phone, it is far from convenient.

It sometimes takes a while (several minutes) for the environment to initialize. Take some deep breaths and be patient. 😎

### Let's go!

Ready? Awesome. Click this button to start the guide in a new browser tab.

<div style="display: flex; flex-direction: column; align-items: center;">

<a title="Open Getting Started with Clojure in Gitpod" alt="Open in Gitpod button" href="https://gitpod.io/#https://github.com/PEZ/get-started-with-clojure" target="_blank"><img src="https://img.shields.io/badge/Gitpod-Start the Clojure Guide-908a85?logo=gitpod" width="550"/></a>

<a href="https://gitpod.io/#https://github.com/PEZ/get-started-with-clojure">https://gitpod.io/#https://github.com/PEZ/get-started-with-clojure</a>

</div>


???+ Note "Stuck? Something not working? Or just unclear?"
     Please don't hesitate to reach out for help, should you get stuck. See below for where to find Clojurians. As for the Calva team, we are almost always (true story) to be found at the Clojurians Slack, especially in the `#calva` Channel. We are `@pez` and `@bringe` there.

Happy Interactive Programming! ❤️

## And where do I find those Clojurians?

We Clojurians inhabit a lot of community platforms. I'll list some of the more popular ones here in some order of popularity.

* [The Clojurians Slack](http://clojurians.net) - by far the largest and most active Clojure community, the `#beginners` channel is spectacularly fantastic
* [ClojureVerse](https://clojureverse.org) - a web forum. Lots of Clojurians, lots of Clojure knowledge collected, easy to search, easy to join
* [/r/Clojure](https://www.reddit.com/r/Clojure/) - Reddit when Reddit is at its best, lots of Clojurians here
* [Clojurians on Zulip](https://clojurians.zulipchat.com/) - An other web forum using the Zulip platform
* On Discord there are two active servers: [Clojurians](https://discordapp.com/invite/v9QMy9D) and [Discord](https://discord.gg/)

You can also ask questions, and find answers, about Clojure at [ask.clojure.org](https://ask.clojure.org)


## Learn and Practice Clojure using Rich 4Clojure

If you like the style of interactive learning that this guide provides, you should definitely check [Rich 4Clojure](https://github.com/PEZ/rich4clojure) out. It also can be used in the zero-installed way.

You can regard it as a companion to this guide. It is aimed at practicing Clojure, starting at the elementary levels, bringing you to advanced stuff.

??? Note "Can I use Rich 4Clojure instead of this guide?"
    We suggest you start by opening up this guide and do the Calva part of the excerises. Then use the `welcome_to_clojure.clj` guide in combination with **Rich 4Clojure**..

## Run the Clojure Exercism Track in your browser

In a similar manner to the Get Started with Clojure project, you can run the Clojure Exercism Track in your browser without installing anything and with full Interactive Programming enabled using this [Template project](https://github.com/PEZ/clojure-exercism-template).

## ClojureDocs

Clojurians draw tremendous value from [ClojureDocs](https://clojuredocs.org). At ClojureDocs the concise documentation for Clojure core functions, etcetera, are amended with examples and advice from fellow Clojurians. Crowdsourcing at its very best! It is a big part of the reason why you won't find an abundance of Clojure information at StackOverflow.

## Other learning resources

* [Clojure Beginner Resources](https://gist.github.com/yogthos/be323be0361c589570a6da4ccc85f58f) - a much more comprehensive list than this one
* [clojure.org Gettting Started](https://clojure.org/guides/getting_started) - the source of truth, includes installing and stuff
* [The Exercism Clojure track](https://exercism.io/my/tracks/clojure) - Learn solving carefully crafted Clojure exercises, get mentor feedback if you like.
* [Clojure for the Brave and True](https://www.braveclojure.com) - helping you from beginner to pretty advanced stuff, very popular among Clojurians
* [What do beginners struggle with?](https://clojureverse.org/t/what-do-beginners-struggle-with/5383) - a ClojureVerse thread, where you can tell us about what you have found hard in picking up Clojure. It's what spawned the creation of this guide.
* [on the code again](https://www.youtube.com/user/VideosDanA) - often features Clojure concepts, with snappy, well communicated, and entertaining videos
* [CalvaTV](https://www.youtube.com/c/CalvaTV) - Calva's YouTube channel often focuses on beginning with Clojure and ClojureScript. Subscribe, please!


## Help us help beginners

Give us feedback. Spread the word. Please consider:

* Join the `#improve-getting-started` channel at the Clojurian Slack
* Linking to this page from your blog
* Tweeting about this guide
* [Contributing to the Calva project](contribute.md)
* Wearing [Calva and RFC T-shirts](merch.md)
* Starring these repositories:
    * [Get Started with Clojure](https://github.com/PEZ/get-started-with-clojure) - (the repository powering this guide)
    * [Rich 4Clojure](https://github.com/PEZ/rich4clojure)
    * [Clojure Exercism Track Template](https://github.com/PEZ/clojure-exercism-template)
    * [Calva](https://github.com/BetterThanTomorrow/calva)
    * [Dram](https://github.com/BetterThanTomorrow/dram) - Where this guide (the Getting Started REPL) is authored

Please also consider other ways to [contribute](contribute.md).

Thanks! 🙏
