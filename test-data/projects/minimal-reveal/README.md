# minimal reveal project w/ nrepl middleware

To check that the Reveal nrepl middleware works for you, you can try this first without Calva:

## Start the nREPL server

In one terminal:

```sh
clojure -Sdeps '{:deps {nrepl/nrepl {:mvn/version,"1.0.0"},cider/cider-nrepl {:mvn/version,"0.28.5"}}}' -A:reveal-nrepl-middleware
nREPL server started on port ... on host localhost - nrepl://localhost:...
```

You should see the Reveal window open. Blank.

## Connect to the nREPL server

In another terminal:

```sh
clojure -Sdeps '{:deps {reply/reply {:mvn/version "0.5.1"}}}' -M -m reply.main --attach `< .nrepl-port`
REPL-y 0.5.1, nREPL 1.0.0
Clojure 1.11.1
OpenJDK 64-Bit Server VM 18.0.2.1+1
        Exit: Control+D or (exit) or (quit)
    Commands: (user/help)
        Docs: (doc function-name-here)
              (find-doc "part-of-name-here")
Find by Name: (find-name "part-of-name-here")
      Source: (source function-name-here)
     Javadoc: (javadoc java-object-or-class-here)
WARNING: cat already refers to: #'clojure.core/cat in namespace: net.cgrand.parsley.fold, being replaced by: #'net.cgrand.parsley.fold/cat
user=> 
```

You should see the same things echoed in the Reveal window.

Evaluate something on that prompt. Say:

```clojure
user=> 42
42
```

You should see this evaluation happening in the Reveal window too.

## Using Calva

Jack-in selecting the deps.edn project type and select to launch with the alias `:reveal-nrepl-middleware`.

You should see the Reveal window open.

Load `src/hello.clj` and evaluate something there.

You should see the evaluation echo in the Reveal window.