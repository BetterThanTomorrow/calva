# Using Calva with REBL
To use this extension with REBL do the following.

## Clojure CLI

1.  Add your aliases to your deps.edn file. Use the deps.edn file in the `~/.clojure` directory to enable alias reuse across multiple projects.

* Add the REBL and nREBL aliases to your deps.edn file. Below is the configuration for REBL on openjdk 12

```clojure
;; REBL Base
:rebl
{:extra-deps {org.clojure/core.async {:mvn/version "0.4.490"}
                ;; deps for file datafication (0.9.149 or later)
                org.clojure/data.csv {:mvn/version "0.1.4"}
                org.clojure/data.json {:mvn/version "0.2.3"}
                org.yaml/snakeyaml {:mvn/version "1.23"}
                com.cognitect/rebl
                ;; adjust to match your install location
                {:local/root "/Users/ozimos/REBL/latest/REBL.jar"}}}
;; REBL 12
:rebl-12
{:extra-deps {org.openjfx/javafx-fxml     {:mvn/version "12.0.1"}
                org.openjfx/javafx-controls {:mvn/version "12.0.1"}
                org.openjfx/javafx-graphics {:mvn/version "12.0.1"}
                org.openjfx/javafx-media    {:mvn/version "12.0.1"}
                org.openjfx/javafx-swing    {:mvn/version "12.0.1"}
                org.openjfx/javafx-base     {:mvn/version "12.0.1"}
                org.openjfx/javafx-web      {:mvn/version "12.0.1"}}}

;; nREBL
:nrebl {:extra-deps {rickmoynihan/nrebl.middleware {:mvn/version "0.2.0"}}
            :main-opts ["-e" "((requiring-resolve,'cognitect.rebl/ui))" "-m" "nrepl.cmdline" "--middleware" "[nrebl.middleware/wrap-nrebl]" "-I"]}      
```

Check out the [REBL github page](https://github.com/cognitect-labs/REBL-distro)  for more info

2. Create a Calva custom connect sequence for your VSCode editor

* Read [Custom REPL Connect Sequences](connect-sequences.md) if you haven't
* Add the following to your vscode settings.json
```json
{
    "calva.replConnectSequences": [
        {
            "name": "Rebl Connect",
            "projectType": "Clojure CLI",
            "menuSelections": {
                "cljAliases": [
                    "rebl",
                    "rebl-12",
                    "nrebl"
                ],
            }
        }
    ]
}
```
## Leiningen (TBD)

TBD. If you know how to do it, please update this page.

## shadow-cljs (TBD)

TBD. If you know how to do it, please update this page.
