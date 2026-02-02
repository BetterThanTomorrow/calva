(ns calva.read-config
  (:require [calva.js-utils :refer [jsify]]
            [calva.parse :as parse]
            [clojure.string :as str]
            [clojure.walk :as walk]
            [vvvvalvalval.supdate.api :refer [supdate]]))

(def ^:private updaters {:customReplCommandSnippets [{:snippet str}]
                         :customReplHoverSnippets   [{:snippet str}]
                         :customREPLCommandSnippets [{:snippet str}]  ;; backward compat
                         :customREPLHoverSnippets   [{:snippet str}]  ;; backward compat
                         })

(defn- kebab->camel
  "Converts a kebab-case string to camelCase.
   'custom-pair-forms' => 'customPairForms'"
  [s]
  (let [[first-part :as parts] (str/split s #"-")]
    (->> parts rest (map str/capitalize) (cons first-part) (apply str))))

(defn- kebab-keyword->camel-keyword
  "Converts a kebab-case keyword to camelCase keyword.
   :custom-pair-forms => :customPairForms
   Preserves namespaced keywords (e.g., :foo/bar-baz => :foo/barBaz)"
  [kw]
  (let [ns-part (namespace kw)
        name-part (name kw)
        camel-name (kebab->camel name-part)]
    (if ns-part
      (keyword ns-part camel-name)
      (keyword camel-name))))

(defn- transform-keys-to-camel
  "Recursively transforms all map keys from kebab-case to camelCase"
  [m]
  (walk/postwalk
    (fn [x]
      (if (map? x)
        (into {} (map (fn [[k v]]
                        [(if (keyword? k)
                           (kebab-keyword->camel-keyword k)
                           k)
                         v])
                      x))
        x))
    m))

(defn update-config-edn
  [config]
  (-> config
      parse/parse-clj-edn
      transform-keys-to-camel
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

