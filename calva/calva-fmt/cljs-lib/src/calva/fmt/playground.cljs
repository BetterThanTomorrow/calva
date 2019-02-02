(ns calva.fmt.playground
  (:require [cljfmt.core :as cljfmt]
            #_[zprint.core :refer [zprint-str]]
            ["parinfer" :as parinfer]
            ["paredit.js" :as paredit]
            [calva.js-utils :refer [cljify jsify]]
            [calva.fmt.util :as util]))


(comment
  (cljify (paredit/parse "(\"(\")"))
  (cljify (paredit/parse "[]"))
  (cljify ((.. paredit -walk -sexpsAt) (paredit/parse "[][]") 3 pr-str))
  (cljify ((.. paredit -walk -containingSexpsAt) (paredit/parse "[][]") 0 pr-str))
  (cljify ((.. paredit -walk -containingSexpsAt) (paredit/parse "([][])") 0 pr-str))
  (-> [{:type "toplevel", :start 0, :end 6, :errors [], :children [{:type "list", :start 0, :end 6, :children [{:type "list", :start 1, :end 3, :children [], :open "[", :close "]"} {:type "list", :start 3, :end 5, :children [], :open "[", :close "]"}], :open "(", :close ")"}]}]
      first
      :children
      count)
  (-> (cljify ((.. paredit -walk -containingSexpsAt) (paredit/parse "[][]") "a" identity)))
  (-> (cljify ((.. paredit -walk -containingSexpsAt) (paredit/parse "[][]") [0 4] identity)))
  (-> (cljify ((.. paredit -walk -containingSexpsAt) (paredit/parse "#()") 0 identity))
      count)
  (-> (cljify ((.. paredit -walk -containingSexpsAt) (paredit/parse "()") 0 identity))
      count)
  (-> (cljify ((.. paredit -walk -sexpsAt) (paredit/parse "[][]") 0 identity))
      first
      :children
      count)
  (-> (cljify ((.. paredit -walk -sexpsAt) (paredit/parse "([][])") 0 identity))
      first
      :children
      count)
  (-> (cljify ((.. paredit -walk -sexpsAt) (paredit/parse "{[][]}") 0 identity))
      first
      :children
      first)
  (-> (cljify ((.. paredit -walk -sexpsAt) (paredit/parse "\"\"") 0 identity))
      first
      :children
      count)
  (-> (cljify ((.. paredit -walk -sexpsAt) (paredit/parse "\"\"") 0 identity))
      first
      :children
      first
      :type)
  (-> (cljify ((.. paredit -walk -sexpsAt) (paredit/parse "'#([])") 3 identity))
      first
      :children
      (nth 2)
      :type)
  (-> (cljify ((.. paredit -walk -containingSexpsAt) (paredit/parse "'()") 0 identity))
      first
      :children
      first
      :type)
  (cljify (paredit/parse "[][]"))
  (cljify (paredit/parse "([][])")))

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