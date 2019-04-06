(ns calva.js-utils
  (:require [cljs.reader]))

(defn ^:export jsify [o]
  (clj->js o))

(defn ^:export cljify [o]
  (js->clj o :keywordize-keys true))

(defn parse-edn [s]
  #_(println (pr-str s))
  (clj->js (cljs.reader/read-string s)))

(comment
  (parse-edn ";; shadow-cljs configuration\n{:source-paths [\"src\"]\n\n\n :dependencies [[binaryage/dirac          \"1.2.30\"]\n                [binaryage/devtools       \"0.9.8\"]\n                [org.clojure/tools.reader \"1.1.0\"]\n                [rum                      \"0.11.0\"]\n                [com.rpl/specter          \"1.1.0\"]\n                [funcool/potok            \"2.3.0\"]\n                [funcool/beicon           \"4.1.0\"]\n                [funcool/rxhttp           \"1.0.0-SNAPSHOT\"]]\n\n\n :builds {:server {:target    :node-script\n                   :main      two-in-shadows.server/main\n                   :compiler-options {:source-map-use-fs-paths true}\n                   :output-to \"out/server.js\"}\n\n          :client {:target     :browser\n                   :modules    {:main {:entries [two-in-shadows.client]}}\n                   :output-dir \"public/js\"\n                   :asset-path \"/js\"\n                   :devtools   {:http-root  \"public\"\n                                :http-port  8280\n                                :after-load two-in-shadows.client/mount-root\n                                :preloads   [dirac.runtime.preload devtools.preload]}}}}\n"))