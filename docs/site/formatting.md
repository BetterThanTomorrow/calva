---
title: Clojure Formatting
description: Conforming to the Community Styleguide by default, and it just works
---

# Formatting

We have tried to make Calva's formatter so that it _just works_. It is enabled by default for Clojure files, and unconfigured it mostly follows Bozhidar Batsov's [Clojure Style Guide](https://github.com/bbatsov/clojure-style-guide). Calva uses [cljfmt](https://github.com/weavejester/cljfmt) for the formatting.

!!! Tips
    Calva's code formatter sets the default keybinding of its **Format Current Form** command to `tab`. Meaning that most often when things look a bit untidy, you can press `tab` to make things look pretty. Good to know, right? For performance reasons it only formats the current enclosing form, so sometimes you want to move the cursor up/out a form (`ctrl+up`) first. See [The Paredit Guide](paredit.md) for more on moving the cursor structurally through your code.

With the default settings, Calva's formatting behaves like so:

* formats as you type (when entering new lines)
* formats the current enclosing form when you hit `tab`
* formats pasted code
* formats according to community standards (see above link)
* formats the current form, _aligning map keys and values_, when you press `ctrl+alt+l`
* formats `(comment ..)` forms special, see [rich comments](#rich-comments)

Also: If you have **Format on Save** enabled in VS Code, it will be Calva doing the formatting for Clojure files.

Calva's formatting is mostly about indenting, but it also (again, defaults):

* trims whitespace at the end of the line
* trims whitespace inside brackets
    * this also folds trailing brackets (a k a _the paren trail_) up on the same line
* inserts whitespace between forms

Not a fan of some default setting? The formatter is quite configurable.

## Configuration

There are settings for the general behaviour of Calva formatting as well as for configuring `cljfmt`, which is the formatting engine used.

| Setting | Description | Default
| ------- | ----------- | -------
| `calva.fmt.newIndentEngine` | Fast indentation. When disabled, a full formatting will be done on the current enclosing form. | **true**
| `calva.fmt.experimental.fullFormatOnType` | Experimental: Formats forms starting on the same line, forwards from the cursor as you enter or delete text. Also enabled as part of [Parinfer](parinfer.md) mode (`inferParensAsYouType`) | **false**
| `calva.fmt.experimental.inferParensAsYouType` | Experimental: [Parinfer](parinfer.md) mode | **false**
| `calva.fmt.keepCommentTrailParenOnOwnLine` | See [Rich Comments](rich-comments.md) | **true**

Calva's auto-formatter will reformat forms that are directly affected by your edits, and it will automatically indent new lines to match your `cljfmt` indentation settings. See below.

### cljfmt

You configure Calva's formatting using [cljfmt's configuration EDN](https://github.com/weavejester/cljfmt#configuration). This means that you can adjust the above mentioned defaults, including the indenting.

!!! Note
    The `cljfmt` docs mention the `:cljfmt` config key of Leiningen projects. Calva does not yet read the config from there, so if your Leiningen project has such a configuration, you will need to copy it out into a file.

To start changing the Calva formatting defaults, paste the following map into a file and save it. It could be somewhere in the project workspace, or some other place, depending on your requirements:

```clojure
{:remove-surrounding-whitespace? true
 :remove-trailing-whitespace? true
 :remove-consecutive-blank-lines? false
 :insert-missing-whitespace? true
 :align-associative? false}
```

Then set `calva.fmt.configPath` to the path to the file. The path should either be absolute, or relative to the project root directory. So, if you named the file `.cljfmt.edn` and saved it in the root of the project, then this setting should be `.cljfmt.edn`.

Since you are editing the file in Calva (you are, right?), you can quickly test how different settings affect the formatting. Try:

1. setting `:align-associative` to `true`
2. then save
3. then hit `tab`, and see what happens.

(This particular setting is experimental and known to cause trouble together with namespaced keywords. Consider using `ctrl+alt+l` instead of `tab` as your formatting command, instead of enabling this setting.)

!!! Note
    The hot reloading of the config file only works for config files inside the project directory structure.

### Indentation rules

The `cljfmt` indents are highly configurable. They, and the rest of the configuration options, are masterly detailed [here](https://github.com/weavejester/cljfmt#configuration).

Calva is an extra good tool for experimenting with these settings. `cljfmt` doesn't care about keys in the map that it doesn't know about so you can sneak in test code there to quickly see how it will get formatted by certain rules. Try this, for instance:

```clojure
{:remove-surrounding-whitespace? true
 :remove-trailing-whitespace? true
 :remove-consecutive-blank-lines? false
 :insert-missing-whitespace? false
 :align-associative? false
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

To encourage use of `(comment ...)` forms for development, these forms get a special treatment when formatting. See [Rich Comments](rich-comments.md).
