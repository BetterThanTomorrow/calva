---
title: Basilisp
description: Basilisp aims to enable writing Clojure programs on Python with full Python interoperability. It is highly compatible with Clojure.
---

# Using Calva with Basilisp

To install Basilisp, run:

```shell
  $ pip install basilisp
```

There are several ways to connect to Basilisp.

## Start your project with a REPL and connect

If you have created a `basilisp.edn` project file at your root of your project tree, you can jack in  with the `Start a Project REPL and connect` command. 

The `basilisp.edn` is similar to `deps.edn` for clojure-cli projects. It can be left empty just to mark the root of your Basilisp project.

## Connect to a running REPL in your project

You can start its bundled nREPL server:

```shell
$ basilisp nrepl-server
```

and connect to it afterward using `Connect to a running REPL in your project` command.

To see available options, type `basilisp nrepl-server -h` in a shell prompt.

# Configuration

## Calva: Basilisp Path

The path to the basilisp executable, typically `basilisp`.

If Basilisp is installed in a virtual environment, update this to the full path of the basilisp executable within that virtual environment.
