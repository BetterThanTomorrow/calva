(ns calva.repl.webview.token-colors-test
  (:require
   [calva.repl.webview.token-colors :as sut]
   [cljs.test :refer [deftest is testing]]))

(def token-colors
  [{"scope" "constant" "settings" {"foreground" "#79c0ff"}}
   {"scope" ["storage" "storage.type"] "settings" {"foreground" "#ff7b72"}}
   {"scope" "entity.name.function, entity.name.function.clojure" "settings" {"foreground" "#d2a8ff"}}
   {"scope" "comment" "settings" {"fontStyle" "italic"}}
   {"settings" {"foreground" "#e6edf3"}}
   {"scope" "constant" "settings" {"foreground" "#000000"}}])

(deftest token-rules-test
  (is (= [["constant" "#79c0ff"]
          ["storage" "#ff7b72"]
          ["storage.type" "#ff7b72"]
          ["entity.name.function" "#d2a8ff"]
          ["entity.name.function.clojure" "#d2a8ff"]
          ["constant" "#000000"]]
         (sut/token-rules token-colors))
      "String selectors split on commas, arrays stay, and rules without a scope or a foreground drop"))

(deftest resolve-foreground-test
  (let [rules (sut/token-rules token-colors)]
    (is (= "#ff7b72" (sut/resolve-foreground rules "storage.control.clojure"))
        "storage is a prefix of storage.control.clojure")
    (is (= "#d2a8ff" (sut/resolve-foreground rules "entity.name.function.clojure"))
        "The exact selector wins over its shorter prefix")
    (is (= "#000000" (sut/resolve-foreground rules "constant.keyword.clojure"))
        "On equal length the later rule wins")
    (is (nil? (sut/resolve-foreground rules "string.quoted.double.clojure"))
        "No matching selector, no foreground")
    (is (nil? (sut/resolve-foreground rules "constantly.clojure"))
        "A prefix matches on whole scope segments only")))

(deftest hljs-colors-test
  (is (= {"keyword" "#ff7b72"
          "name" "#d2a8ff"
          "built_in" "#d2a8ff"
          "symbol" "#000000"
          "number" "#000000"
          "literal" "#000000"}
         (sut/hljs-colors token-colors))
      "Scopes without a resolved foreground are left out"))

(def themes
  [{:theme/id "Default Dark Modern" :theme/label "Dark Modern" :theme/ui-theme "vs-dark" :theme/file "dark_modern.json"}
   {:theme/label "GitHub Dark Default" :theme/ui-theme "vs-dark" :theme/file "dark-default.json"}
   {:theme/label "GitHub Light Default" :theme/ui-theme "vs" :theme/file "light-default.json"}
   {:theme/id "Default High Contrast" :theme/label "Dark High Contrast" :theme/ui-theme "hc-black" :theme/file "hc_black.json"}])

(def dark 2)
(def light 1)
(def high-contrast 3)

(deftest active-theme-test
  (testing "workbench.colorTheme names the theme"
    (is (= "dark-default.json"
           (:theme/file (sut/active-theme themes {:workbench/color-theme "GitHub Dark Default"
                                                  :workbench/preferred-color-theme "Default Dark Modern"}
                                          dark)))
        "By label, for a theme without an id")
    (is (= "dark_modern.json"
           (:theme/file (sut/active-theme themes {:workbench/color-theme "Default Dark Modern"}
                                          dark)))
        "By id"))
  (testing "The preferred theme for the kind"
    (is (= "dark_modern.json"
           (:theme/file (sut/active-theme themes {:workbench/color-theme "GitHub Dark Default"
                                                  :workbench/preferred-color-theme "Default Dark Modern"
                                                  :window/auto-detect-color-scheme? true}
                                          dark)))
        "wins when the color scheme follows the OS")
    (is (= "hc_black.json"
           (:theme/file (sut/active-theme themes {:workbench/color-theme "GitHub Dark Default"
                                                  :workbench/preferred-color-theme "Default High Contrast"}
                                          high-contrast)))
        "is used when workbench.colorTheme is of another kind, as when the OS is in high contrast"))
  (is (nil? (sut/active-theme themes {:workbench/color-theme "GitHub Dark Default"} light))
      "No theme of the active kind, no theme"))

(deftest customization-rules-test
  (let [customizations {"textMateRules" [{"scope" "comment" "settings" {"foreground" "#111111"}}]
                        "[GitHub Dark Default]" {"textMateRules" [{"scope" "comment" "settings" {"foreground" "#222222"}}]}
                        "[Default Dark Modern]" {"textMateRules" [{"scope" "comment" "settings" {"foreground" "#333333"}}]}
                        "[Monokai]" {"textMateRules" [{"scope" "comment" "settings" {"foreground" "#444444"}}]}}]
    (is (= ["#111111" "#222222"]
           (map #(get-in % ["settings" "foreground"])
                (sut/customization-rules customizations (second themes))))
        "The rules for every theme, then the rules for the theme by label")
    (is (= ["#111111" "#333333"]
           (map #(get-in % ["settings" "foreground"])
                (sut/customization-rules customizations (first themes))))
        "A theme with an id gets its rules by id")
    (is (empty? (sut/customization-rules nil (first themes)))
        "No customizations, no rules")))
