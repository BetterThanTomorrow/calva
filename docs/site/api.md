---
title: Extension API
description: Documentation for Calva's API to other VS Code extensions (such as Joyride)
search:
  boost: 7
---

# The Calva Extension API

Calva exposes an API for use from other VS Code extensions (such as [Joyride](./joyride.md)). The API is rather small for now, consisting of only one function. It is also in an experimental state, while we are figuring out what is a good shape for this API.

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

## `evaluateCode()`

This function lets you evaluate Clojure code through Calva's nREPL connection. Calling it returns a promise that resolves to a `Result` object. It's signature looks like so (TypeScript):

```typescript
export async function evaluateCode(
  sessionKey: 'clj' | 'cljs',
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

As you can see, the required arguments to the function are `sessionKey` and `code`. `sessionKey` should be either `clj` or `cljs` depending on which of Calva's REPL sessions/connections that should be used. It will depend on your project, and how you connect to it, if both or only one of them is valid.

An example:

=== "ClojureScript"

    ```clojure
    (def evaluate (:evaluateCode calvaApi))
    (-> (p/let [evaluation (evaluate "clj" "(+ 2 40)")]
          (println (.-result evaluation)))
        (p/catch (fn [e]
                   (println "Evaluation error:" e))))
    ```

=== "JavaScript"

    ```javascript
    const result = await calvaApi.evaluateCode("clj", "(+ 2 40)").catch((e) => {
      console.error("Evaluation error:", e);
    });
    if (result) {
      console.log(evaluation.result);
    }
    ```

### Handling Output

The `output` member on the `Result` object will have any output produced during evaluation. (The `errorOutput` member should contain error output produced, but currently some Calva bug makes this not work.) By default the stdout and stderr output is not printed anywhere.

If you want to do something with either regular output or error output during, or after, evaluation, you'll need to provide the `output` argument to `evaluateCode()`. (The `stderr` callback function works, so this is the only way to get at any error output, until the above mentioned Calva bug is fixed.)

An example:

=== "ClojureScript"

    ```clojure
    (def oc (joyride.core/output-channel)) ;; Assuming Joyride is used
    (def evaluate (fn [code]
                    ((:evaluateCode calvaApi)
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
    const evaluate = (code) => {
      calvaApi.evaluateCode("clj", code, {
        stdout: (s) => {
          console.log(s);
        },
        stderr: (s) => {
          console.error(s);
        },
      });
    };

    const result = await calvaApi.evaluateCode("(println :foo) (+ 2 40)").catch((e) => {
      console.error("Evaluation error:", e);
    });
    if (result) {
      console.log("=>", evaluation.result);
    }
    ```

## Feedback Welcome

Please let us know how you fare using this API. Either in the #calva or #joyride channels on Slack or via the issues/discussions sections on the repositories. (Whichever seems to apply best.)