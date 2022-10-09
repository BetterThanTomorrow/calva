(ns calva.read-config
  (:require [calva.js-utils :refer [jsify]]
            [calva.parse :as parse]
            [vvvvalvalval.supdate.api :refer [supdate]]))

(def ^:private updaters {:customREPLCommandSnippets [{:snippet str}]
                         :customREPLHoverSnippets   [{:snippet str}]})

(defn update-config-edn
  [config]
  (-> config
      parse/parse-clj-edn
      (supdate updaters)))

(defn config-edn->js
  [config]
  (jsify (update-config-edn config)))

(defn ^:export config-edn->js-bridge
  [config]
  (config-edn->js config))

(comment 
  (parse/parse-clj-edn "{:foo (str \"**EDN edn current-form**: \" $current-form)}")
  (update-config-edn "{:customREPLCommandSnippets 
                      [{:name \"foo\"
                      :snippet (str \"**EDN edn current-form**: \" $current-form)}]}"))

