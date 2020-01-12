(ns calva.parse
  (:require [cljs.reader]
            [cljs.tools.reader :as tr]
            [cljs.tools.reader.reader-types :as rt]
            [cljs.test :refer [is]]
            [calva.js-utils :refer [jsify]]))

(defn- parse-edn
  "Parses out the first form from `s`.
   `s` needs to be a string representation of valid EDN.
   Returns the parsed form."
  {:test (fn []
           (is (= (parse-edn "#=(+ 1 2)") "#=(+ 1 2)"))
           (is (= (parse-edn "{:foo [1 2]}") {:foo [1 2]}))
           (is (= (parse-edn "{:foo/bar [1 2]}") {:foo/bar [1 2]}))
           (is (= (parse-edn ":a {:foo ['bar] :bar 'foo}") :a)))}
  [s]
  (cljs.reader/read-string {:default #(str "#" %1 %2)} s))

(defn parse-edn-js [s]
  (jsify (parse-edn s)))

(defn parse-edn-js-bridge [s]
  (parse-edn-js s))

(defn- parse-forms
  "Parses out all top level forms from `s`.
   Returns a vector with the parsed forms."
  {:test (fn []
           (is (= (parse-forms ":a {:foo [bar] :bar foo}")
                  [:a {:foo ['bar] :bar 'foo}]))
           (is (thrown? js/Error (parse-forms ":a {:foo ['bar] :bar 'foo}  #=(+ 1 2)")
                        [:a {:foo ['bar] :bar 'foo}])))}
  [s]
  (let [pbr (rt/string-push-back-reader s)]
    (loop [parsed-forms []]
      (let [parsed-form (tr/read {:eof 'CALVA-EOF
                                  :read-cond :preserve} pbr)]
        (if (= parsed-form 'CALVA-EOF)
          parsed-forms
          (recur (conj parsed-forms parsed-form)))))))

(defn parse-forms-js [s]
  (jsify (parse-forms s)))

(defn parse-forms-js-bridge [s]
  (parse-forms-js s))

(defn parse-clj-edn
  "Reads edn (with regexp tags)"
  ; https://ask.clojure.org/index.php/8675/cljs-reader-read-string-fails-input-clojure-string-accepts
  {:test (fn []
           (is (= (parse-clj-edn "{:foo [1 2]}") {:foo [1 2]}))
           (is (= (parse-clj-edn "{:foo/bar [1 2]}") {:foo/bar [1 2]}))
           (is (= :a (parse-clj-edn ":a {:foo ['bar] :bar 'foo}")))
           (is (= js/RegExp (type (parse-clj-edn "#\"^foo.*bar$\""))))
           (is (= "/^foo.*bar$/" (str (parse-clj-edn "#\"^foo.*bar$\"")))))}
  [s] (tr/read-string s))

;[[ar gu ment] {:as extras, :keys [d e :s t r u c t u r e d]}]
(comment
  (= [:a {:foo [(quote bar)], :bar (quote foo)}]
     [:a {:foo ['bar] :bar 'foo}])
  (parse-forms "(ns calva.js-utils
                  (:require [cljs.reader]
                            [cljs.tools.reader :as tr]
                            [cljs.tools.reader.reader-types :as rt]
                            [cljs.test :refer [is]]))

(defn jsify [o]
  (clj->js o))

(defn cljify [o]
  (js->clj o :keywordize-keys true))")
  (parse-forms "(ns ace2.legacy.bink
                  (:gen-class)
                  (:require [clojure.java.io :as io])
                  (:import (java.io RandomAccessFile)))
(defn foo [] (println \"whee\"))"))