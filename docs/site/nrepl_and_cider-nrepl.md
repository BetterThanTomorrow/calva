# nREPL and cider-nrepl

[nREPL](https://github.com/nrepl/nREPL) and [cider-nrepl](https://github.com/clojure-emacs/cider-nrepl) provide Calva with some of its REPL-based functionality.

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
