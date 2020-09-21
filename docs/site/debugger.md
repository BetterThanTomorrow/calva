# Debugger

Calva comes with a powerful expression-based debugger, inspired by [Cider](https://cider.mx/)'s debugger, and using the same underlying library, [cider-nrepl](https://github.com/clojure-emacs/cider-nrepl). We hope you love it!

![Debugger demonstration: stepping through an instrumented function](images/debugger/stepping.gif "Debugger demonstration: stepping through an instrumented function")

!!! note
    The debugger currently does not support ClojureScript. Calva's debugger utilizes cider-nrepl for debugging. See [this Cider issue](https://github.com/clojure-emacs/cider/issues/1416) for more information.

## Features

### Current

* Instrument functions for debugging with `ctrl+alt+c i`
* Instrument a function manually with `#dbg` (as opposed to the above command)
* Set individual breakpoints with `#break`
* Continue to next breakpoint
* Step over form
* Step into form
* Step out of form
* Evaluate code in the debug context
* See variable values in the debugger side pane
* See variable values on hover in the editor

### Future goals

* See structured variables in the debugger side pane (currently maps and collections are just shown as strings)
* Inject values into the debug context
* Trace: continue, printing expressions and their values

## Dependencies

The debugger itself relies pretty heavily on [cider-nrepl](https://github.com/clojure-emacs/cider-nrepl), as do other parts of Calva, and the decorations to show instrumented functions rely on [clj-kondo](https://github.com/borkdude/clj-kondo). Both of these libraries are loaded as dependencies when you use Calva Jack-in. If you are not using Calva Jack-in, you can add these dependencies in your project definition or user profile. See the [Calva Jack-in guide](/jack-in-guide) for more information.

## Using the Debugger

If you're new to Clojure or expression-based debuggers, this debugger may function differently than what you're used to. Instead of placing breakpoints in the side margin and then hitting F5 to start debugging, you instead use Clojure reader tags, `#break` and `#dbg`, to denote breakpoints anywhere in a Clojure form. When you evaluate a call to a function that has been evaluated with that reader tag, the debugger will start when execution reaches the first breakpoint. There's also a convenience command to instrument functions. Read below about both options.

### Instrumenting a Function

You can instrument a top level function for debugging with `ctrl+alt+c i`. This places invisible breakpoints throughout the function where pausing makes sense. When you evaluate a call to this function, the debugger will start and execution will pause at the first breakpoint. Annotations show the value of the form at the cursor.

A border is placed around the definition of the instrumented function and its references to show that it's instrumented. You can remove instrumentation by evaluating the function again normally, such as with `alt+enter`.

![Instrumenting a function](images/debugger/instrumenting-a-function.gif "Instrumenting a function")

### Setting Breakpoints with `#break`

You can insert a breakpoint manually into any code by placing a `#break` in front of the form where you want execution to pause, and then evaluating the top level form with `alt+enter`. When you evaluate a call to this code the VS Code debugger will start, the cursor will move to right after the form that's preceded by `#break`, and the line will be highlighted to show execution is paused there.

![Setting a breakpoint with #break](images/debugger/break.gif "Setting a breakpoint with `#break`")

!!! note
    Code will be executed up to and *including* the form after the breakpoint.

### Conditional Breakpoints

You can set conditional breapoints by adding metadata before the form that the `#break` applies to.

```clojure
(defn print-nums [n]
  (dotimes [i n]
    #break ^{:break/when (= i 7)} ;; This breakpoint will only be hit when i equals 7
    (prn i)))
```

### Instrumenting a Form with `#dbg`

Adding `#dbg` before a form then evaluating the form with `alt+enter` will instrument the form. This has the same effect as using [the instrument command](#instrumenting-a-function).

![Instrumenting a form](images/debugger/dbg-form.gif "Instrumenting a non-function form")

![Instrumenting a function](images/debugger/dbg-function.gif "Instrumenting a function")

### Evaluating Code in the Paused Context

When execution is paused at a breakpoint, you can evaluate code in that context. This can be done in the editor or in the REPL window, as usual.

![Evaluating code in the paused context from the editor](images/debugger/eval-editor.gif "Evaluating code in the paused context from the editor")

### Viewing Variable Values While Debugging

While debugging, you can view the values of variables in VS Code's debugger side pane. You can also view values by hovering over the variables in the editor. Currently, values for collections and maps are shown as strings, but we plan to make them structured in the future. For now, if you want to see the value of a large structured variable, you can evaluate the variable from the editor or from the REPL window.

![Viewing variable values in the side pane](images/debugger/viewing-variable-values.png "Viewing variable values in the side pane")

### Stepping Commands

You can use VS Code's debugger UI to advance execution while debugging.

![VS Code's debugger navigation buttons](images/debugger/navigation-buttons.png "VS Code's debugger navigation buttons")

!!! note
    Clicking restart does nothing, since this functionality does not make sense for our debugger.

* **Continue** - Continues without stopping for the current breakpoint
* **Step over** - Continues to the next breakpoint
* **Step in** - Steps in to the function about to be called. If the next breakpoint is not around a function call, does the same as next. Note that not all functions can be stepped in to - only normal functions stored in vars, for which cider-nrepl can find the source. You cannot currently step in to multimethods, protocol functions, or functions in clojure.core (although multimethods and protocols can be instrumented manually).
* **Step out** - Steps to the next breakpoint that is outside of the current sexp
* **Restart** - Does nothing. To restart debugging, you can hit disconnect or continue execution through the final result, then re-evaluate the expression that started the debugger.
* **Disconnect** - Disconnects the debugger

## Caveats

### Breakpoints in loop/recur

One construct where the debugger is limited is `loop`/`recur`. As recur always has to appear in a tail-position inside a `loop` or a `fn` and the debugger uses macros to interleave breakpoints in the forms, it **might** happen that a `recur` no longer appears in a tail position. In that case we have to avoid setting up the breakpoint. An example of such a case is:

```clojure
(loop [i 0]
  #break
  (when (< i 10)
    (println i)
    (recur (inc i))))
```

Here the breakpoint is exactly in front of a form that contains as its last expression a `recur` which is wrapped in a loop. This breakpoint has no effect. This does not mean you cannot use the debugger with `loop`, it just means you have to set your debug statements more carefully.

### Loading the File and "Eval On Save"

When you load a file, any breakpoints that were previously set in functions will be unset. If you have the "Eval On Save" setting enabled, your file is also loaded with each save, therefore saving the file will remove breakpoints previously set.

## Troubleshooting

### Debugger hangs when stepping over infinite seqs

This is because the debugger tries to evaluate the form when it's stepped over, and if `clojure.core/*print-length*` is set to `nil` as it is by default, evaluation will never complete. If you want to debug a form with an infinite seq, make sure to set `*print-length*` beforehand. For example:

```clojure
(set! *print-length* 3)
;; Or, to be more precise
(set! clojure.core/*print-length* 3)
```

Calva does not set this for you during debug mode, instead leaving it up to you to decide the value.

### My breakpoint isn't being hit

It's likely that your breakpoint is in a place that cider-nrepl does not see as an appropriate place to break execution. For example, if you put a breakpoint before a literal number, it will not be hit, because there's no need to show the value of a literal.

```clojure
(defn simple [x]
  (+ 1 #break 1)) ;; This breakpoint will not be hit
```

Another possible issue is that you're loading the file again after setting breakpoints, which unsets them. See [Loading the File and "Eval On Save"](#loading-the-file-and-eval-on-save) under Caveats.
