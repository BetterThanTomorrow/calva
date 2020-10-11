# How to Use Calva and REBL Together

[REBL](https://github.com/cognitect-labs/REBL-distro) is a graphical, interactive tool for browsing Clojure data.

## Clojure CLI

Add the following aliases to your deps.edn file. Use the deps.edn file in the `~/.clojure` directory to enable alias reuse across multiple projects. This is the configuration for REBL on openjdk 12. Check out the [REBL github page](https://github.com/cognitect-labs/REBL-distro) for more info.

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
            :main-opts ["-e" "((requiring-resolve,'cognitect.rebl/ui))" "-m""nrepl.    cmdline" "--middleware" "[nrebl.middleware/wrap-nrebl]" "-I"]}
```

Create a Calva custom connect sequence for your VSCode editor. (Read [Custom REPL Connect Sequences](connect-sequences.md) if you haven't.) Add the following to your vscode settings.json:

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
                ]
            }
        }
    ]
}
```
## Leiningen

Add rebl profiles to your [user-wide profiles](https://github.com/technomancy/leiningen/blob/stable/doc/PROFILES.md#declaring-profiles) so that they will be available for all your projects. Here's a sample user profile (located at `~/.lein/profiles.clj` on mac):

```clojure
{:user {:plugins [[lein-ancient "0.6.15"]]}
 
 ;; REBL Base
 :rebl {:resource-paths ["/Users/ozimos/REBL/latest/REBL.jar"]
        :dependencies [[org.clojure/core.async "0.4.490"]
                       [org.clojure/data.csv "0.1.4"]
                       [org.clojure/data.json "0.2.3"]
                       [cljfmt "0.6.4"]
                       [org.yaml/snakeyaml "1.23"]]}

 ;; REBL 12 for JDK 12.0.1. Swap out for your JDK vaersion
 :rebl-12 {:dependencies [[org.openjfx/javafx-fxml  "12.0.1"]
                          [org.openjfx/javafx-controls "12.0.1"]
                          [org.openjfx/javafx-graphics "12.0.1"]
                          [org.openjfx/javafx-media "12.0.1"]
                          [org.openjfx/javafx-swing "12.0.1"]
                          [org.openjfx/javafx-base  "12.0.1"]
                          [org.openjfx/javafx-web "12.0.1"]]}
 
;; NREBL https://github.com/RickMoynihan/nrebl.middleware
 :nrebl {:repl-options {:nrepl-middleware [nrebl.middleware/wrap-nrebl]}
        :dependencies [[rickmoynihan/nrebl.middleware "0.3.1"]]}}
```
[More info here](https://github.com/eccentric-j/lein-rebl-example)

Create a Calva custom connect sequence for your VSCode editor. (Read [Custom REPL Connect Sequences](connect-sequences.md) if you haven't.) Add the following to your vscode settings.json:

```json
{
    "calva.replConnectSequences": [
        {
            "name": "Lein REBL",
            "projectType": "Leiningen",
            "menuSelections": {
                "leinProfiles": ["rebl", "rebl-12", ":nrebl"]
            },
            "afterCLJReplJackInCode": "((requiring-resolve 'cognitect.rebl/ui))"
        }
    ]
}
```

## shadow-cljs (TBD)

TBD. If you know how to do it, please update this page.
