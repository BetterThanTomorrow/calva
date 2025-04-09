---
title: Joyride
description: Calva is your perfect companion when Joyriding VS Code.
---

# Using Calva With Joyride

[Joyride](https://github.com/BetterThanTomorrow/joyride) is a VS Code extension for user space scripting of VS Code itself. You find the extension [here](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.joyride). The scripting language for Joyride is the best you language imaginable: [Clojure](https://clojure.org). And, as is proper for a Clojure implementation, it has a REPL, even an nREPL server.

This means you can connect Calva to Joyride and interactively develop your VS Code scripts.

This video shows Joyride in action, using Calva as the nREPL client.

<iframe width="560" height="315" src="https://www.youtube.com/embed/V1oTf-1EchU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## How to connect

Once you have the Joyride extension installed you can start its REPL and connect Calva to it (a.k.a **Jack-in**).

!!! Info "Start the Joyride REPL and Connect"

    This **1 minute** video shows the following steps:

    1. Installing [the Joyride Extension](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.joyride)
    1. Issuing the command **Calva: Start a REPL in your Project and (a.k.a Jack-in)**
       - Selecting `joyride` project type
    1. Issuing the command **Calva: Load/Evaluate Current File and its Requires/Dependencies**
    1. Evaluating some non-vscode code
    1. Evaluating code exercising something from the [VS Code API](https://code.visualstudio.com/api)

    (Right-click the video and choose <strong>Full Screeen</strong> if it is too tiny embedded.)

    <video src="https://user-images.githubusercontent.com/30010/167246562-24638f12-120b-48e9-893a-7408d5beeb77.mp4" data-canonical-src="https://user-images.githubusercontent.com/30010/167246562-24638f12-120b-48e9-893a-7408d5beeb77.mp4" controls="controls" muted="muted" class="" style="width: 100%;">

## How to Get Started with Joyride

The [Joyride README](https://github.com/BetterThanTomorrow/joyride/blob/master/README.md) has some Quick Start pointers for you. Please feel invited to the `#joyride` channel on the [Clojurians Slack](http://clojurians.net) and chat with us and other Joyride users.

Come on, Join the Joyride! ❤️