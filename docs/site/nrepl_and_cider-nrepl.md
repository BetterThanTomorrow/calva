---
title: nREPL and cider-nrepl
description: Calva's Interactive Programming, and more, is powered by nREPL and cider-nrepl
search:
  boost: 2
---

# nREPL and cider-nrepl

[nREPL](https://github.com/nrepl/nREPL) and [cider-nrepl](https://github.com/clojure-emacs/cider-nrepl) middleware enable Calva to support full Interactive Programming.

## About nREPL

> The REPL is a Clojurists quintessential tool, it’s what we use to do Interactive Development, the hallmark of the LISP style of development.
> 
> In Interactive Development (more commonly but somewhat imprecisely referred to as REPL-driven development), the programmer’s editor has a direct connection with the running application process. This allows evaluating pieces of code in the context of a running program, directly from where the code is written (and so not in some separate “REPL place”), inspecting and manipulating the innards of the process. This is helped along by the dynamic nature of Clojure in which any var can be redefined at any point, allowing for quick incremental and iterative experimentation and development.
> 
> This is why it’s essential to the Clojure development experience to have proper editor support, a plugin which bridges the gap between where the code is written and where the code is run. So we have CIDER for Emacs, Calva for VS Code, Cursive for IntelliJ, Conjure or Iced for Vim, and so forth. Often these will also leverage the same (or a parallel) connection into the process for other editor affordances, like navigation and completion.

> But for these editor plugins to connect to the Clojure process something needs to be listening on the other side, accepting connections, allowing the initiation of a program-to-program dialogue. The most common way to achieve this is by leveraging the nREPL protocol, an asynchronous message-based network protocol for driving interactive development. The application process is started with an embedded nREPL server, so that the editor can connect as an nREPL client.

From: [Lambda Island](https://lambdaisland.com/blog/2021-11-03-making-nrepl-cider-more-dynamic-1)

## About the nREPL Server and Middleware

> nREPL is an extensible protocol, the reference server implementation understands certain core operation types like "eval". More operations can be supported, or existing operations can be modified or augmented, through nREPL middleware. For example: the Piggieback middleware can intercept "eval" messages, and forward them to a ClojureScript environment, rather than evaluating them in the Clojure process itself.
> 
> Which middleware to use will mostly depend on the editor you are using. You’ll typically find that the Clojure-specific functionality for a given editor is partly implemented as a typical editor extension, for instance CIDER written in Emacs LISP, or Calva written in Typescript, and partly as nREPL middleware, providing the functionality the editor extension relies on. For instance, both CIDER and Calva rely on functionality provided by cider-nrepl.

Also from: [Lambda Island](https://lambdaisland.com/blog/2021-11-03-making-nrepl-cider-more-dynamic-1)

## Viewing the Communication Between Calva and nREPL

You can view the messages sent between Calva and nREPL by running the command `Toggle nREPL Logging Enabled`. Enabling nREPL message logging triggers the creation of a VS Code output channel called `nREPL Messages` where the messages will be logged. Messages sent to nREPL from Calva will have `-> sent` above them, and messages sent from nREPL to Calva will have `<- received` above them. Disabling nREPL message logging causes the `nREPL Messages` channel to be removed and messages will no longer be logged.

Each message is logged as JSON. If you find a need for the messages to be logged as EDN (for example, to transform and analyze them with Clojure) please open a GitHub issue for this change. A PR would be welcome too!

The example below shows two messages logged when the cursor hovers over `println` in a Clojure file while a REPL is connected.

```txt
-> sent
{
  op: 'info',
  ns: 'test-lein.core',
  symbol: 'println',
  id: '7',
  session: '1a080b66-b1b6-4b8c-8206-c4af2cc02747'
}

<- received
{
  added: '1.0',
  'arglists-str': '[& more]',
  column: 1,
  doc: 'Same as print followed by (newline)',
  file: 'jar:file:/Users/brandon/.m2/repository/org/clojure/clojure/1.10.1/clojure-1.10.1.jar!/clojure/core.clj',
  id: '7',
  line: 3733,
  name: 'println',
  ns: 'clojure.core',
  resource: 'clojure/core.clj',
  'see-also': [
    'clojure.core/prn',
    'clojure.core/print',
    'clojure.core/println-str',
    'clojure.pprint/pprint'
  ],
  session: '1a080b66-b1b6-4b8c-8206-c4af2cc02747',
  static: 'true',
  status: [ 'done' ]
}
```
