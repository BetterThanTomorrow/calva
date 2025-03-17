---
title: Calva Flares Documentation
description: Learn how to use Calva Flares to enhance your development experience.
---

# Calva Flares

Flares are a mechanism in Calva that allow the REPL server (where your Clojure code runs) to send requests to the REPL client (your Calva IDE) to trigger specific behaviors.
They bridge the gap between user-space code and IDE features, enabling dynamic and interactive workflows.

Flares are special values that, when encountered by the IDE, prompt it to perform predefined actions such as rendering HTML, showing notifications, or visualizing data.

> **TIP:**
> Don't put flares in your project code.
> Flares are IDE specific, so they should be created by tooling code.
> Flares will be created when invoking a tool or custom action from your IDE.

## How to Create Flares

Flares are tagged literals

```clojure
(tagged-literal 'flare/message {:type :info
                                :message "Congratulations, you sent a flare!"})
```

- **Tag**: `:flare/message` – Identifies this as a message flare
- **Value**: A map defining the request.

Here’s a flare to display a HTML greeting:

```clojure
(tagged-literal 'flare/html {:html "<h1>Hello, Calva!</h1>",
                             :title "Greeting"})
```

## Typical Uses of Flares

Flares enhance your development experience by enabling IDE features directly from user-space code. Below are common use cases:

### 1. Data Visualization

Used with tools like Clay, you can render HTML, SVG, or other visual elements directly in the IDE:

```clojure
(snippets/current-form-calva $current-form $file)
```

Produces a flare:

```clojure
(tagged-literal 'flare/html {:url "https://localhost:1971"})
```

Enabling you to create a custom action "Send to Clay" to visualize Kindly annotated visualizations.

### 2. Notifications

Test results or task completion:

```clojure
(tagged-literal 'flare/message {:type :info
                                :message "Tests Passed 🎉"})
```

## Flare Reference

### `flare/message`

`:type` should be one of `:info`, `:warn`, `:error` (defaults to `info`).

`:items` are are responses the user may choose, for example `["yes" "no"]`.

`:then` is an optional fully qualified symbol that should resolve to a function to invoke with the selected item.

### `flare/html`

`:title` will be shown in the panel title.

`:html` raw HTML string to show in a WebView.

`:url` show the page hosted at URL in a WebView.

`:key` an identifier for the panel. The request will reuse an open WebView if it exists already.
