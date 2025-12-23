(defproject lein-app "0.1.0-SNAPSHOT"
  :description "FIXME: write description"
  :dependencies [[org.clojure/clojure "1.11.1"]
                 [org.clojure/clojurescript "1.11.60"]
                 [thheller/shadow-cljs "2.19.9"]
                 [binaryage/devtools "1.0.6"]
                 [reagent "1.1.1"]]
  :repl-options {:nrepl-middleware [shadow.cljs.devtools.server.nrepl/middleware]}
  :source-paths ["src"]
  :main ^:skip-aot main.server
  :target-path "target/%s"
  :profiles {:uberjar {:aot :all
                       :jvm-opts ["-Dclojure.compiler.direct-linking=true"]}})
