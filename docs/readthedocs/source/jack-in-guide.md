# Learn about Calva Jack-in

*The Calva Jack-In Academy, by [@pez](https://github.com/PEZ)*

Like with [CIDER Jack-in](https://metaredux.com/posts/2019/11/02/hard-cider-understanding-the-jack-in-process.html), Calva's let-me-help-you-start-your-project-and-connect feature might seem a bit mysterious. It really is helpful, but also really isn't mysterious. Here are a few things about it that is good to know about.

## What it Solves

At first it might seem that something like `lein repl` in a terminal and then connecting Calva is enough. It sometimes might be, but only if you are in luck. To provide many of its IDE features, Calva relies on nREPL middleware, mainly [cider-nrepl](https://github.com/clojure-emacs/cider-nrepl) and, for ClojureScript, [piggieback](https://github.com/nrepl/piggieback). When starting your Clojure(Script) app and its REPL, it needs to be started with these dependencies satisfied. There are mainly three ways this can be achieved.

1. In the project definition (files like `project.clj`, `deps.edn`, `shadow-cljs.edn`, and combination of these).
2. In your user profile (files like `~/.lein/profiles.clj` and `~/.clojure/deps.edn`).
3. On the command line.

Because **1** and **2** are hard to keep in sync with the various editor environment people in your project might be using, Calva Jack-In is about **3**.

Ideally, you will be able to rid your project files completely of editor dependencies, when people working on the project can rely on the Jack-In features of their Clojure editor.

## A Controlled Shell Command

At its core Calva Jack-In is just a glorified, REPL-starting, command-line. No, it is more than that, but anyway. The command line can look like so for a Leiningen project using legacy Figwheel for its ClojureScript assistance:

```sh
lein update-in :dependencies conj '[nrepl"0.6.0"]' -- update-in :dependencies conj '[cider/piggieback"0.4.1"]' -- update-in :dependencies conj '[figwheel-sidecar"0.5.18"]' -- update-in :plugins conj '[cider/cider-nrepl"0.22.4"]' -- update-in '[:repl-options :nrepl-middleware]' conj '["cider.nrepl/cider-middleware"]' -- update-in '[:repl-options :nrepl-middleware]' conj '["cider.piggieback/wrap-cljs-repl"]' -- with-profile +dev repl :headless
```

Even if a bit long, it might look simple enough. But actually it has taken quite some effort to make Calva craft it. Shell quoting can be really tricky. Look at how `'[nrepl"0.6.0"]'` doesn't have a space between `nrepl` and the version. That was the only way I could find that was cross platform enough to make all supported shells parse the command line. (The trick relies on that the string is read by the super reliable Clojure Reader, which does not need that space to tokenize it.)

It is awesome that Clojure is used on so many platforms, but for a tool smith this also means more work. (I think Windows and its shell hell ate up about 95% of the many hours spent on getting the quoting good enough.)

The command-line crafted is then used to start a shell command that Calva controls, but we are getting ahead of ourselves...

## Project Types, Builds, Aliases, Profiles, etcetera

In order to cook the right command for your project, Calva looks for project files, reads them, and figures out what possible project types and ClojureScript tools could be involved. Then Calva presents you with a menu with the options it has found. You need to know enough about your project to answer this question. It looks like this in a shadow-cljs project that uses a `deps.edn` file for setting up its classpath.

![Calva Jack-In Project Types Prompt](https://user-images.githubusercontent.com/30010/68088862-66b70a80-fe63-11e9-81e0-099f12460a63.png)

(I know enough about this particular project to know that I should choose the `shadow-cljs` project type.)

But Calva isn't ready to cook the command-line just yet, depending on the project type, and contents of your project files, more info is needed. E.g. in the case of shadow-cljs projects, Calva needs to know what builds to start.

![shadow-cljs Builds to start](https://user-images.githubusercontent.com/30010/68088914-18eed200-fe64-11e9-842b-e3f0d1ed6b9f.png)

Here you can select any combination of builds defined in the project, and Calva will cook a command line that starts them.

You might get more prompts from Calva before it issues the command, but for this example project, Calva goes ahead, cooks the command line, and issues it. On my Mac, it looks like so:

```sh
npx shadow-cljs -d cider/piggieback:0.4.1 -d cider/cider-nrepl:0.22.4 watch :app
```

(Much shorter than the one with lein-figwheel, right? It is because shadow-cljs is aware of CIDER dependencies, so doesn't need as many dependencies specified as some other project types do.)

## Connecting

When the command is issued Calva needs to wait until the REPL Server is started, before connecting to it, and possibly continuing with starting a ClojureScript REPL and connect to that as well. It also needs to know which port to connect to.

Because reasons, Calva can't yet read the `stdout` of the shell command it has issued, so to know when the REPL server is started, and on which port, Calva monitors the filesystem for the `.nrepl-port` file. (This file is not always named like that. shadow-cljs, for instance, creates the file `.shadow-cljs/nrepl.port`.)

When the port file is created, Calva picks up the port number from it and connects to the nREPL server. At this point you have a Clojure REPL backing your Calva session, providing all sorts of nice IDE help for you.


## Starting Your Clojure App

Once you have the Clojure REPL connected you can start your Clojure app/server. See [Custom Connect Sequences](connect-sequences) for how to let Calva do this for you automatically. See the same article for ways to automate more of the Jack-in process. It can be brought down to a single **Jack-In** command, even for a full stack Clojure and ClojureScript application.

## ClojureScript

For ClojureScript, things are not done yet, though, far from it. It turns out that cooking the command line was the easy part.

In order for Calva to provide REPL power for ClojureScript projects, several things need to happen:

1. A Clojure nREPL connection needs to be established. We've covered that above. Calva makes an nREPL session clone to use for the ClojureScript REPL and then:
   1. Your ClojureScript app needs to be compiled.
   1. Your ClojureScript app needs to be started.
   1. The Clojure nREPL session needs to be promoted to a ClojureScript nREPL session. (This is what piggieback helps with.)

(It's also possible to connect Calva directly to a Nashorn, bare nodejs, or browser REPL, but let's stick to the scenario where you get a REPL into your running application.)

### Compiling the App and Watchers

Depending on ClojureScript project type, Calva uses different methods to start the compilation and the watcher:

* **Figwheel:** The compilation and the watchers are started in the Clojure REPL session. (This is both for Figwheel Main and for lein-figwheel.)
* **shadow-cljs:** The compilation and the watchers are started with the Jack-In command line.

This results in a bit of difference in the user interaction. Mainly that for shadow-cljs, the user needs to check the Jack-In Terminal tab to follow what's going on.

### Starting the App

Number **1.2** above, _the app needs to be started_, might seem obvious, but it actually trips many people up. Because of this, Calva goes to quite some lengths to provide assistance. Many projects are configured not to spawn a browser session automatically, requesting the app once it has been compiled, so we can't rely on that.

What Calva does instead is to monitor the output of the commands it uses for starting the compilation, looking for information that the app is ready to be requested/started. It then tells the user this, providing a URL, in case it is a browser app. (There are also settings where you can ask Calva to open the URL automatically for you, regardless what the project settings are.)

### Connecting

Meanwhile, Calva is monitoring the output and when it sees that the app is started, it continues to hook up the REPL connection to the editor.

This whole connection sequence is quite configurable, using [Custom Connect Sequences](connect-sequences). In fact, Calva's built in ClojureScript sequences (Figwheel Main, lein-figwheel, shadow-cljs, and Nashorn) are all built using those same settings mechanisms.

#### shadow-cljs is Less Managed by Calva
**NB:** The managed way in which Calva creates and connects the ClojureScript REPL breaks apart a bit for shadow-cljs, which works a bit differently and also outputs most of the information Calva is looking for on the `stdout` of the REPL start command (where Calva can't see it, remember?). We'll figure out a better way to support shadow-cljs, but for now, the user needs to do more of this figuring out, than is needed with Figwheel projects.

### Hack Away

So, there are things going on when you start Jack-In, and even more things for ClojureScript projects, but Calva tries to keep it together, so as a user it is a matter of paying attention and responding to a few prompts/menus with pre-populated options. (Prompts which can be configured away, even.)

### Switch ClojureScript Builds

Once the REPL is connected you might want to change which ClojureScript build you have Calva connected to. For this Calva has the **Select CLJS Build Connection** command. Please note that you can only switch between builds that you have started.


### Play with Starting the `cljs-repl` Yourself

To get a good grip on what is going on when creating and connecting the ClojureScript REPL, I can recommend making a custom connect sequence which leaves the REPL unpromoted (e.g. give it `nil` as `connectCode`), and then evaluate the `cljs-repl` start commands yourself. So for instance, promoting it to a Nashorn ClojureScript REPL looks something like so:

```clojure
user=> (require 'cljs.repl.nashorn)
user=> (cider.piggieback/cljs-repl (cljs.repl.nashorn/repl-env))
ClojureScript 1.10.145
To quit, type: :cljs/quit
nil
cljs.user=> |
```

It is the piggieback middleware there telling you that you can unpromote the REPL by ”evaluating” `:cljs/quit`.

### About Full Stack Applications

Because Calva uses the Clojure REPL connection to spawn the ClojureScript REPL, and because Calva only handles one Clojure REPL per VS Code window, some projects need special handling by the user.

If your full stack project is using shadow-cljs for the frontend, like [this Fulcro template project](https://github.com/fulcrologic/fulcro-template) does, maybe you first try Jack-In to your backend Clojure REPL, and then to your shadow-cljs frontend. This works if you do it in separate VS Code windows, but if you do it in the same window, the second Jack-In will kill the backend session!

See also about [Workspace Layouts](workspace-layouts.md) for tips about how to actually open the same project folder in two separate VS Code windows.

## Please Grab your Calva Jack-In Certificate

There, you now know all there is to know about Calva Jack-in.

Just kidding, there are a few more details to it, some of which might find their way into this article at a later time.

To really get to know it all, you will need to spend some time with the Calva Jack-In code. Head over to the [Calva Development Wiki](https://github.com/BetterThanTomorrow/calva/wiki) to learn how to hack on Calva.