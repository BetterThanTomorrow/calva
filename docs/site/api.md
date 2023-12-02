---
title: Extension API
description: Documentation for Calva's API to other VS Code extensions (such as Joyride)
search:
  boost: 7
---

# The Calva Extension API

Calva exposes an API for use from other VS Code extensions (such as [Joyride](./joyride.md)). The API is in an experimental state, while we are figuring out what is a good shape for this API. It is also rather small, and will grow to expose more of Calva's functionality.

## Accessing

To access the API the Calva extension needs to be [activated](https://code.visualstudio.com/api/references/vscode-api#Extension%3CT%3E). The API is exposed under the `v1` key on the extension's `exports`, and split up into submodules, like `repl`, and `ranges`.

When using Joyride you can use its unique `require` API, for which one of the benefits is better lookup IDE support. When using the API from regular ClojureScript, you'll pick it up from the Calva extension instance. (Which you can do from Joyride as well, but why would you?). Here is how you access the API, with an example of usage as a bonus:


=== "Joyride"

    ```clojure
    (ns ... (:require ["ext://betterthantomorrow.calva$v1" :as calva]))
    ;; OR
    (require '["ext://betterthantomorrow.calva$v1" :as calva])

    (calva/repl.currentSessionKey) => "cljs" ; or "clj", depending
    ```

=== "ClojureScript"

    ```clojure
    (def calvaExt (vscode/extensions.getExtension "betterthantomorrow.calva"))
    
    (def calva (-> calvaExt
                 .-exports
                 .-v1
                 (js->clj :keywordize-keys true)))
    
    ((get-in calva [:repl :currentSessionKey])) => "cljs" ; or "clj", depending
    ```

=== "JavaScript"

    ```javascript
    const calvaExt = vscode.extensions.getExtension("betterthantomorrow.calva");

    const calva = calvaExt.exports.v1;

    const sessionKey = calva.repl.currentSessionKey()
    ```

## `repl`

The `repl` module provides access to Calva's REPL connection.

### `repl.currentSessionKey()`

Use `repl.currentSessionKey()` find out which REPL/session Calva's REPL is currently connected to (depends on the active file). Returns either `"clj"`, or `"cljs"`, or `nil` if no REPL is connected.

=== "Joyride"

    ```clojure
    (def session-key (calva/repl.currentSessionKey))
    ```

=== "ClojureScript"

    ```clojure
    (def session-key ((get-in [:repl :currentSessionKey] calvaApi)))
    ```

=== "JavaScript"

    ```javascript
    const sessionKey = calva.repl.currentSessionKey()
    ```

### `repl.evaluateCode()`

This function lets you evaluate Clojure code through Calva's nREPL connection. Calling it returns a promise that resolves to a `Result` object. It's signature looks like so (TypeScript):

```typescript
export async function evaluateCode(
  sessionKey: 'clj' | 'cljs' | 'cljc' | undefined,
  code: string,
  ns = 'user',
  output?: {
    stdout: (m: string) => void;
    stderr: (m: string) => void;
  },
  opts = {}
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

=== "Joyride"

    ```clojure
    (-> (p/let [evaluation (calva/repl.evaluateCode "clj" "(+ 2 40)")]
          (println (.-result evaluation)))
        (p/catch (fn [e]
                   (println "Evaluation error:" e))))
    ```

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

=== "Joyride"

    ```clojure
    (def oc (joyride.core/output-channel)) ;; Assuming Joyride is used
    (def evaluate (fn [code]
                    (calva/repl.evaluateCode
                     "clj"
                     code
                     "user"
                     #js {:stdout #(.append oc %)
                          :stderr #(.append oc (str "Error: " %))})))

    (-> (p/let [evaluation (evaluate "(println :foo) (+ 2 40)")]
          (.appendLine oc (str "=> " (.-result evaluation))))
        (p/catch (fn [e]
                   (.appendLine oc (str "Evaluation error: " e)))))
    ```

=== "ClojureScript"

    ```clojure
    (def oc (joyride.core/output-channel)) ;; Assuming Joyride is used
    (def evaluate (fn [code]
                    ((get-in [:repl :evaluateCode] calvaApi)
                     "clj"
                     code
                     "user"
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
      calvaApi.repl.evaluateCode("clj", code, "user", {
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

I.e. they expect a [vscode.TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor) – defaulting to the currently active editor – and a [vscode.Position](https://code.visualstudio.com/api/references/vscode-api#Position) – defaulting to the current active position in the editor (or the first active position if multiple selections/positions exist, and will return a tuple with the range, and the text for the piece of interest requested.

!!! Note "Custom REPL Commands"
    The `ranges` function have corresponding [REPL Snippets/Commands](custom-commands.md) substitution variables. It is the same implementation functions used in both cases.

The functions available are:

### `ranges.currentForm()`

Retrieves information about the current form, as determined from the editor and position.

_Corresponding [REPL Snippet](custom-commands.md) variable: `$current-form`._

See also about Calva's [Current Form](https://www.youtube.com/watch?v=8ygw7LLLU1w) on YouTube.

### `ranges.currentEnclosingForm()`

The list/vector/etcetera form comtaining the current form.

_Corresponding [REPL Snippet](custom-commands.md) variable: `$enclosing-form`._

### `ranges.currentTopLevelForm()`

The current top level form. Outside `(comment ...)` (Rich comments) forms this is most often (`(def ...), (defgn ...)`, etcetera. Inside Rich comments it will be the current immediate child to the `(comment ...)` form.

_Corresponding [REPL Snippet](custom-commands.md) variable: `$top-level-form`._

### `ranges.currentFunction()`

The current function, i.e. the form in ”call position” of the closest enclosing list.

_Corresponding [REPL Snippet](custom-commands.md) variable: `$current-fn`._

### `ranges.currentTopLevelDef()`

The symbol being defined by the current top level form. NB: Will stupidly assume it is the second form. I.e. it does not check that it is an actual definition, and will often return nonsense if used in Rich comments.

_Corresponding [REPL Snippet](custom-commands.md) variable: `$top-level-defined-symbol`._

### Example: `ranges.currentTopLevelForm()`

=== "Joyride"

    ```clojure
    (let [[range text] (calva/ranges.currentTopLevelForm)]
      ...)
    ```

=== "ClojureScript"

    ```clojure
    (let [[range text] ((get-in [:ranges :currentTopLevelForm]))]
      ...)
    ```

=== "JavaScript"

    ```javascript
    const [range, text] = ranges.currentTopLevelForm();
    ```

## `editor`

The `editor` module has facilites (well, a facility, so far) for editing Clojure documents.

### `editor.replace()`

With `editor.replace()` you can replace a range in a Clojure editor with new text. The arguments are:

* `editor`, a `vscode.TextEditor`
* `range`, a `vscode.Range`
* `newText`, a string

=== "Joyride"

    ```clojure
    (-> (p/let [top-level-form-range (first (calva/ranges.currentTopLevelForm))
                _ (calva/editor.replace vscode/window.activeTextEditor top-level-form-range "Some new text")]
          (println "Text replaced!"))
        (p/catch (fn [e]
                   (println "Error replacing text:" e))))
    ```

=== "JavaScript"

    ```javascript
    const topLevelRange = calvaApi.ranges.currentTopLevelForm();
    calva.editor.replace(topLevelRange, "Some new text")
      .then((_) => console.log("Text replaced!"))
      .catch((e) => console.log("Error replacing text:", e));
    ```

## `document`

The `document` module provides access to the Clojure/Calva aspects of VS Code `TextDocument`s.

### `document.getNamespace(document?: vscode.TextDocument): string`

`document.getNamespace()` returns the namespace of a document.

* `document`, a `vscode.TextDocument` (defaults to the current active document)

Example usage. To evaluate some code in the namespace of the current document:

=== "Joyride"

    ```clojure
    (calva/repl.evaluateCode "clj" "(+ 1 2 39)" (calva/document.getNamespace))
    ```
=== "JavaScript"

    ```js
    calva.repl.evaluateCode("clj",  "(+ 1 2 39)", calva.document.getNamespace());
    ```

### `document.getNamespaceAndNsForm(document?: vscode.TextDocument): [ns: string, nsForm: string]`

`document.getNamespaceAndNsForm()` returns the namespace and the `ns` form of a document as a tuple.

* `document`, a `vscode.TextDocument` (defaults to the current active document)

Example usage. To evaluate the `ns` form of the current document:

=== "Joyride"

    ```clojure
    (calva/repl.evaluateCode "clj" (second (calva/document.getNamespaceAndNsForm)))
    ```
=== "JavaScript"

    ```js
    calva.repl.evaluateCode("clj", calva.document.getNamespaceAndNsForm()[1]);
    ```

## `pprint`

The `pprint` module lets you pretty print Clojure code/data using Calva's [pretty printing](pprint.md) engine (which in turn uses [zprint](https://github.com/kkinnear/zprint)).

### `pprint.prettyPrint()`

Use `pprint.prettyPrint()` to pretty print some Clojure data using your Calva pretty printing options. It accepts these arguments:

* `text`, a `string` with the text to pretty print
* `options`, a JavaScript object with [pretty printing](pprint.md) options, this is optional and will default to the current settings.

The function is synchronous and returns the prettified text.

=== "Joyride"

    ``` clojure
    (println (calva/pprint.prettyPrint "Some text")))
    ```

=== "JavaScript"

    ``` javascript
    console.log(calvaApi.pprint.prettyPrint();
    ```

### `pprint.prettyPrintingOptions()`

Use to get the current pretty printint options:

## `vscode`

In the its `vscode` submodule, Calva exposes access to things from its own `vscode` module instance. It gets important in some situations.

### `vscode.registerDocumentSymbolProvider()`

This is the `[vscode.languages](https://code.visualstudio.com/api/references/vscode-api#languages).registerDocumentSymbolProvider()` function from the Calva extension. Use it if you want to provide symbols for Clojure files together with the ones that Calva provides. (If you use the `vscode.languages.registerDocumentSymbolProvider()` function from your extension (or Joyride) you will provide a separate group.)

=== "Joyride"

    ```clojure
    (-> (joyride/extension-context)
      .-subscriptions
      (.push (calva/vscode.registerDocumentSymbolProvider ...)))
    ```

=== "ClojureScript"

    ```clojure
    (-> yourExtensionContext
      .-subscriptions
      (.push ((get-in calva [:vscode :registerDocumentSymbolProvider]) ...)))
    ```

=== "JavaScript"

    ```javascript
    yourExtensionContext.subscriptions.push(calva.vscode.registerDocumentSymbolProvider(...));
    ```
!!! Warning "Deprecation candidate"
    VS Code is still creating a separate group, just with the same name as Calva's, so this API is not good for anything, and we will probably remove it.

## Feedback Welcome

Please let us know how you fare using this API. Either in the #calva or #joyride channels on Slack or via the issues/discussions sections on the repositories. (Whichever seems to apply best.)