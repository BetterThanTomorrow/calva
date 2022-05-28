---
title: Extension API
description: Documentation for Calva's API to other VS Code extensions (such as Joyride)
search:
  boost: 7
---

# The Calva Extension API

Calva exposes an API for use from other VS Code extensions (such as [Joyride](./joyride.md)). The API is in an experimental state, while we are figuring out what is a good shape for this API. It is also rather small, and will grow to expose more of Calva's functionality.

## Accessing

To access the API the Calva extension needs to be [activated](https://code.visualstudio.com/api/references/vscode-api#Extension%3CT%3E). The API is exposed under the `v0` key on the extension's `exports`:

=== "ClojureScript"

    ```clojure
    (def calva (vscode/extensions.getExtension "betterthantomorrow.calva"))

    (def calvaApi (-> calva
                      .-exports
                      .-v0
                      (js->clj :keywordize-keys true)))
    ```

=== "JavaScript"

    ```javascript
    const calva = vscode.extensions.getExtension("betterthantomorrow.calva");

    const calvaApi = calva.exports.v0;
    ```

## `repl`

The `repl` module contains provides access to Calva's REPL connection.

### `repl.currentSessionKey()`

Use `repl.currentSessionKey()` find out which REPL/session Calva's REPL is currently connected to (depends on the active file). Returns either `"clj"`, or `"cljs"`, or `nil` if no REPL is connected.

=== "ClojureScript"

    ```clojure
    (def session-key ((get-in [:repl :currentSessionKey] calvaApi)))
    ```

=== "JavaScript"

    ```javascript
    const sessionKey = calvaApi.repl.evaluateCode()
    ```

### `repl.evaluateCode()`

This function lets you evaluate Clojure code through Calva's nREPL connection. Calling it returns a promise that resolves to a `Result` object. It's signature looks like so (TypeScript):

```typescript
export async function evaluateCode(
  sessionKey: 'clj' | 'cljs' | 'cljc' | undefined,
  code: string,
  output?: {
    stdout: (m: string) => void;
    stderr: (m: string) => void;
  }
): Promise<Result>;
```

Where `Result` is:

```typescript
type Result = {
  result: string;
  ns: string;
  output: string;
  errorOutput: string;
};
```

As you can see, the required arguments to the function are `sessionKey` and `code`. `sessionKey` should be `"clj"`, `"cljs"`, `"cljc"`, or `undefined` depending on which of Calva's REPL sessions/connections that should be used. It will depend on your project, and how you connect to it, which session keys are valid. Use `cljc` to request whatever REPL session `"cljc"` files are connected to. Use `undefined` to use the current REPL connection Calva would use (depends on which file is active).

An example:

=== "ClojureScript"

    ```clojure
    (def evaluate (get-in [:repl :evaluateCode] calvaApi))
    (-> (p/let [evaluation (evaluate "clj" "(+ 2 40)")]
          (println (.-result evaluation)))
        (p/catch (fn [e]
                   (println "Evaluation error:" e))))
    ```

=== "JavaScript"

    ```javascript
    try {
      const evaluation = await calvaApi.repl.evaluateCode("clj", "(+ 2 40)");
      console.log(evaluation.result);
    } catch (e) {
      console.error("Evaluation error:", e);
    }
    ```

#### Handling Output

The `output` member on the `Result` object will have any output produced during evaluation. (The `errorOutput` member should contain error output produced, but currently some Calva bug makes this not work.) By default the stdout and stderr output is not printed anywhere.

If you want to do something with either regular output or error output during, or after, evaluation, you'll need to provide the `output` argument to `evaluateCode()`. (The `stderr` callback function works, so this is the only way to get at any error output, until the above mentioned Calva bug is fixed.)

An example:

=== "ClojureScript"

    ```clojure
    (def oc (joyride.core/output-channel)) ;; Assuming Joyride is used
    (def evaluate (fn [code]
                    ((get-in [:repl :evaluateCode] calvaApi)
                     "clj"
                     code
                     #js {:stdout #(.append oc %)
                          :stderr #(.append oc (str "Error: " %))})))

    (-> (p/let [evaluation (evaluate "(println :foo) (+ 2 40)")]
          (.appendLine oc (str "=> " (.-result evaluation))))
        (p/catch (fn [e]
                   (.appendLine oc (str "Evaluation error: " e)))))
    ```

=== "JavaScript"

    ```javascript
    const evaluate = (code) =>
      calvaApi.repl.evaluateCode("clj", code, {
        stdout: (s) => {
          console.log(s);
        },
        stderr: (s) => {
          console.error(s);
        },
      });

    try {
      const evaluation = await evaluate("(println :foo) (+ 2 40)");
      console.log("=>", evaluation.result);
    } catch (e) {
      console.error("Evaluation error:", e);
    }
    ```

## `ranges`

The `ranges` module contains functions for retreiving [vscode.Range](https://code.visualstudio.com/api/references/vscode-api#Range)s and text for pieces of interest in a Clojure document.

All functions in this module have the following TypeScript signature:

```typescript
(editor = vscode.window.activeTextEditor, position = editor?.selection?.active) => [vscode.Range, string];
```

I.e. they expect a [vscode.TextEditor]() – defaulting to the currently active editor – and a [vscode.Position]() – defaulting to the current active position in the editor (or the first active position if multiple selections/positions exist, and will return a tuple with the range, and the text for the piece of interest requested.

The functions available are:

### `ranges.currentForm()`

Retrieves information about the current form, as determined from the editor and position. See about Calva's [Current Form]() on YouTube.

### `ranges.currentEnclosingForm()`

The list/vector/etcetera form comtaining the current form.

### `ranges.currentTopLevelForm()`

The current top level form. Outside `(comment ...)` (Rich comments) forms this is most often (`(def ...), (defgn ...)`, etcetera. Inside Rich comments it will be the current immediate child to the `(comment ...)` form.

### `ranges.currentFunction()`

The current function, i.e. the form in ”call position” of the closest enclosing list.

### `ranges.currentTopLevelDef()`

The symbol being defined by the current top level form. NB: Will stupidly assume it is the second form. I.e. it does not check that it is an actual definition, and will often return nonsense if used in Rich comments.

### Example: `ranges.currentTopLevelForm()`

=== "ClojureScript"

    ```clojure
    (def top-level-form (get-in [:repl :currentTopLevelForm] calvaApi))
    (def text (-> (top-level-form)
                  second))
    ```

=== "JavaScript"

    ```javascript
    const text = repl.currentTopLevelForm()[1];
    ```

## Feedback Welcome

Please let us know how you fare using this API. Either in the #calva or #joyride channels on Slack or via the issues/discussions sections on the repositories. (Whichever seems to apply best.)