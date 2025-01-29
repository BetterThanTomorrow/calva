(ns calva.pprint.printer
  (:require [zprint.core :as zprint]
            [calva.js-utils :refer [jsify cljify]]
            [clojure.string]
            [clojure.walk :as walk]))

(def colors {:brace :white,
             :bracket :white,
             :char :none,
             :comma :none,
             :comment :italic,
             :deref :blue,
             :false :blue,
             :fn :yellow,
             :hash-brace :white,
             :hash-paren :white,
             :keyword :magenta,
             :left :none,
             :nil :blue,
             :none :blue,
             :number :blue,
             :paren :white,
             :quote :white,
             :regex :green,
             :right :none,
             :string :green,
             :symbol :black,
             :syntax-quote-paren :none
             :true :blue,
             :uneval :none,
             :user-fn :yellow})

(defn pretty-print
  "Parses the string `s` as EDN and returns it pretty printed as a string.
   Accepts that s is an EDN form already, and skips the parsing, if so.
   Formats the result to fit the width `w`."
  [s opts]
  (let [result (try
                 {:value
                  (zprint/zprint-file-str s "Calva" (assoc opts :color-map colors))}
                 (catch js/Error e
                   {:value s
                    :error (str "Pretty print failed. (" (.-message e) ")")}))]
    result))

(defn string-to-keyword [x]
  (if (string? x)
    (keyword x)
    x))

(defn strings->keywords [data]
  (walk/postwalk string-to-keyword data))

(defn pretty-print-js [s {:keys [maxLength, maxDepth, map-commas?] :as all-opts}]
  (let [opts (into {}
                   (remove (comp nil? val)
                           (-> all-opts
                               (dissoc :maxLength :maxDepth :printEngine :enabled :map-commas?)
                               strings->keywords
                               (merge {:max-length maxLength
                                       :max-depth maxDepth}))))
        opts (if (nil? map-commas?)
               opts
               (assoc-in opts [:map :comma?] map-commas?))]
    (jsify (pretty-print s opts))))

(defn ^:export pretty-print-js-bridge [s ^js opts]
  (pretty-print-js s (cljify opts)))


;; SCRAP
(comment
  (pretty-print-js-bridge "a s" #js {:enabled true :map-commas? true})
  (zprint/zprint-file-str "{:a 1, :b 2 :c 3} {:a 1, :b 2 :c 3}" "id" {:map {:comma? false}})
  (zprint/zprint-file-str "a s" "id" {})
  (zprint/zprint-str "a s" {:parse-string? true})
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

  (pretty-print "^[Long] foo" {})
  ;;=> {:value "^[Long] foo"}

  (pretty-print "^Long/1 foo" {})
  ;;=> {:value "^Long/1 foo", :error "Pretty print failed. (Invalid symbol: Long/1.)"}
  )