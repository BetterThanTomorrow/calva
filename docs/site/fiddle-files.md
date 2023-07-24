---
title: Fiddle Files Support
description: Power up you Interactive Programming with Fiddle Files. Rich Comments in files of their own with some extra Calva treatment to go with them.
search:
  boost: 5
---

# Fiddle Files Support

In the podcast **Functional Design in Clojure**, [Episode 014: Fiddle with the REPL](https://clojuredesign.club/episode/014-fiddle-with-the-repl/), they discuss a workflow in which you keep some of your exploratory code in separate files, which they call **Fiddle Files**. It's like [Rich Comments](rich-comments.md), and the files often consist of such comments. The **Fiddle** files are typically not on the classpath, and are only loaded in the REPL by you when you are developing your project. Some developers keep personal fiddle files. In some projects they are meant to be shared, and in other projects it's a combination.

Calva has some extra support for the fiddle file workflow, beyond what VS Code offers in terms of navigating between files. The support comes in the form of three commands supported by a little configuration.

## The Three Fiddle File Commands

The commands let you quickly navigate between your implementation code (called **Source** here) and your **Fiddle** file, and to evaluate the **Fiddle** file without leaving the **Source** file.

| Command | Action | Shortcut | Active |
|---------|--------|----------|--------|
| **Calva: Open Fiddle File for Current File** | Opens the **Fiddle** file corresponding to the current Clojure **Source** file. | <div style="white-space: nowrap; overflow-x: auto;"><kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>c</kbd><br><kbd>f</kbd></div> | When the currently active file is _not_ a **Fiddle** file. |
| **Calva: Open Source File for Current Fiddle File** | Opens the **Source** file corresponding to the current **Fiddle** file. | <div style="white-space: nowrap; overflow-x: auto;"><kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>c</kbd><br><kbd>f</kbd></div> | When the currently active file _is_ a **Fiddle** file + there is an existing, and corresponding, source file. |
| **Calva: Evaluate Fiddle File for Current File** | Evaluates the **Fiddle** file corresponding to the current Clojure **Source** file. | <div style="white-space: nowrap; overflow-x: auto;"><kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>c</kbd><br><kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>f</kbd></div> | When the currently active file is _not_ a **Fiddle** file. |

The commands for opening and evaluating corresponding **Fiddle** files will offer to Create the **Fiddle** file if it does not already exist. But the **Calva: Open Source File for Current Fiddle File** command will _not_ offer to create the target file.

What does **corresponding** mean here? Without any configuration Calva will look for “sibling” files, where files with Clojure file extensions (E.g. `.clj`, `.cljs`, `.bb`) will be treated as **Source** files, and files with the `.fiddle` extension will be treated as **Fiddle** files. "Sibling file" here means residing side by side in the file system. If this default behaviour is not your cup of tea, there is some flexibility added by configuration.

## The Fiddle File Configuration

To know how to map between **Fiddle** <-> **Source** files, Calva has three different modes of operation:

1. The sibling files, as described above. This is the default. Example:
    * **`src`**`/a/b/c.cljc` corresponding to:
    * **`src`**`/a/b/c.fiddle`
1. Parallel directory structures. Mapping a **Source** directory tree to a **Fiddle** directory tree. Example:
    * **`src`**`/a/b/c.cljc` corresponding to:
    * **`env/dev/fiddles`**`/a/b/c.cljc`
1. A dedicated **Fiddle** file for a **Source** directory tree. E.g. both:
    * **`src`**`/a/b/c.cljc` and:
    * **`src`**`/d/e/f.cljc` corresponding to:
    * **`env/dev/fiddles`**`/x.cljc`

The setting is named `calva.fiddleFilePaths` and is an array of `source` and `fiddle` root paths, _relative to the project root_.

!!! Note "The Project Root"
    It is important to note that the **project root** depends on whether you are connected to a REPL or not, and to which project you are connected, in case the workspace contains several projects.

    **Without** a REPL connection (disregarding that fiddle files are not very interesting then) the project root is the same as the first workspace root. And if you have a regular VS Code window open, it is the root of the folder you have opened in that window.

    **With** a REPL connection, the project root will be the root of the project, i.e. where the project file (`deps.edn`, `project.clj`, `shadow-cljs.edn`) is.

### Example Configurations

#### Single Parallel Directory Structure

```json
"calva.fiddleFilePaths": [
  {
    "source": ["src"],
    "fiddle": ["env", "dev", "fiddles"]
  }
]
```

This will make any file in the `src` directory tree correspond to a matching file with the same relative path. E.g.:

* `src/a/b/c.clj` -> `env/dev/fiddles/a/b/c.clj`, for both the **open** and **evaluate** commands
* `env/dev/fiddles/a/b/c.clj` -> `src/a/b/c.clj`

#### Single Dedicated Fiddle File

If you generally work with one **Fiddle** file at a time, you can configure a mapping to a **Dedicated Fiddle** file. E.g.:


```json
"calva.fiddleFilePaths": [
  {
    "source": ["src"],
    "fiddle": ["env", "dev", "fiddle.clj"]
  },
]
```

This will make any file in the `src` directory tree correspond to the same **Fiddle** file. E.g.:

* `src/a/b/c.clj` -> `env/dev/fiddle.clj`, for both the **open** and **evaluate** commands
* `src/d/e/f.clj` -> `env/dev/fiddle.clj`, ditto
* `env/dev/fiddle.clj` -> Won't correspond to a **Source** file in this case

!!! Note "Jumping from a dedicated fiddle to a source file"
    Calva's command for opening the corresponding source file won't work in this case because it is a one->many situation. If you want to open the last file you worked with before using **Open Fiddle File for Current File**, consider using the VS Code command: **Go Previous**.

#### Multiple Mappings

The configuration is an array so that you can configure different mappings for different **Source** directories. Given several mappings with overlapping **Source**, the longest mapping will win. Given several mappings with the _same_ **Source**, the first one will win, _unless_ one of them is a _dedicated_ **Fiddle**, in which case that one will win.

```json
"calva.fiddleFilePaths": [
  {
    "source": ["src"],
    "fiddle": ["env", "dev", "fiddles"]
  },
  {
    "source": ["src"],
    "fiddle": ["env", "dev", "fiddle.clj"]
  },
  {
    "source": ["src"],
    "fiddle": ["env", "dev", "fiddle.cljs"]
  },
  {
    "source": ["src"],
    "fiddle": ["env", "dev", "fiddle.bb"]
  },
  {
    "source": ["src", "b"],
    "fiddle": ["env", "dev", "b-fiddles"]
  },
]
```

With this configuration we would get a behaviour like so:

* `src/a/b/c.clj` -> `env/dev/fiddle.clj`, because all four first `["src"]` mappings match, but the second one is a dedicated fiddle file, and matches the `.clj` extension.
* `src/a/b/c/d.bb` -> `env/dev/fiddle.bb`, because all four first `["src"]` mappings match, but the second one is a dedicated fiddle file, and matches the `.bb` extension.
* `src/a/b/c/d.cljc` -> `env/dev/fiddle.clj`, because all four first `["src"]` mappings match, but the second one is a dedicated fiddle file, without a matching  file extension, (so the first dedicated fiddle file is picked).
* `src/b/c/d.clj` -> `env/dev/b-fiddles/c/d.clj`, because the `["src", "b"]` mapping is longer than the also matching `["src"]` mappings.

## Tips

Organize your **Fiddle** files such that they do not get automatically loaded as part of your application. This can lead to strange errors and hard-to-detect bugs. Most often it should only be you manually loading the fiddle file, not **clj/clojure** or **Leiningen** or any such system which loads your application.

When you want your fiddle code to be evaluated in the same workspace as its corresponding **Source** file, you can use the same namespace declaration for both files. The linter might complain, but the REPL will happily comply.

If you primarily evaluate the fiddle file using the provided command for it, from the **Source** files, you can omit the namespace declaration, and Calva will evaluate it in the namespace of the **Source** file.

!!! Note "The linter and fiddle files"
    For some fiddle files you will get a lot of linter warnings, because clj-kondo doesn't know about fiddle files, and they are often not on the classpath. You might find yourself wanting to silence some linters for some fiddle files. E.g. like this:

    ``` clojure
    (ns main.core
      {:clj-kondo/config
       '{:linters {:unresolved-symbol {:level :off}}}})
    ```

     See [clj-kondo Configuration](https://github.com/clj-kondo/clj-kondo/blob/master/doc/config.md) for more on what options you have for this.

## See Also

* [Rich Comments](rich-comments.md)
* **Functional Design in Clojure** [Episode 014: Fiddle with the REPL](https://clojuredesign.club/episode/014-fiddle-with-the-repl/)
* The [Polylith Development](https://polylith.gitbook.io/poly/architecture/development) page mentions good practice for where to put your fiddle files (not called fiddle files there, but it is the same concept).
