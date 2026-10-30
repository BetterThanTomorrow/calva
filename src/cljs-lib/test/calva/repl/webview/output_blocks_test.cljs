(ns calva.repl.webview.output-blocks-test
  "The output blocks' hiccup."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is]]
   [lookup.core :as l]))

(deftest ns-info-element-test
  (let [hiccup (ui/ns-info-element {:meta/who "clj"
                                    :meta/repl-session-key "cljs"
                                    :meta/shadow-build ":app"
                                    :meta/ns "user"})]
    (is (= [{:class #{"ns-info-container"} :data-output-element-type "ns-info"}]
           (map l/attrs (l/select :div hiccup))))
    (is (= [["clj" #{"ns-info-badge" "ns-info-who"}]
            ["cljs :app" #{"ns-info-badge" "ns-info-session"}]
            ["user" #{"ns-info-badge" "ns-info-ns"}]]
           (map (juxt l/text (comp :class l/attrs)) (l/select :span hiccup)))
        "The badges show who, the session and the namespace"))
  (is (= ["user"]
         (map l/text (l/select :span (ui/ns-info-element {:meta/who "ui" :meta/ns "user"}))))
      "The REPL Input's evaluations show no who badge"))

(deftest evaluated-code-element-test
  (let [hiccup (ui/evaluated-code-element "(+ 1 2)")]
    (is (seq (l/select :div.evaluated-code-container hiccup)))
    (is (= ["Evaluated code"] (map l/text (l/select :span.border-text hiccup))))
    (is (= ["(+ 1 2)"] (map l/text (l/select '[pre > code.language-clojure] hiccup)))
        "The code is in a pre, for highlight.js")))

(deftest stdout-element-test
  (let [hiccup (ui/stdout-element "hello\n" "evalErr")
        [pre] (l/select :pre hiccup)]
    (is (= {:class #{"output-stdout"} :data-output-element-type "evalErr"} (l/attrs pre)))
    (is (= [:button "hello\n"] (map #(if (vector? %) (first %) %) (l/children pre)))
        "The copy button comes before the text")
    (is (= [{:type "button"
             :class #{"output-copy-button" "output-stdout-copy"}
             :aria-label "Copy output"
             :data-copy-label "Copy output"
             :interestfor "output-tooltip"
             :aria-description "Copy output"
             :data-action "[[:output/ax.copy-stdout :event/target]]"}]
           (map l/attrs (l/select :button hiccup)))
        "The copy button has the page's tooltip and copies through its action")))
