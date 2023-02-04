---
title: Pretty Printing
description: Prettiness is on by default and all your evaluation results will get the treatment
---

# Pretty Printing

In Calva, pretty printing is a mode. Prettiness is on by default and all your evaluation results will get that treatment.

!!! Note "You can also pretty print code on demand"
    There is a command **Replace Current Form (or Selection) with Pretty Printed Form**. See [Clojure Formmatting](formatting.md#3-replace-current-form-or-selection-with-pretty-printed-form) for more on this.

## Toggle it

There is a `pprint` indicator to the right in the status bar which shows the status of the mode. Click the indicator to toggle prettification on and off. There is also a **Calva: Toggle Pretty Printing for All Evaluations** command.

Tip: If you have evaluated something time consuming, or that is not idempotent, with pretty printing mistakenly off: _toggle it on and evaluate `*1`._

## Configuration

For most people the defaults will probably work, but Calva pretty printing comes a few knobs you can turn, and they are all available through the `calva.prettyPrintingOptions` settings. Things you can set are:

Setting          | Type    | Effect
-------          | ----    | ------
`enabled`        | boolean | So this is a third way you can change this mode 😄
`printEngine`    | enum    | Which printer function that will be used. Default is `pprint`, more about this setting below
`printFn`        | object  | You can configure Calva to use a custom `nREPL` compatible `print` function, more below.
`width`          | number  | The maximum line length of printed output (or at least the printers will try)
`maxLength`      | number  | The maximum number of elements printed in nested nodes, [good for evaluating something like `(iterate inc 0)`](https://clojuredocs.org/clojure.core/*print-length*#example-542692cac026201cdc326b12), which you shouldn't do without setting `maxLength`. Most printers will indicate truncated lists with `...` at the end.
`maxDepth`       | number  | The maximum number of levels deep that will get printed. Different printers mark a stop different ways. `puget` doesn't support it at all.

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
`calva`             | client                | The nREPL server will plain print the results, and then Calva will pretty it (using `zprint`).
[**`pprint`**](https://clojure.github.io/clojure/clojure.pprint-api.html) | server | **Current Calva default.** `clojure.core/pprint` is a bit basic, but it's tried and tested, and doesn't suffer from the issues with the other server side printing options, mentioned below.
[`fipp`](https://github.com/brandonbloom/fipp) | server |
[`puget`](https://github.com/greglook/puget) | server | Lacks `maxDepth` option.
[`zprint`](https://github.com/kkinnear/zprint) | server | A very good option. However, it will need to be configured before [Jack-in](connect.md) if you want Calva's help to inject its dependencies. (If you are not using Jack-in, you'll need to supply this dependency yourself.)

These particular server side functions were chosen because they have pre-configured print-functions in [`cider-nrepl`](https://docs.cider.mx/cider-nrepl/).

#### Or configure `printFn`

If the selection of built-in `printEngine` support doesn't cut it, you can configure a custom function. This function will need to conform to the requirements of nREPL print functions. The VS Code settings editor will help you configure this one. (This is also a bit experimental, please consider giving feedback about how it works for you if you try it.)

### Why does Server or Client Side Matter?

This matters because on the server all pretty printers, except `pprint` does more than just pretty print the result that would be printed with plain printing. Pretty printing results on the server causes some results to get expanded. This can have huge implications depending on the results and which printer is used. E.g. for [Datomic](https://www.datomic.com) transaction results, you will get the whole database printed. Twice. Depending on the database, you could be so unlucky that nothing gets printed, and instead you will soon have a very hot computer.

> Note: With the help of zprint creator, [Kim Kinnear](https://github.com/kkinnear), we have [found ways](https://github.com/kkinnear/zprint/issues/111) to compensate for this problem. Ways that are not yet implemented, but please stay tuned.

Then why not always do it client side? It turns out that on the client side there are also things going on. Calva gets the results back as a string and therefore it needs to first be parsed back to [EDN](https://github.com/edn-format/edn), before it can be pretty printed by `zprint`. And – here's the catch – all results are not valid EDN and therefore can't be pretty printed by `zprint`. Datomic transaction results are one example.

### Need More Configurability?

The current options are limited, because our time developing Calva is limited. But `cider-nrepl` really allows for fully configurable pretty printing, so it is within reach. Please feel invited to give us feedback on what you would want to configure for the printing of results. File issues and/or chat us up in #calva in the Clojurians slack.

### Troubleshooting

#### pprint is not working

If pprint is not working, try a different pprint engine or use Calva's jack-in to make sure the necessary dependencies are loaded in your REPL. If you are starting your REPL without jack-in and want to continue doing so, you can use the command `Copy Jack-in Command Line to Clipboard` then paste the command somewhere to see what dependencies it injects. You can then add these dependencies to your REPL in whatever way suits your needs.

Enjoy Prettiful Printing! ❤️
