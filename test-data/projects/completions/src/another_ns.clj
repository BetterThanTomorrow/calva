;; another_ns.clj
(ns another-ns)

(def ns-alias 0)

(defn bar
  []
  (ns-a)) ;; Autocomplete will only suggest "ns-alias alias to: aliased" LSP-OUTPUT

(defn foo
  [ns-alias]
  (ns-a)) ;; Autocomplete will only suggest "ns-alias alias to: aliased"

(defn baz
  []
  (let [ns-alias 0]
    ns-a)) ;; Autocomplete will only suggest "ns-alias alias to: aliased"