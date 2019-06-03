# The Calva Journey Continues - Welcome to Jack in

[Calva](https://github.com/BetterThanTomorrow/calva), an easy to start with, and easy to use, environment for productive Clojure and ClojureScript coding, was just updated with features significant enough for me to sometimes refer to it as Calva 2. In fact, up to now, it couldn't really be said that it was easy to get started with Calva.

Please upgrade Calva and say goodbye to soul crushing, getting started issues, thanks to the [Cider](https://github.com/clojure-emacs/cider) inspired **Jack-in** command, and say hello to the brand new REPL Window. Calva also has a friendly new logo, thanks to @EccentricJ:

![Calva logo](/assets/calva-64h.png)

The goal with Calva is to leverage the ease of use of [Visual Studio Code](https://code.visualstudio.com/) to provide an environment where starting with Clojure is as smooth as possible.

## Jack-in

We have brought the Getting Started story from *reading pages of instructions and trial-and-horror with your profiles and/or project files*, to a simple command: *Calva Jack-in*. Inspiration is taken from Cider.

Calva Jack-in injects the dependencies Calva needs to power your work. It supports [Leiningen](https://leiningen.org), [shadow-cljs](http://shadow-cljs.org) and [clj/deps](https://clojure.org/guides/deps_and_cli). (Boot support to be added.) ClojureScript support is an important part of Calva and a lot of effort has been put into making the Jack-in help here. Calva will, via prompting, inject any necessary shadow-cljs, Figwheel or Figwheel Main dependencies.

We hope Calva with Jack-in will help make Clojure and ClojureScript more accessible to new users.

## The new REPL Window Improves Support for Interactive Programming

![Calva REPL Window Screenshot](/assets/repl-window-screenshot.png)

Experienced Clojurians, as well as new users of the language, are now much better served in their interactive development. Some of the features of the new REPL Window are:
* A sweet code editor:
  * Smooth Clojure code formatting
  * Structural editing powered by Paredit
  * Syntax highlighting
  * Code completion
  * Command history
* Deep integration with the rest of Calva:
  * Commands for using the REPL Window to evaluate code in the edited files.
    * Automatic and temporary switching of the REPL window namespace when evaluating forms in editor files.
  * Keeping the predictable switching between Clojure and ClojureScript REPLs that the Calva powered file editors introduced.
* Much improved results reporting:
  * Syntax highlighted
  * Pretty printed
  * Clear differentiation of evaluation results, output, and errors.
  * Stack traces with deep links into the code.

This is quite huge. Yes, certainly in terms of increased value to the Clojure developer using VS Code, but also in terms of what it actually took to bring this UI into VS Code, which lacks all the native UI building blocks to support this, except for WebViews.

This meant that the REPL window and its code editor had to be written completely from scratch. Think something like the essentials of Code Mirror. I can only take partial credit for this, as I would never have been able to code this myself. Most of the coding is the work of **Matt Seddon**, where I have been acting the product owner, first line tester, bug fixer, and now maintainer.

The Paredit powering the new REPL window is also written from scratch, by the way. This means we will be able to improve a lot on the Current Paredit implementation in Calva, which relies on an abandoned project. And the new Paredit is powered by careful Clojure code lexing, opening up for more predictable and precise code analysis and editing than before.

In summary, the new REPL window delivers more value today, and its underpinnings promises we can more easily deliver even more value in the coming releases.

## Get Started with Clojure on VS Code.

It really is super easy:

1. Install VS Code.
2. Install Calva (via the *Extensions* pane). 
3. Open a Clojure(Script) file in the root of your project.
4. Issue the command **Start a project REPL and connect (aka Jack-in)**, `ctrl+alt+c ctrl+alt+j`

Besides REPL power, Calva includes code formatting, Paredit, and some little Parinfer support, so you are quite set. It also bundles [Clojure Warrior](https://github.com/tonsky/clojure-warrior) which brings in rainbow parens and highlighting of unmatched parens. Clojure Warior brings sane highlighting of *matching* parens, and Calva therefore disables VS Code's confusing/broken paren highlighting.

See the [Calva README](https://github.com/BetterThanTomorrow/calva/blob/master/README.md) and [Wiki](https://github.com/BetterThanTomorrow/calva/wiki) for more information on usage. And of course, feel warmly welcome to join the [#calva-dev](https://clojurians.slack.com/messages/calva-dev/) channel on the Clojurians Slack to get support, discuss Calva ideas, or just to cheer us on.

## The Future of Calva

The new REPL window and Jack-in enables the awesome VS Code editor to be much more useful for Clojure work. It is far from at par with Cider and Cursive, still, but we are moving along, trying to make Calva a viable option for people who like to keep using VS Code.

Now starts a period where most Calva development will be directed at supporting the *new-to-Clojure* users. We have received some great feedback lately, so we know about many of the things that trip new users up, and we plan to contribute to Clojure by making Calva ease the path.

However, do not expect lightning speed. Calva is maintained mostly by me (Peter Strömberg a.k.a. PEZ) alone. I have a demanding day job and can only devote so much time to Calva.

It is a blessing that some other people have done lots of the hard work to make the building blocks of Calva, I don't want to risk forget anyone by starting to mention projects, but I must mention [The Orchard](https://github.com/clojure-emacs/orchard), which is where Calva finds most of the Cider it is distilled from. Thanks, @bbatsov, you rock! I'd like to also express my gratitude to @thheller who not only provides shadow-cljs, which is an important part of the Calva development toolchain, but also for his patience with my stupid questions.

❤️ Happy Clojure and ClojureScript Coding! ❤️