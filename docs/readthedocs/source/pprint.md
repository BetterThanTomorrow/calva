# Pretty Printing

In Calva, pretty printing is a mode. Prettiness is on by default and all your evaluation results will get that treatment.

## Toggle it

There is a `pprint` indicator to the right in the status bar which shows the status of the mode. Click the indicator to toggle prettification on and off. There is also a **Calva: Toggle Pretty Printing for All Evaluations** command.

Tip: If you have evaluated something time consuming, or that is not idempotent, with pretty printing mistakenly off: _toggle it on and evaluate `*1`._

## Configuration

For most people the defaults will probably work, but Calva pretty printing comes a few knobs you can turn, and they are all available through the `calva.prettyPrintingOptions` settings. Things you can set are:

Setting          | Type    | Effect
-------          | ----    | ------
`enabled`        | boolean | so this is a third way you can change this mode 😄
`printEngine`    | enum    | which printer function that will be used. Default is `pprint`, more about this setting below
`width`          | number  | the maximum line length of printed output (or at least the printers will try)
`maxLength`      | number  | the maximum number of elements printed in nested nodes, [good for evaluating something like `(iterate inc 0)`](https://clojuredocs.org/clojure.core/*print-length*#example-542692cac026201cdc326b12), which you shouldn't do without setting `maxLength`. Most printers will indicate truncated lists with `...` at the end.
`maxDepth`       | number  | the maximum number of levels deep that will get printed. Different printers mark a stop different ways. `puget` doesn't support it at all.

See [Customizing Calva](customizing.md) for some tips on adding settings like these.

Here's an example of how `zprint` handles `maxDepth` (from the [Calva implementation](https://github.com/BetterThanTomorrow/calva/blob/dev/src/cljs-lib/src/calva/pprint/printer.cljs) of it's client side pretty printing.).

```clojure
  (pretty-print [[[[[[[[:deeper]]]]]]]] {:max-depth 4})
  ;; => {:value "[[[[##]]]]"}
```

### Your Selection of Prettifiers

Pretty printing can happen on the _server_ (i.e. in the JVM, via nREPL), or on the _client_ (i.e. in node, via VS Code/Calva). Client side always uses `zprint`. Server side you can choose from these printers:

Print Engine | Client or Server Side | Comments
--------------------- | --------------------- | --------
`calva`             | client                | i.e. the nREPL server will plain print the results, and then Calva will pretty it.
[`pprint`](https://clojure.github.io/clojure/clojure.pprint-api.html) | server | current Calva default (`clojure.core/pprint` is a bit basic, but it's tried and tested, and has none of the server side printing issues mentioned below.
[`fipp`](https://github.com/brandonbloom/fipp) | server |
[`puget`](https://github.com/greglook/puget) | server | Lacks `maxDepth` option.
[`zprint`](https://github.com/kkinnear/zprint) | server | Recommended. Will need to be configured before [Jack-in](connect.md) if you want Calva's help to inject its dependencies

It is this particular selection of server side functions, because they have pre-configured print-functions in [`cider-nrepl`](https://docs.cider.mx/cider-nrepl/).

### Why does Server or Client Side Matter?

This matters because on the server all pretty printers, except `pprint` does more than just pretty print the result that would be printed with plain printing. Pretty printing results on the server causes some results to get expanded. This can have huge implications depending on the results and which printer is used. E.g. for [Datomic](https://www.datomic.com) transaction results, you will get the whole database printed. Twice. Depending on the database, you could be so unlucky that nothing gets printed, instead you will soon have a very hot computer.

> Note: With the help of zprint creator, [Kim Kinnear](https://github.com/kkinnear), we have [found ways](https://github.com/kkinnear/zprint/issues/111) to compensate for this problems. Ways that are not yet implemented, but please stay tuned.

Then, why not always do it client side? It turns out that on the client side there are also things going on. Calva gets the results back as a string and therefore it needs to first be parsed back to [EDN](https://github.com/edn-format/edn), before it can be pretty printed by `zprint`. And – here's the catch – all results are not valid EDN and therefore can't be pretty printed by `zprint`. Datomic transaction results are one example.

### Need More Configurability?

The current options are limited, because our time developing Calva is limited. But `cider-nrepl` really allows for fully configurable pretty printing, so it is within reach. Please feel invited to give us feedback on what you would want to configure for the printing of results. File issues and/or chat us up in #calva on the Clojurians slack.

Enjoy Prettiful Printing! ❤️
