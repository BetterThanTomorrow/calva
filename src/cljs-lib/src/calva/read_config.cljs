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

(defn convert-edn-config-to-js
  [config]
  (jsify (update-config-edn config)))

(defn ^:export convert-edn-config-to-js-bridge
  [config]
  (convert-edn-config-to-js config))

(comment
  (parse/parse-clj-edn "{:foo (str \"**EDN edn current-form**: \" $current-form)}")
  (update-config-edn "{:customREPLCommandSnippets
                      [{:name \"foo\"
                      :snippet (str \"**EDN edn current-form**: \" $current-form)}]}"))