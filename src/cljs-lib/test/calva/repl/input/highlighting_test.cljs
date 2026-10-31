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

(deftest semantic-style-foreground-test
  (testing "colors a type with the theme's rule for its scopes"
    (is (= "#purple" (:foreground (sut/semantic-style palette "function" []))))
    (is (= "#fg" (:foreground (sut/semantic-style palette "variable" []))))
    (is (= "#red" (:foreground (sut/semantic-style palette "keyword" []))))
    (is (= "#orange" (:foreground (sut/semantic-style palette "type" [])))))
  (testing "colors macros with Calva's scopes for Clojure, over VS Code's default for macros"
    (is (= "#red" (:foreground (sut/semantic-style palette "macro" [])))))
  (testing "colors default library functions with VS Code's default for the modifier"
    (is (= "#support" (:foreground (sut/semantic-style palette "function" ["defaultLibrary"])))))
  (testing "prefers the semantic token rule with the highest score that matches"
    (let [with-rules (assoc palette :palette/semantic-rules semantic-rules)]
      (is (= "#f1" (:foreground (sut/semantic-style with-rules "function" []))))
      (is (= "#f2" (:foreground (sut/semantic-style with-rules "function" ["definition"]))))
      (is (= "#f3" (:foreground (sut/semantic-style with-rules "macro" ["definition"]))))
      (is (= "#fg" (:foreground (sut/semantic-style with-rules "variable" [])))
          "A rule for another language, or without a foreground, leaves the token to the defaults")))
  (testing "takes the later of equally scoring rules, as the user's come after the theme's"
    (let [theme-then-user [["function" "#theme"] ["*.definition" "#user"]]]
      (is (= "#user" (:foreground (sut/semantic-style (assoc palette :palette/semantic-rules theme-then-user) "function" ["definition"]))))))
  (testing "has no color for a type without a rule or scopes"
    (is (nil? (:foreground (sut/semantic-style palette "property" []))))))

(deftest highlighting-test
  (let [text "(let [x :k])"
        tokens [(token text 1 4 "meta.expression.clojure" "storage.control.clojure")
                (token text 6 7 "meta.expression.clojure" "entity.name.variable.clojure")
                (token text 8 9 "meta.expression.clojure" "constant.keyword.clojure")
                (token text 9 10 "meta.expression.clojure" "constant.keyword.clojure" "keyword.control.keyword.name.clojure")]]
    (testing "colors each of the grammar's tokens by its innermost scope that a rule matches"
      (is (= [[1 4 "#red" nil] [6 7 "#orange" nil] [8 9 "#blue" nil] [9 10 "#red" nil]]
             (sut/highlighting palette text tokens))))
    (testing "colors a keyword's name as the keyword when the theme has no rule for its own scope"
      (is (= [[1 4 "#red" nil] [6 7 "#orange" nil] [8 10 "#blue" nil]]
             (sut/highlighting (update palette :palette/token-rules #(remove (fn [rule] (= "keyword" (first rule))) %))
                               text
                               tokens))))))

(deftest keyword-parts-colors-test
  (testing "colors the grammar's keyword parts as files color clojure-lsp's tokens for them"
    (doseq [[scope token-type] [["keyword.control.keyword.name.clojure" "keyword"]
                                ["entity.name.type.keyword.namespace.clojure" "type"]
                                ["variable.other.event.keyword.separator.clojure" "event"]]]
      (is (= (:foreground (sut/semantic-style palette token-type []))
             (sut/scope-color (:palette/token-rules palette) ["source.clojure" "constant.keyword.clojure" scope]))
          token-type))))

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
      (is (= [[1 4 "#red" nil] [6 7 "#fg" nil] [13 14 "#fg" nil]]
             (sut/semantic-ranges palette [[3 1 3 "macro" []] [3 6 1 "variable" ["definition"]] [4 2 1 "variable" []]] 3 text))))
    (testing "leaves out tokens before the text and comment tokens"
      (is (= [[6 7 "#fg" nil]]
             (sut/semantic-ranges palette [[0 0 4 "macro" []] [3 0 4 "comment" []] [3 6 1 "variable" []]] 3 text))))))

(def ^:private styled-palette
  (assoc palette
         :palette/font-style-rules (token-colors/font-style-rules [{"scope" "comment" "settings" {"fontStyle" "italic"}}
                                                         {"scope" "comment.line.clojure" "settings" {"fontStyle" ""}}
                                                         {"scope" "entity.name.function" "settings" {"fontStyle" "bold underline"}}])))

(deftest highlighting-font-styles-test
  (let [text ";; a\n#_b"
        tokens [(token text 0 4 "comment.line.semicolon.clojure")
                (token text 5 8 "comment.block.clojure" "comment.line.clojure")]]
    (testing "styles a token by the innermost of its scopes that a font style rule matches, and an empty font style unsets"
      (is (= [[0 4 nil #{:italic}]]
             (sut/highlighting styled-palette text tokens))))))

(deftest semantic-style-test
  (testing "takes the font style of the TextMate rule for a default rule's scopes"
    (is (= {:foreground "#purple" :bold true :underline true :italic false :strikethrough false}
           (sut/semantic-style styled-palette "function" []))))
  (testing "takes each property from the best scoring semantic token rule that sets it, else from the defaults"
    (is (= {:foreground "#purple" :bold true :underline true :italic true :strikethrough false}
           (sut/semantic-style (assoc styled-palette :palette/semantic-rules [["function" {"italic" true}]]) "function" []))))
  (testing "a rule's font style sets all four, the ones it doesn't name as unset"
    (is (= {:foreground "#f" :bold false :underline false :italic true :strikethrough false}
           (sut/semantic-style (assoc palette :palette/semantic-rules [["property" {"foreground" "#f" "fontStyle" "italic"}]]) "property" [])))))

(deftest semantic-style-probing-test
  (testing "stops probing a default rule's scopes at the first that a rule sets a foreground or a font style for"
    (let [bold-function (assoc palette :palette/font-style-rules [["entity.name.function" "bold"]]
                               :palette/token-rules [["support.function" "#support"]])]
      (is (= {:bold true :italic false :underline false :strikethrough false}
             (sut/semantic-style bold-function "function" []))))))

(deftest semantic-style-font-style-test
  (testing "a rule's fontStyle wins over its single font styles"
    (is (false? (:italic (sut/semantic-style (assoc palette :palette/semantic-rules [["property" {"fontStyle" "bold" "italic" true}]]) "property" [])))))
  (testing "a rule's explicit false beats a default's true"
    (is (false? (:bold (sut/semantic-style (assoc styled-palette :palette/semantic-rules [["function" {"bold" false}]]) "function" []))))))

(deftest semantic-ranges-font-styles-test
  (testing "carries the font styles the token's style sets, also without a color"
    (is (= [[0 3 "#purple" {:bold true :underline true :italic false :strikethrough false}]
            [4 5 nil {:italic true}]]
           (sut/semantic-ranges (assoc styled-palette :palette/semantic-rules [["property" {"italic" true}]])
                                [[0 0 3 "function" []] [0 4 1 "property" []]]
                                0
                                "foo x"))))
  (testing "leaves out a token with neither a color nor font styles"
    (is (= [] (sut/semantic-ranges palette [[0 0 3 "property" []]] 0 "foo")))))
