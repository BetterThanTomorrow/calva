(ns calva.fmt.playground
  (:require [cljfmt.core :as cljfmt]
            #_[zprint.core :refer [zprint-str]]
            ["parinfer" :as parinfer]
            [calva.js-utils :refer [cljify jsify]]
            [calva.fmt.util :as util]))


(comment
  (foo
   ;;
   bar
   baz))

(comment
  (cond)
  (cljfmt/reformat-string "(cond foo\n)\n\n(cond foo\nbar)"
                          {:remove-surrounding-whitespace? false})

  (cljfmt/reformat-string "(-> foo\nbar\n)\n(foo bar\nbaz\n)"
                          {:remove-surrounding-whitespace? false
                           :remove-trailing-whitespace? false
                           :remove-consecutive-blank-lines? false})

  (cljfmt/reformat-string "(let [x y\na b]\nbar\n)\n\n(-> foo\nbar\n)\n\n(foo bar\nbaz\n)"
                          {:remove-surrounding-whitespace? false
                           :remove-trailing-whitespace? false
                           :remove-consecutive-blank-lines? false
                           :indents ^:replace {#".*" [[:inner 0]]}})

  (cljfmt/reformat-string "  '([]
[])" {:remove-surrounding-whitespace? false
      :remove-trailing-whitespace? false
      :remove-consecutive-blank-lines? false})


  (def str "(defn \n\n)")

  (cljfmt/reformat-string str {:remove-surrounding-whitespace? false
                               :remove-trailing-whitespace? false
                               :remove-consecutive-blank-lines? false})

  (cljfmt/reformat-string "(foo
       ;;
   bar
   baz)"
                          {:remove-surrounding-whitespace? false
                           :remove-trailing-whitespace? false
                           :remove-consecutive-blank-lines? false})

  (cljfmt/reformat-string
   "(foo
  
)"
   {:remove-surrounding-whitespace? false
    :remove-trailing-whitespace? false
    :indentation? true})

  (cljfmt/reformat-string "(bar\n \n)"
                          {:remove-surrounding-whitespace? false
                           :remove-trailing-whitespace? false})

  (cljfmt/reformat-string "(ns ui-app.re-frame.db)

(def default-db #::{:page :home})")

  (cljfmt/reformat-string
   "(defn bar\n    [x]\n\n    baz)")

  (zprint-str "(defn bar\n    [x]\n\n    baz)"
              {:style :community
               :parse-string-all? true
               :fn-force-nl #{:arg1-body}})

  (cljfmt/reformat-string
   "(defn bar\n    [x]\n\n    baz)")

  "(defn bar\n    [x]\n  \n    baz)"

  (cljfmt/reformat-string
   ";; foo
(defn foo [x]
  (* x x))
  0")

  (div
  ;; foo
   [:div]
  ;; bar
   [:div]))


(comment
  (parinfer/indentMode "    (foo []
       (bar)
       (baz)))"
                       (jsify {:cursorLine 2
                               :cursorX 13})))

(comment
  (cljfmt/reformat-string
   "{:foo false
    :bar false
:baz #\"^[a-z]\"}"))

(comment
  (def t "(when something
  body)

(defn f [x]
  body)

(defn f
  [x]
  body)

(defn many-args [a b c
                 d e f]
  body)

(defn multi-arity
  ([x]
   body)
  ([x y]
   body))

(let [x 1
      y 2]
  body)

[1 2 3
 4 5 6]

{:key-1 v1
 :key-2 v2}

#{a b c
  d e f}

(or (condition-a)
  (condition-b))

(filter even?
  (range 1 10))

(clojure.core/filter even?
  (range 1 10))

(filter
 even?
  (range 1 10))")

  (def f
    (cljfmt/reformat-string t {:indents {#"^\w" [[:inner 0]]}}))

  (= t f)
  (pr-str f)
  (println f))