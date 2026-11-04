(ns calva.repl.webview.near-colors-test
  (:require
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.near-colors :as sut]
   [calva.repl.webview.printed-code.editor :as printed-code-editor]
   [cljs.test :refer-macros [deftest is testing]]))

(def ^:private colors
  {:ranges [[0 2 "#ff0000"]] :marks []})

(defn- output-with-code
  "Returns `#output` with a block of colored code, a block of code too long to color, and a stdout block."
  []
  (fake-document/hiccup-element
   [:div {:id "output"}
    [:pre {:class ["output-code-block"]}
     [:code {:class ["output-code" "clojure-code"] :data-highlighted "grammar"}
      [:span {:class ["code-color-ff0000"]} "(a"] " b)"]]
    [:pre {:class ["output-code-block"]}
     [:code {:class ["output-code" "clojure-code"] :data-highlighted "plain"} "(c d)"]]
    [:pre "out"]]))

(defn- code-of
  [^js block]
  (.querySelector block "code"))

(defn- spans?
  [^js block]
  (some? (.querySelector (code-of block) "span")))

(defn- with-selection-in
  "Calls `f` with the page's selection reaching into `block`."
  [^js block f]
  (set! js/globalThis.getSelection (fn [] #js {:isCollapsed false
                                               :containsNode (fn [node _] (identical? node block))}))
  (try
    (f)
    (finally
      (js-delete js/globalThis "getSelection"))))

(deftest near-test
  (sut/forget-reports!)
  (let [[block] (array-seq (.-children (output-with-code)))]
    (is (sut/near? block) "A block not reported yet counts as near")
    (sut/set-near! block false)
    (is (not (sut/near? block)) "A block reported far")
    (sut/set-near! block true)
    (is (sut/near? block) "A block reported near")
    (sut/set-near! block false)
    (sut/forget-reports!)
    (is (sut/near? block) "Forgotten reports count as near again")))

(deftest output-block-test
  (let [output (output-with-code)
        [block] (array-seq (.-children output))]
    (is (identical? block (sut/output-block (code-of block))) "The child of #output that holds the code")
    (is (nil? (sut/output-block (fake-document/hiccup-element [:code "x"]))) "Code outside the output")))

(deftest far-and-near-test
  (sut/forget-reports!)
  (let [[block plain-block] (array-seq (.-children (output-with-code)))
        code (code-of block)]
    (printed-code-editor/drawn! code colors)
    (sut/set-near! block false)
    (is (not (spans? block)) "A far block is drawn without its spans")
    (is (= "(a b)" (.-textContent code)) "with its text")
    (is (= "grammar" (.. code -dataset -highlighted)) "and how it is colored")
    (sut/set-near! block true)
    (is (spans? block) "A block that comes near gets its spans")
    (is (= "(a b)" (.-textContent code)) "around the same text")
    (sut/set-near! plain-block true)
    (is (not (spans? plain-block)) "Code too long to color stays as it is")))

(deftest set-spans-test
  (sut/forget-reports!)
  (let [[block] (array-seq (.-children (output-with-code)))
        code (code-of block)]
    (testing "a block not reported yet is colored"
      (sut/set-spans! code (:ranges colors) [])
      (is (spans? block)))
    (testing "a far block is drawn without spans, also when it had some"
      (printed-code-editor/drawn! code colors)
      (sut/set-near! block false)
      (sut/set-near! block true)
      (is (spans? block))
      (sut/set-near! block false)
      (sut/set-spans! code (:ranges colors) [])
      (is (not (spans? block))))))

(deftest kept-by-the-selection-test
  (sut/forget-reports!)
  (let [[block] (array-seq (.-children (output-with-code)))
        code (code-of block)]
    (set! (.-isConnected block) true)
    (printed-code-editor/drawn! code colors)
    (with-selection-in block
      (fn []
        (sut/set-near! block false)
        (is (spans? block) "A far block the selection reaches into keeps its spans")
        (sut/release-kept!)
        (is (spans? block) "and keeps them while the selection is there")))
    (sut/release-kept!)
    (is (not (spans? block)) "A kept block is drawn without its spans once the selection leaves it")))

(deftest kept-block-coming-near-test
  (sut/forget-reports!)
  (let [[block] (array-seq (.-children (output-with-code)))
        code (code-of block)]
    (set! (.-isConnected block) true)
    (printed-code-editor/drawn! code colors)
    (with-selection-in block #(sut/set-near! block false))
    (sut/set-near! block true)
    (sut/release-kept!)
    (is (spans? block) "A kept block that came near keeps its spans when the selection leaves")))
