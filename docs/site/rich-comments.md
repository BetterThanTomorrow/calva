---
title: Rich Comments Support
description: How Calva supports and promotes a Rich Comments powered workflow. The REPL is not a prompt!
search:
  boost: 5
---

# Rich Comments Support

Why bother with **Rich comments**? Read on. Consider watching [this Youtube video](https://www.youtube.com/watch?v=d0K1oaFGvuQ) for a demo of the workflow using the (in?)famous FizzBuzz problem as an example.

<iframe width="560" height="315" src="https://www.youtube.com/embed/d0K1oaFGvuQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Things in `comment` are not evaluated

The Clojure `comment` macro is defined like so:

```clojure
(defmacro comment
  "Ignores body, yields nil"
  {:added "1.0"}
  [& body])
```

It has no forms in its body and will therefore always (as long as the Clojure Reader can read it) evaluate to `nil`. That is: _nothing in the `(comment ...)` form will get evaluated when the file is loaded_.

This makes it a very good ”place” where you can develop code, experiment with code, and keep example code. Since you will be able to load/evaluate the current file without worrying that the code in the `comment` form will get evaluated. This also holds true when using tools that hot-reload the code on save, such as [Figwheel](https://figwheel.org), [shadow-cljs](https://github.com/thheller/shadow-cljs) and [Krell](https://calva.io/krell/).

To develop or refine a function you might:

1. Open up a `(comment ...)` form
1. Inside this form, type a first, super simple, version (or refinement) of your function and evaluate it
1. Inside the same `comment` form, type some code to test your function and evaluate that
    * Or type and evaluate some code you might need for your function
1. Repeat from *2.*, until the function does what you want it to do
1. Move the function definition out of the `comment` form
1. Clean up the `comment` form to keep some of the test code as example use, or ”design decision log” for the function.

!!! Note
    Using `(comment ...)` forms for developing code is very common among Clojure coders. Rich Hickey is known for using it, which is why they are called **Rich comments** to begin with (even if it also is a very rich experience).

## Calva encourages Rich comments

Calva has several features to facilitate the Rich comments workflow, e.g.

1. A command that helps you create a new Rich comment form quickly: **Calva: Add Rich Comment**, <kbd>ctrl+alt+r c</kbd>
1. Special [Syntax highlight](customizing.md#calva-highlight). By default `comment` forms are rendered in _italics_
1. Special [top-level form](evaluation.md#current-top-level-form) context
1. Special formatting

### `comment` is top-level

To make it easy to evaluate forms in `(comment ...)` forms, they create a new top-level context. Instead of you having to place the cursor with precision before evaluating the **current form**, you can have the cursor anywhere within a `comment` enclosed form and [**Evaluate Top-Level Form**](evaluation.md#current-top-level-form).

This carries over to all commands in Calva which deal with the top level form. Including [custom command snippets](custom-commands.md).

### Special formatting

To invite a **Rich comments** workflow, the Calva command **Format Current Form** will not fold the closing bracket of the `(comment ...)` form. Instead it will place this bracket on a line of its own (or keep it there).

```clojure
(comment
  )
```

With the cursor somewhere directly inside the comment form (denoted with a `|`):

```clojure
(comment
  (def foo
:foo)|)
```

<kbd>tab</kbd>

```clojure
(comment
  (def foo
    :foo)
  |)
```

#### Thinking space is kept

The formatter will not remove newlines between the cursor and the closing bracket. So if you have entered a few lines to get ”thinking” room:

```clojure
(comment
  (def foo
:foo)

|

)
```

<kbd>tab</kbd>

```clojure
(comment
  (def foo
    :foo)

  |

  )
```

#### Fold when done

To fold the trailing paren automatically, place the cursor immediately outside (before or after) the form:

```clojure
(comment
  (def foo
:foo))|
```

<kbd>tab</kbd>

```clojure
(comment
  (def foo
    :foo))|
```

#### Enabled by default

You can disable this behavior with the setting: `calva.fmt.keepCommentTrailParenOnOwnLine`.

But why would you? It is awesome! 😄


#### Only for the Current Form

!!! Note
    This treatment only applies to formatting of [the current form](evaluation.md#current-form). With [fold when done](#fold-when-done) as an exception.
