---
title: The Tao of Calva
description: Learn about the product and development philosophy that makes and shapes Calva 
---

# The Tao of Calva

[Calva](https://en.wikipedia.org/wiki/Calvados), the spirit, gains much of its taste and color from the Cider it is distilled from, and the oak it is matured in. I started to wonder what it is that shapes Calva, the [VS Code](https://code.visualstudio.com) Clojure Extension. I should know, being the master distiller, right?. Indeed. Poking some at the question, I do find that I have some answers.

Please read the following to learn what Calva is, and, to some extent, is not, about. Read it to get an idea about which path Calva is following, where we are headed with the project, and how you can contribute to the journey.

## Why Calva?

Calva's _raison d´être_ is to provide Visual Studio Code users with an easy to use and productive environment for [Clojure](https://www.clojure.org) and [ClojureScript](https://clojurescript.org) development. See the [Why Calva?](why-calva.md) page for some evidence that we are succeeding.

While Calva draws a lot of inspiration from [CIDER](https://cider.mx), [Cursive](https://cursive-ide.com), [Fireplace](https://github.com/tpope/vim-fireplace), and other Clojure development environments, it does not try to compete with them. Reading [r/Clojure](https://www.reddit.com/r/Clojure/) and elsewhere, it is easy to get the impression that the most common question is _"Which editor should I use for Clojure development?”_. I think a much more common question is _”How do I use my favorite editor for Clojure development?”_. For VS Code users, that is where Calva should be a good choice.

I also have an ambition to leverage VS Code for easing the path to Clojure. Given that it is the favorite editor for so many developers, it is important to have a good development environment in place on this platform, and to make it as easy to use as we possibly can, while also being productive and something that you want to stick with, once you are hooked on Clojure.

That said, and therefore: For people who want to start out with Clojure, and _do_ ask about what development environment would make it the most enjoyable, I'd like for Calva to be a really good option, an option so good that Clojurians feel they can recommend it.

## Design Goals

Calva should be easy to start with and productive enough to stick with. It should support _Clojure Best Practices_, and be pleasant and enjoyable to use. It should also be easy to hack on, and to contribute to. The ClojureScript story keeps getting more important. Calva should contribute to making the development experience with ClojureScript delightful.

### Easy to Start With

There are reasons as to why VS Code is so popular. Among those, one stands out to me: It is the most approachable code editor out there. There is nothing you need to learn when you start using it. The editor makes it obvious that you can start typing, deleting, cutting, pasting and undoing, without having to figure anything out. Then you learn how to bring up the command palette and get a boost few other environments can provide with such immediacy.

A language extension for VS Code can leverage this, by recognizing that what's old is old, and that what's new should be as easy as possible to pick up. Coming to a new language, people bring with them a lot of expectations from the languages they are used to. This is also true for the editor support. Syntax highlighting and formatting should just work, as should documentation lookup, linting and other IDE commodities.

Clojure brings some new concepts to the table. Chief among these: The REPL. It does take some time to grasp it. Calva needs to remove any obstacles it can when it comes to helping the user to reach the REPL, in order to help getting it, and start loving it.

To help the users to quickly focus on Clojure, we provide a package that is all-inclusive, with few knobs to turn, and with sane defaults for the knobs that still need to be there.

### Productive Enough to Stick With

I think VS Code brings inspiration also when it comes to following up its excellent _Getting Started_ story. You do not have to dig very deep under its surface to find that there is a lot more power to be unleashed. VS Code makes it easy to pick up more features as you get ready for it, and each little piece makes you more productive. To me, only Vim beats VS Code in this game.

Most often there should be no contradiction between **Easy to Start With** and **Productive**. Quite the contrary. This story is mainly about being feature complete with the most important tools. As beginners start to pick up the first few features, they should be rewarded with finding more productive tools when they go looking for them. The VS Code way is Calva's way.

### Pleasant and Enjoyable

Enjoyable starts with that Calva shouldn't be an experience full of pains. I think Calva is living up to this first bar of enjoyability. The next step is making it delightful!

Calva has two main assets it can leverage for being delightful to use: _Clojure_ and _VS Code_:

**Clojure is plain wonderful** and also has this totally awesome REPL thing. Wherever we can, Calva should use the REPL to make the editor spark and bring joy to the developer.

**VS Code is a sweet development environment**, offering its power in a consistent way across languages. Even if Clojure is very special, most of Calva's features are surfaced in the ways that VS Code encourages. It makes for less to learn for the user, and most often also makes it easier to implement functionality.

### Support Clojure Best Practices

Mainly, I think Stuart Halloway is right about the REPL being best used from inside the files you are editing rather than from the prompt. It doesn't mean that Calva's REPL window should be neglected, but efforts should be directed such that the file editor REPL is our first way to improve the experience. Expect the Calva REPL window to get much less ”in your face”, than it is today, as the editor REPL gets stronger.

Halloway also gives me some peace of mind with his reasoning of [keeping a _spartan_ setup](https://overcast.fm/+R1c1DEy7Y). Calva does not need to pack every feature imaginable. If we can get the right features in place, in the right way, the mission is accomplished.

Clojure is data centric. Calva should make it easy to examine data and how our code affects it. Today, this is not good enough when it comes to data structures larger than a few elements.

Clojure is a LISP. Thus Structural Editing is possible, and TBH, desirable. Calva should support this and encourage it. There is little we can do about Parinfer not playing well with VS Code, but there is Paredit, and Paredit rocks! [Calva's Paredit](paredit.md) plays in the top league of Paredits, for this reason.

## Made from the Produce of the Orchard

Calva is distilled from CIDER, which in turn is brewed from the products of [The Orchard](https://github.com/clojure-emacs/orchard). This makes a lot of Calva's features thin wrappers around [cider-nrepl](https://github.com/clojure-emacs/cider-nrepl) and related middleware. It also should mean that we strive for adding features by thinking ”The Orchard” first. If it lacks what we need, we should assist in providing it there. We need to up this game a bit from where we are today, I think.

## Leveraging clojure-lsp

Today, Calva draws a lot of its static power from [clojure-lsp](clojure-lsp.md). As does a lot of other Clojure tooling out there. The Calva and the clojure-lsp teams work very nicely together, which is something we cherish and should take care to maintain.

## Project Stewardship

Here Calva takes inspiration from many Clojure related projects, and perhaps most so from CIDER,[shadow-cljs](https://shadow-cljs.org), and clojure-lsp. Bozhidar Batsov, Thomas Heller, and Eric Dallo all lead their projects with clarity and with gusto. You can feel how they really care about their products and their users. They are there. They listen. They respond. And they relentlessly keep improving their products.

So we are there. We listen. We respond. And we keep trying to improve Calva.

The Calva team cares deeply about the user experience. That is a major part of why we do this. When implementing a new feature, or changing a feature, Ux is always the first thing on our mind. Personally, to keep that direction I often start with the documentation of the feature. Reading the documentation before implementation reveals a lot about if the Ux design is within the ballpark or not.

We have limited time on our hands, however, and we must cut some corners. We can't afford to spend very much time in Ux design. Rather we will use our Ux intuition, iterate the documentation quickly, and be fast to get things out. Then we are responsive in tweaking those things, based on user feedback. This also has impact on general quality at times. We only can do so much QA, and it happens that some releases of Calva cause disruptions in people's workflow because of things we haven't thought of, or not found during our testing. Again, we try to be attentive to feedback and quick to fix. Apologies in advance for any inconveniences caused!

A super major part of our love for Ux is that Calva should be serving its users. That's why we treat feedback as a gift, listen intently, and use the feedback as a major ingredient in shaping Calva.

Calva develops from user feedback in more direct ways as well. It is quite astonishing how many people have decided to improve on it by hacking it to do some small or big thing differently. That's great! We should make sure Calva is super easy to [contribute](contribute.md) to. 

There has been quite a lot of work put into improving the development process. Starting to hack on Calva is just a few steps, taking less than three minutes from cloning to running a dev version in the VS Code debugger. We encourage contributions, from the tiniest typo to whole new features. And we are ready to spend time helping people get their contributions integrated.

However, Calva can't be what everyone wants it to be, that would make it useless. It needs direction and aim. And it is we, the Calva Team, who are the stewards. We need to be in charge of what Calva is about, and what it is not about.

## The Road Ahead

Tying back to Stuart Halloway, I don't think he means that spartan needs to also mean poor. The products he helps to bring to the market tell another story. VS Code and Clojure brought together has the capacity to create something amazingly rich and luxurious. And I want Calva to tap into that potential.

On the Calva journey we will allow ourselves to change our minds about how things work. Calva is not a library. Its an interface between Clojure and human beings. Human beings can adapt. And they will need to enjoy adapting in order to enjoy Calva. 😄

By now it should be clear that you can expect Calva to keep evolving, keep being tended and maintained, and keep getting ever more enjoyable to use. Lately we have been improving Calva pretty rapidly. It would be great to keep it up like that, but I think it is good to expect a more humble and sustainable pace.

Calva is still quite new. A bit like freshly distilled Calvados. It will need time in those oak barrels to develop its full bouquet of flavors. And time is what we will give it. Our time, our creativity, and our passion.
