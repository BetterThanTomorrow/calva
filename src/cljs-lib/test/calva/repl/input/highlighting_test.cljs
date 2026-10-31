(ns calva.repl.input.highlighting-test
  (:require
   [calva.repl.input.highlighting :as sut]
   [calva.repl.webview.token-colors :as token-colors]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private palette
  {:palette/token-rules (token-colors/token-rules [{"scope" "constant" "settings" {"foreground" "#blue"}}
                                                   {"scope" "keyword" "settings" {"foreground" "#red"}}
                                                   {"scope" "storage" "settings" {"foreground" "#red"}}
                                                   {"scope" "entity.name" "settings" {"foreground" "#orange"}}
                                                   {"scope" "entity.name.function" "settings" {"foreground" "#purple"}}
                                                   {"scope" "support" "settings" {"foreground" "#support"}}
                                                   {"scope" "variable.other" "settings" {"foreground" "#fg"}}])
   :palette/semantic? true
   :palette/semantic-rules []})

(def ^:private semantic-rules
  [["function" "#f1"]
   ["function.definition" {"foreground" "#f2"}]
   ["macro.definition" "#f3"]
   ["variable:java" "#v1"]
   ["variable" {"italic" true}]])

(defn- token
  [text from to & scopes]
  [from to (vec (cons "source.clojure" scopes)) (subs text from to)])

(deftest semantic-color-test
  (testing "colors a type with the theme's rule for its scopes"
    (is (= "#purple" (sut/semantic-color palette "function" [])))
    (is (= "#fg" (sut/semantic-color palette "variable" [])))
    (is (= "#red" (sut/semantic-color palette "keyword" [])))
    (is (= "#orange" (sut/semantic-color palette "type" []))))
  (testing "colors macros with Calva's scopes for Clojure, over VS Code's default for macros"
    (is (= "#red" (sut/semantic-color palette "macro" []))))
  (testing "colors default library functions with VS Code's default for the modifier"
    (is (= "#support" (sut/semantic-color palette "function" ["defaultLibrary"]))))
  (testing "prefers the semantic token rule with the highest score that matches"
    (let [with-rules (assoc palette :palette/semantic-rules semantic-rules)]
      (is (= "#f1" (sut/semantic-color with-rules "function" [])))
      (is (= "#f2" (sut/semantic-color with-rules "function" ["definition"])))
      (is (= "#f3" (sut/semantic-color with-rules "macro" ["definition"])))
      (is (= "#fg" (sut/semantic-color with-rules "variable" []))
          "A rule for another language, or without a foreground, leaves the token to the defaults")))
  (testing "takes the later of equally scoring rules, as the user's come after the theme's"
    (let [theme-then-user [["function" "#theme"] ["*.definition" "#user"]]]
      (is (= "#user" (sut/semantic-color (assoc palette :palette/semantic-rules theme-then-user) "function" ["definition"])))))
  (testing "has no color for a type without a rule or scopes"
    (is (nil? (sut/semantic-color palette "property" [])))))

(deftest keyword-tokens-test
  (let [text ":a ::b :ns/c ::al/d ^:private x"
        tokens [(token text 0 2 "constant.keyword.clojure")
                (token text 3 6 "constant.keyword.clojure")
                (token text 7 12 "constant.keyword.clojure")
                (token text 13 19 "constant.keyword.clojure")
                (token text 20 21 "meta.metadata.simple.clojure")
                (token text 21 22 "meta.metadata.simple.clojure")
                (token text 22 29 "meta.metadata.simple.clojure" "entity.name.variable.clojure")
                (token text 30 31 "entity.name.variable.clojure")]]
    (testing "gives the keywords' parts the types clojure-lsp gives files"
      (is (= [[1 2 "keyword"]
              [5 6 "keyword"]
              [8 10 "type"] [10 11 "event"] [11 12 "keyword"]
              [15 17 "type"] [17 18 "event"] [18 19 "keyword"]
              [22 29 "keyword"]]
             (sut/keyword-tokens text tokens))))))

(deftest highlighting-test
  (let [text "(let [x :k])"
        tokens [(token text 1 4 "meta.expression.clojure" "storage.control.clojure")
                (token text 6 7 "meta.expression.clojure" "entity.name.variable.clojure")
                (token text 8 10 "meta.expression.clojure" "constant.keyword.clojure")]]
    (testing "colors the grammar's tokens, and the keyword names as semantic tokens"
      (is (= [[1 4 "#red"] [6 7 "#orange"] [8 9 "#blue"] [9 10 "#red"]]
             (sut/highlighting palette text tokens))))
    (testing "leaves the keywords to the grammar without semantic highlighting"
      (is (= [[1 4 "#red"] [6 7 "#orange"] [8 10 "#blue"]]
             (sut/highlighting (assoc palette :palette/semantic? false) text tokens))))))

(def ^:private legend
  {:tokenTypes ["macro" "variable" "comment"] :tokenModifiers ["definition" "defaultLibrary"]})

(deftest decode-test
  (testing "turns LSP's relative positions into lines and characters, with the types and modifiers"
    (is (= [[3 1 3 "macro" []] [3 6 1 "variable" ["definition" "defaultLibrary"]] [4 2 1 "variable" []]]
           (sut/decode legend [3 1 3 0 0, 0 5 1 1 3, 1 2 1 1 0]))))
  (testing "decodes no data to no tokens"
    (is (= [] (sut/decode legend [])))))

(deftest semantic-ranges-test
  (let [text "(let [x 1]\n  x)"]
    (testing "places the tokens from the line where the text starts, and colors them"
      (is (= [[1 4 "#red"] [6 7 "#fg"] [13 14 "#fg"]]
             (sut/semantic-ranges palette [[3 1 3 "macro" []] [3 6 1 "variable" ["definition"]] [4 2 1 "variable" []]] 3 text))))
    (testing "leaves out tokens before the text and comment tokens"
      (is (= [[6 7 "#fg"]]
             (sut/semantic-ranges palette [[0 0 4 "macro" []] [3 0 4 "comment" []] [3 6 1 "variable" []]] 3 text))))))
