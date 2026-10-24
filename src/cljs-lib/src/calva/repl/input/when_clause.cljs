(ns calva.repl.input.when-clause
  "Reads VS Code `when` clauses and tells whether they hold in a context. Covers `!`, `&&`, `||`,
   parentheses, `==`, `!=`, `=~` and `true`/`false`, which is what Calva's keybindings use."
  (:require
   [clojure.string :as string]))

(def ^:private token-re
  #"\s*(\(|\)|&&|\|\||!(?!=)|[^\s()!&|=]+(?:\s*=~\s*/(?:\\.|[^/\\])*/[a-z]*|\s*(?:===?|!==?)\s*(?:'[^']*'|[^\s()&|]+))?)")

(defn- tokens
  [clause]
  (mapv second (re-seq token-re (or clause ""))))

(defn- term
  [token]
  (if-let [[_ k pattern flags] (re-matches #"(\S+?)\s*=~\s*/(.*)/([a-z]*)" token)]
    [:matches k pattern flags]
    (if-let [[_ k op v] (re-matches #"(\S+?)\s*(===?|!==?)\s*'?([^']*)'?" token)]
      [(if (string/starts-with? op "!") :not= :=) k v]
      (case token
        "true" [:literal true]
        "false" [:literal false]
        [:key token]))))

(defn parse
  "Returns `clause` as an expression for `holds?`, or nil when `clause` is empty."
  [clause]
  (letfn [(parse-or [ts]
            (let [[expr ts] (parse-and ts)]
              (loop [exprs [expr] ts ts]
                (if (= "||" (first ts))
                  (let [[expr ts] (parse-and (rest ts))]
                    (recur (conj exprs expr) ts))
                  [(if (next exprs) (into [:or] exprs) expr) ts]))))
          (parse-and [ts]
            (let [[expr ts] (parse-not ts)]
              (loop [exprs [expr] ts ts]
                (if (= "&&" (first ts))
                  (let [[expr ts] (parse-not (rest ts))]
                    (recur (conj exprs expr) ts))
                  [(if (next exprs) (into [:and] exprs) expr) ts]))))
          (parse-not [ts]
            (case (first ts)
              "!" (let [[expr ts] (parse-not (rest ts))]
                    [[:not expr] ts])
              "(" (let [[expr ts] (parse-or (rest ts))]
                    [expr (rest ts)])
              [(term (first ts)) (rest ts)]))]
    (when-let [ts (seq (tokens clause))]
      (first (parse-or ts)))))

(defn- truthy?
  [v]
  (not (contains? #{nil false "" 0} v)))

(defn holds?
  "True when the parsed clause `expr` holds in `context`, a map from context keys to values.
   A missing clause holds."
  [expr context]
  (if (nil? expr)
    true
    (let [[op & args] expr]
      (case op
        :or (boolean (some #(holds? % context) args))
        :and (every? #(holds? % context) args)
        :not (not (holds? (first args) context))
        :literal (first args)
        :key (truthy? (get context (first args)))
        := (= (str (get context (first args))) (second args))
        :not= (not= (str (get context (first args))) (second args))
        :matches (let [[k pattern flags] args
                       v (get context k)]
                   (and (some? v)
                        (.test (js/RegExp. pattern flags) (str v))))))))

(defn context-keys
  "The context keys the parsed clause `expr` reads."
  [expr]
  (into #{}
        (comp (filter vector?)
              (keep (fn [[op k]] (when (#{:key := :not= :matches} op) k))))
        (tree-seq vector? rest expr)))
