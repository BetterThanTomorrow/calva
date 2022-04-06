---
title: Clojure Formatting
description: Community Styleguide conforming formatting by default. And it just works.
---

# Formatting

We have tried to make Calva's formatter so that it _just works_. It is enabled by default for Clojure files, and with the default configuration it mostly follows Bozhidar Batsov's [Clojure Style Guide](https://github.com/bbatsov/clojure-style-guide). Calva uses [cljfmt](https://github.com/weavejester/cljfmt) for the formatting.

!!! Tips "Tab formats the current surrounding form"
    Calva's code formatter sets the default keybinding of its **Format Current Form** command to `tab`. Meaning that most often when things look a bit untidy, you can press `tab` to make things look pretty. Good to know, right? For performance reasons it only formats the current enclosing form, so sometimes you want to move the cursor up/out a form (`ctrl+up`) first. See [The Paredit Guide](paredit.md) for more on moving the cursor structurally through your code.

With the default settings, Calva's formatting behaves like so:

-   indents as you type (when entering new lines)
-   formats the current enclosing form when you hit `tab`
-   formats pasted code
-   formats according to [community standards](https://github.com/bbatsov/clojure-style-guide)
-   formats the current form, _aligning map keys and values_, when you press `ctrl+alt+l`
-   formats `(comment ...)` forms special, see [rich comments](#rich-comments)

!!! Tips "Infer parens at will"
    Calva has a command that will ”heal” the bracket structure if it is correctly indented using Parinfer **Infer parens**. This command is default bound to `ctrl+alt+p i`.

Also: If you have **Format on Save** enabled in VS Code, it will be Calva doing the formatting for Clojure files.

Calva's formatting is mostly about indenting, but it also (again, defaults):

-   trims whitespace at the end of the line
-   trims whitespace inside brackets
    -   this also folds trailing brackets (a k a _the paren trail_) up on the same line
-   inserts whitespace between forms

Not a fan of some default setting? The formatter is quite configurable.

## Configuration

You configure Calva's formatting using [cljfmt's configuration EDN](https://github.com/weavejester/cljfmt#configuration). This means that you can adjust the above mentioned defaults, including the indenting.

This configuration can either be provided via a file or via clojure-lsp (see [Clojure LSP Settings](https://clojure-lsp.io/settings/)).

??? Note "Only use the clojure-lsp config option if you need it"
    The option to read formatting config from clojure-lsp is there to let teams where some members use clojure-lsp for formatting, share the config. To provide the settings via clojure-lsp, set `calva.fmt.configPath` to `CLOJURE-LSP` (case sensitive). However, there are limitations:
    
    1. There is no config hot reloading support (see below)
    1. clojure-lsp's cljfmt config is special in that it does not support regular Clojure syntax for regular expressions. This can make it difficult to run cljfmt as part of a CI pipline.

??? Note "No Leiningen config support"
    The **cljfmt** docs mention the `:cljfmt` config key of Leiningen projects. Calva does not yet read the config from there, so if your Leiningen project has such a configuration, you will need to copy it out into a file.

If providing settings via a file, start changing the Calva formatting defaults by pasting the following map into a file and save it. It could be somewhere in the project workspace (supporting hot reload), or some other place (no hot reload), depending on your requirements:

```clojure
{:remove-surrounding-whitespace? true
 :remove-trailing-whitespace? true
 :remove-consecutive-blank-lines? false
 :insert-missing-whitespace? true}
```

Then set `calva.fmt.configPath` to the path to this file. The path should either be absolute, or relative to the project root directory. So, if you named the file `.cljfmt.edn` and saved it in the root of the project, then this setting should be `.cljfmt.edn`.

Since you are editing the file in Calva (you are, right?), you can quickly test how different settings affect the formatting. Try:

1. Adding `:align-associative? true` to the config
2. then save
3. then hit `tab`, and see what happens.

??? Note "`:align-associative?` is experimental"
    This particular setting is experimental and known to cause trouble together with namespaced keywords. Consider using `ctrl+alt+l` instead of `tab` as your formatting command, instead of enabling this setting. See below for more info about this. See [more below](#about-aligning-associative-forms) about this.

!!! Note "Hot reloding requirements"
    The hot reloading of the config file only works for config files inside the project directory structure. And if you are providing the settings via clojure-lsp: no hot-reload for you.

### About aligning associative forms

Calva loooks in the config map for the key `:align-associative?` and if it is `true` it will use an old version of **cljfmt** which is [patched](https://github.com/weavejester/cljfmt/pull/77) with functionality for doing this alignment. Note, though:

* The implementation is a bit buggy and can do a bit crazy formatting on certain forms.
* The older version of cljfmt lacks updates for some new Clojure features and also some bugs fixed since the fork are not applied.

You are hereby warned, and let us also remind you about the **Format and Align Current Form** command which lets you apply this formatting a bit more surgically, and on demand.

This old version of **cljfmt** is inlined in the Calva repository along with the discontinued `rewrite-cljs` project. Regard it as frozen code. If you want Calva's formatter to have full support for newer Clojure constructs and the bugs in the alignment code fixed, contribute to **cljfmt**. See [this issue](https://github.com/weavejester/cljfmt/issues/36) for starting to collect context.

### Indentation rules

The `cljfmt` indents are highly configurable. They, and the rest of the configuration options, are masterly detailed [here](https://github.com/weavejester/cljfmt#configuration).

Calva is an extra good tool for experimenting with these settings. `cljfmt` doesn't care about keys in the map that it doesn't know about so you can sneak in test code there to quickly see how it will get formatted by certain rules. Try this, for instance:

```clojure
{:remove-surrounding-whitespace? true
 :remove-trailing-whitespace? true
 :remove-consecutive-blank-lines? false
 :insert-missing-whitespace? false
 :indents ^:replace {#"^\w" [[:inner 0]]}
 :test-code
 (concat [2]
         (map #(inc (* % 2))
              (filter #(aget sieved %)
                      (range 1 hn))))}
```

Save, then hit `tab`, and the code should get formatted like so:

```clojure
 :test-code
 (concat [2]
    (map #(inc (* % 2))
      (filter #(aget sieved %)
        (range 1 hn))))
```

That's somewhat similar to Nikita Prokopov's [Better Clojure Formatting](https://tonsky.me/blog/clojurefmt/) suggestion. (Please be aware that this setting might not be sufficient to get complete **Tonsky Formatting**, please share any settings you use to get full compliance.)

## Rich Comments

To encourage use of `(comment ...)` forms for development, the deafult settings give these forms get a special treatment when formatting. Use the `calva.fmt.keepCommentTrailParenOnOwnLine` setting to control this behaviour. See [Rich Comments](rich-comments.md) first.
