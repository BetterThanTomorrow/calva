(ns calva.pprint.printer
  (:require [zprint.core :refer [zprint-str]]
            [calva.js-utils :refer [jsify cljify]]
            [clojure.string]))

(defn pretty-print
  "Parses the string `s` as EDN and returns it pretty printed as a string.
   Accepts that s is an EDN form already, and skips the parsing, if so.
   Formats the result to fit the width `w`."
  [s opts]
  (let [result (try
                 {:value
                  (zprint-str s (assoc opts :parse-string? (string? s)))}
                 (catch js/Error e
                   {:value s
                    :error (str "Plain printing, b/c pprint failed. (" (.-message e) ")")}))]
    result))


(defn pretty-print-js [s {:keys [width, maxLength, maxDepth]}]
  (let [opts (into {} (remove (comp nil? val) {:width width
                                               :max-length maxLength
                                               :max-depth maxDepth}))]
    (jsify (pretty-print s opts))))

(defn pretty-print-js-bridge [s ^js opts]
  (pretty-print-js s (cljify opts)))


;; SCRAP
(comment
  (pretty-print "[    [ [:foo
                      ]]        ]" nil)
  ;; => {:value "[[[:foo]]]"}
  (pretty-print [[:shallow]] {:max-depth 1})
  ;; => {:value "[##]"}
  (pretty-print [[[[[[[[:deeper]]]]]]]] {:max-depth 4})
  ;; => {:value "[[[[##]]]]"}
  
  (def ignores [#_#_#_#_#_:span "This" "is" "How" "it" "Works"])
  (:value (pretty-print ignores nil))
  ;; => "[(quote \"Works\")]"
  
  (def str-ignores "[  #_  #_  #_#_#_:span \"This\" \"is\" \"How\" \"it\" \"Works\"   ]")
  (:value (pretty-print str-ignores nil))
  ;; => "[#_#_#_#_#_:span \"This\" \"is\" \"How\" \"it\" \"Works\"]"
  
  (def struct '(let [r :r
                     this-page :this-page]
                 [:div.grid-x.grid-margin-x.grid-margin-y
                  [:div.cell.align-center.margin-top.show-for-medium
                   [:a#foo.button
                    {:href "#how-it-works"}
                    [#_#_#_#_#_:span "This" "is" "How" "it" "Works"]]
                   [:a#bar.button
                    {:on-click #(citrus/broadcast! r :submit this-page)}
                    "Send"]]]))
  (:value (pretty-print struct nil))
  ;; => "(let [r :r\n      this-page :this-page]\n  [:div.grid-x.grid-margin-x.grid-margin-y\n   [:div.cell.align-center.margin-top.show-for-medium\n    [:a#foo.button {:href \"#how-it-works\"} [\"Works\"]]\n    [:a#bar.button {:on-click (fn* [] (citrus/broadcast! r :submit this-page))}\n     \"Send\"]]])"

  (:value (pretty-print struct {:max-length 2}))
  ;; => "(let [r :r ...] ...)"

  (:value (pretty-print struct {:max-length 3}))
  ;; => "(let [r :r\n      this-page :this-page]\n  [:div.grid-x.grid-margin-x.grid-margin-y\n   [:div.cell.align-center.margin-top.show-for-medium\n    [:a#foo.button {:href \"#how-it-works\"} [\"Works\"]]\n    [:a#bar.button {:on-click (fn* [] (citrus/broadcast! r :submit ...))}\n     \"Send\"]]])"
  )