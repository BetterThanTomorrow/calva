(ns calva.js-utils
  (:require [cljs.reader]
   [cljs.tools.reader :as tr]
   [cljs.tools.reader.reader-types :as rt]
   [cljs.test :refer [is]]))

(defn ^:export jsify [o]
  (clj->js o))

(defn ^:export cljify [o]
  (js->clj o :keywordize-keys true))

(defn- parse-edn
  "Parses out the first form from `s`.
   `s` needs to be a string representation of valid EDN.
   Returns the parsed form."
  {:test (fn []
           (is (= (parse-edn "#=(+ 1 2)") "#=(+ 1 2)"))
           (is (= (parse-edn "{:foo [1 2]}") {:foo [1 2]}))
           (is (= (parse-edn ":a {:foo ['bar] :bar 'foo}") :a)))}
  [s]
  (cljs.reader/read-string {:default #(str "#" %1 %2)} s))

(defn parse-edn-js [s]
  (jsify (parse-edn s)))

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
      (let [parsed-form (tr/read {:eof 'CALVA-EOF} pbr)]
        (if (= parsed-form 'CALVA-EOF)
          parsed-forms
          (recur (conj parsed-forms parsed-form)))))))

(defn parse-forms-js [s]
  (jsify (parse-forms s)))

(comment
  (= [:a {:foo [(quote bar)], :bar (quote foo)}]
     [:a {:foo ['bar] :bar 'foo}])
  (parse-forms ";; shadow-cljs configuration\n{:source-paths [\"src\"]\n\n\n :dependencies [[binaryage/dirac          \"1.2.30\"]\n                [binaryage/devtools       \"0.9.8\"]\n                [org.clojure/tools.reader \"1.1.0\"]\n                [rum                      \"0.11.0\"]\n                [com.rpl/specter          \"1.1.0\"]\n                [funcool/potok            \"2.3.0\"]\n                [funcool/beicon           \"4.1.0\"]\n                [funcool/rxhttp           \"1.0.0-SNAPSHOT\"]]\n\n\n :builds {:server {:target    :node-script\n                   :main      two-in-shadows.server/main\n                   :compiler-options {:source-map-use-fs-paths true}\n                   :output-to \"out/server.js\"}\n\n          :client {:target     :browser\n                   :modules    {:main {:entries [two-in-shadows.client]}}\n                   :output-dir \"public/js\"\n                   :asset-path \"/js\"\n                   :devtools   {:http-root  \"public\"\n                                :http-port  8280\n                                :after-load two-in-shadows.client/mount-root\n                                :preloads   [dirac.runtime.preload devtools.preload]}}}}\n"))