(ns calva.parse
  (:require [cljs.reader]
            [cljs.tools.reader :as tr]
            [clojure.edn :as edn]
            [cljs.tools.reader.reader-types :as rt]
            [clojure.string :as str]
            [calva.js-utils :refer [jsify]]))

(defn parse-edn
  "Parses out the first form from `s`.
   `s` needs to be a string representation of valid EDN.
   Returns the parsed form."
  [s]
  (cljs.reader/read-string {:default #(str "#" %1 %2)} s))

(defn parse-edn-js [s]
  (jsify (parse-edn s)))

(defn parse-edn-js-bridge [s]
  (parse-edn-js s))

(defn parse-forms
  "Parses out all top level forms from `s`.
   Returns a vector with the parsed forms."
  [s]
  (let [pbr (rt/string-push-back-reader (-> s ; tools.reader croaks on some Clojure constructs
                                              ; at least the way we use it here
                                              ; And we're not interested in actually parsing these
                                            (str/replace #"#=\(" "nil #_(")
                                            (str/replace #"`" "'")))]
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
  "Reads edn (with regexp tags or regexes)"
  [s]
  (if (re-find #"#re" (or s ""))
    (edn/read-string {:readers {'re re-pattern}} s)
    (tr/read-string s)))

;[[ar gu ment] {:as extras, :keys [d e :s t r u c t u r e d]}]
(comment
  (meta (:indents (parse-clj-edn "{:indents ^:replace {}}")))
  (parse-forms-js-bridge "(deftest fact-rec-test\n  (testing \"returns 1 when passed 1\"\n    (is (= 1 (do (println \"hello\") #break (core/fact-rec 1))))))")
  (= [:a {:foo [(quote bar)], :bar (quote foo)}]
     [:a {:foo ['bar] :bar 'foo}])
  (jsify (pr-str '(str "**EDN edn current-form**: " $current-form)))
  (jsify (parse-clj-edn (str '(str #"EDN edn current-form: " $current-form))))
  (jsify (parse-forms "(str \"**EDN edn current-form**: \" $current-form)"))
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
