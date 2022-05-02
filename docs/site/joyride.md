---
title: Joyride
description: Calva is your perfect companion when Joyriding VS Code.
---

# Using Calva With Joyride

[Joyride](https://github.com/BetterThanTomorrow/joyride) is a VS Code extension for user space scripting of VS Code itself. The scripting language for Joyride is the best you language imaginable: Clojure. And, as is proper for a Clojure implementation, it has a REPL, even an nREPL server.

This means you can connect Calva to Joyride and interactively develop your VS Code scripts.

This video shows Joyride in action, using Calva as the nREPL client.

<iframe width="560" height="315" src="https://www.youtube.com/embed/V1oTf-1EchU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## How to connect

0. Install [the Joyride Extension](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.joyride)
1. Issue the command **Joyride: Start nREPL server**
2. Issue the command **Calva: Connect to a REPL in your Project**
3. Select the project root: `<workspace-path>/.joyride`
4. Select the `joyride` project type
5. Submit the suggested `localhost:<port>` prompt

Happy Joyriding! ❤️